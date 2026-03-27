import { Prisma } from "@prisma/client";
import { UUID } from "node:crypto";

interface edge {
  amount: Prisma.Decimal;
  flow: Prisma.Decimal;
  residual: edge;
}
function remaining(edge: edge) {
  return edge.amount.minus(edge.flow);
}

function graph_push(
  graph: Map<any, Map<any, any>>,
  from: any,
  to: any,
  edge: any,
) {
  const from_map: Map<any, any> = graph.get(from) ?? new Map();
  from_map.set(to, edge);
  graph.set(from, from_map);
}

function graph_delete(graph: Map<any, Map<any, any>>, from: any, to: any) {
  const from_map = graph.get(from);
  from_map?.delete(to);
  if (from_map?.size == 0) graph.delete(from);
}
function for_graph(
  graph: Map<UUID, Map<UUID, edge>>,
  func: (from: UUID, to: UUID, edge: edge) => void,
) {
  for (const [from, edges] of graph) {
    for (const [to, edge] of edges) {
      func(from, to, edge);
    }
  }
}
/*
takes object type {to, from, amount} 
returns same type reduce
*/
export default class Split {
  graph: Map<UUID, Map<UUID, edge>>;
  payments: any[];
  split_payments: any[];
  constructor(payments: any[]) {
    this.graph = new Map();
    this.payments = payments;
    this.split_payments = [];
  }
  split(
    amountl: string = "amount",
    tol: string = "to",
    froml: string = "from",
  ) {
    this.construct_graph(amountl, tol, froml);
    this.dfs_remove_cycles();
    this.reset_graph();
    this.reduce_graph();
    this.make_payments();
    return this.split_payments;
  }
  reduce_graph() {
    for_graph(this.graph, (from: UUID, to: UUID, edge: edge) => {
      if (remaining(edge)) {
        const mf = new MaxFlow(from, to, this.graph);
        edge.amount = mf.maxflow;
        edge.flow = Prisma.Decimal(0);
        this.reset_graph();
      }
    });
  }
  make_payments(
    amountl: string = "amount",
    tol: string = "to",
    froml: string = "from",
  ) {
    for_graph(this.graph, (from: UUID, to: UUID, edge: edge) => {
      if (edge.amount.gt(0)) {
        this.split_payments.push({
          [amountl]: edge.amount,
          [froml]: from,
          [tol]: to,
        });
      }
    });
  }
  reset_graph() {
    for_graph(this.graph, (from: UUID, to: UUID, edge: edge) => {
      edge.amount = Prisma.Decimal.min(edge.amount, remaining(edge));
      edge.flow = Prisma.Decimal(0);
      if (remaining(edge).eq(0) && remaining(edge.residual).eq(0)) {
        graph_delete(this.graph, from, to);
        graph_delete(this.graph, to, from);
      }
    });
  }
  dfs_remove_cycles() {
    interface cycle {
      begin: UUID;
      min: Prisma.Decimal;
      edges: edge[];
    }
    const visited = new Map(
      Array.from(this.graph.keys()).map((node) => [node, false]),
    );
    const cur_path = new Map(
      Array.from(this.graph.keys()).map((node) => [node, false]),
    );
    const dfs: (node: UUID) => cycle | null = (node: UUID) => {
      if (cur_path.get(node))
        return {
          begin: node,
          min: Prisma.Decimal(Infinity),
          edges: [] as edge[],
        };
      if (visited.get(node)) return null;
      visited.set(node, true);
      cur_path.set(node, true);
      for (const [to, edge] of this.graph.get(node) ?? []) {
        while (true) {
          if (remaining(edge).lte(0) && node !== ("temp" as UUID)) break;
          let cycle = dfs(to);
          if (cycle) {
            cycle = {
              begin: cycle.begin,
              min: Prisma.Decimal.min(cycle.min, edge.amount),
              edges: [edge, ...cycle.edges],
            };
            // console.log(node, cycle);
            if (cycle.begin !== node) {
              visited.set(node, false);
              cur_path.set(node, false);
              return cycle;
            }
            for (const cycle_edge of cycle.edges) {
              cycle_edge.flow = cycle_edge.flow.plus(cycle.min);
            }
          } else break;
        }
      }
      cur_path.set(node, false);
      return null;
    };
    let unvisited;
    while (
      (unvisited = Array.from(this.graph.keys()).find((n) => !visited.get(n)))
    ) {
      graph_push(this.graph, "temp", unvisited, {} as edge);
      dfs(unvisited);
      graph_delete(this.graph, "temp", unvisited);
    }
  }
  construct_graph(
    amountl = "amount",
    tol = "to",
    froml = "from",
  ): Map<UUID, Map<UUID, edge>> {
    for (const pay of this.payments) {
      const edge: edge = {
        amount: pay[amountl],
        flow: new Prisma.Decimal(0),
        residual: {} as edge,
      };
      const residual_edge: edge = {
        amount: new Prisma.Decimal(0),
        flow: new Prisma.Decimal(0),
        residual: edge,
      };
      edge.residual = residual_edge;
      graph_push(this.graph, pay[froml], pay[tol], edge);
      graph_push(this.graph, pay[tol], pay[froml], residual_edge);
    }
    return this.graph;
  }
}

class MaxFlow {
  s: UUID;
  t: UUID;
  graph: Map<UUID, Map<UUID, edge>>;
  level_graph: Map<UUID, number>;
  maxflow: Prisma.Decimal;
  constructor(s: UUID, t: UUID, graph: Map<UUID, Map<UUID, edge>>) {
    this.graph = graph;
    this.s = s;
    this.t = t;
    this.maxflow = Prisma.Decimal(0);
    this.level_graph = new Map();
    let blk_flow;
    while (this.construct_level_graph()) {
      while (
        (blk_flow = this.find_blk_flow(this.s, Prisma.Decimal(Infinity))).gt(0)
      ) {
        this.maxflow = this.maxflow.plus(blk_flow);
      }
    }
  }
  construct_level_graph(): boolean {
    this.level_graph = new Map([[this.s, 0]]);
    let i = 0;
    while (i < this.level_graph.size) {
      const [node, level] = Array.from(this.level_graph.entries())[i++];
      for (const [to, edge] of this.graph.get(node)?.entries() ?? []) {
        if (remaining(edge).gt(0) && !this.level_graph.has(to)) {
          this.level_graph.set(to, level + 1);
        }
      }
    }
    //returns false when it cant reach sink
    return this.level_graph.has(this.t);
  }
  is_higher_lvl(node: UUID, next: UUID) {
    const level_node = this.level_graph.get(node) as number;
    const level_next = this.level_graph.get(next) as number;
    return (
      level_next != undefined &&
      level_node != undefined &&
      level_node < level_next
    );
  }
  find_blk_flow(node: UUID, flow: Prisma.Decimal): Prisma.Decimal {
    if (node === this.t) return flow;
    for (const [to, edge] of this.graph.get(node)?.entries() ?? []) {
      if (!remaining(edge).isZero() && this.is_higher_lvl(node, to)) {
        const blk_flow = this.find_blk_flow(
          to,
          Prisma.Decimal.min(remaining(edge), flow),
        );
        if (blk_flow.gt(0)) {
          edge.flow = edge.flow.plus(blk_flow);
          edge.residual.flow = edge.residual.flow.minus(blk_flow);
          return blk_flow;
        }
      }
    }
    return Prisma.Decimal(0);
  }
}
