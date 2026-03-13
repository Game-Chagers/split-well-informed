import { Prisma } from "@prisma/client";
import { UUID } from "node:crypto";
interface edge {
  amount: Prisma.Decimal;
  flow: Prisma.Decimal;
  residual: edge;
  rev: number;
}
function remaining(edge: edge) {
  return edge.amount.minus(edge.flow);
}
// returns false if not a valide edge,
// The edge and residual edge have a capacity of 0 or remaining flow of 0.
function uprev(rev: number, edge: edge): void {
  if (rev > edge.rev) {
    edge.amount = Prisma.Decimal.min(edge.amount, remaining(edge));
    edge.flow = Prisma.Decimal(0);
    edge.rev = rev;
  }
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
function for_graph(
  graph: Map<UUID, Map<UUID, edge>>,
  func: (from: UUID, to: UUID, edge: edge) => void,
) {
  for (const [from, edges] of graph.entries()) {
    for (const [to, edge] of edges.entries()) {
      func(from, to, edge);
    }
  }
}
export default class Split {
  graph: Map<UUID, Map<UUID, edge>>;
  payments: any[];
  constructor(
    payments: any[],
    amountl: string = "amount",
    tol: string = "to",
    froml: string = "from",
  ) {
    this.graph = this.construct_graph(payments, amountl, tol, froml);
    let rev = 0;

    for_graph(this.graph, (from: UUID, to: UUID, edge: edge) => {
      uprev(rev, edge);
      if (remaining(edge)) {
        const mf = new MaxFlow(rev++, from, to, this.graph);
        uprev(rev, edge);
        edge.amount = mf.maxflow;
      }
    });
    this.payments = [];
    for_graph(this.graph, (from: UUID, to: UUID, edge: edge) => {
      if (edge.flow.gt(0) && edge.amount.gt(0)) {
        this.payments.push({
          [amountl]: edge.amount,
          [froml]: from,
          [tol]: to,
        });
      }
    });
  }
  construct_graph(
    payments: any[],
    amountl = "amount",
    tol = "to",
    froml = "from",
  ): Map<UUID, Map<UUID, edge>> {
    const graph: Map<UUID, Map<UUID, edge>> = new Map();
    for (const pay of payments) {
      const edge: edge = {
        amount: pay[amountl],
        flow: new Prisma.Decimal(0),
        residual: {} as edge,
        rev: 0,
      };
      const residual_edge: edge = {
        amount: new Prisma.Decimal(0),
        flow: new Prisma.Decimal(0),
        residual: edge,
        rev: 0,
      };
      edge.residual = residual_edge;
      graph_push(graph, pay[froml], pay[tol], edge);
      graph_push(graph, pay[tol], pay[froml], residual_edge);
    }
    return graph;
  }
}

class MaxFlow {
  rev: number;
  s: UUID;
  t: UUID;
  graph: Map<UUID, Map<UUID, edge>>;
  level_graph: Map<UUID, number>;
  maxflow: Prisma.Decimal;
  constructor(
    rev: number,
    s: UUID,
    t: UUID,
    graph: Map<UUID, Map<UUID, edge>>,
  ) {
    this.rev = rev;
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
