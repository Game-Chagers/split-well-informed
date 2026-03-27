import { fc, it } from "@fast-check/vitest";
import { Prisma } from "@prisma/client";
import { describe, expect } from "vitest";
import Split from "../split/split.js";

describe("Splits unit tests", () => {
  const convert = (s: any[]) =>
    s.map((e) => ({ ...e, amount: Prisma.Decimal(e.amount) }));
  // prettier-ignore
  const edge_cnt = (n: number) => 
    (Math.pow(n - 1, 2) + n - 1) / 2;
  // prettier-ignore
  const from = (n: number, i: number) => 
    (n - 2 - Math.floor((Math.sqrt(4 * n * (n - 1) - 8 * i - 7) - 1) / 2));
  // prettier-ignore
  const to = (n: number, i: number) => 
    i + from(n, i) + 1 - (from(n, i) * (2 * n - from(n, i) - 1)) / 2;

  const netuser = (arr: any[]) =>
    Array.from(
      arr
        .reduce((acc: Map<string, Prisma.Decimal>, e: any) => {
          let to = acc.get(e.to) ?? Prisma.Decimal(0);
          acc.set(e.to, to.plus(e.amount));
          let from = acc.get(e.from) ?? Prisma.Decimal(0);
          acc.set(e.from, from.minus(e.amount));
          return acc;
        }, new Map())
        .values(),
    );
  it.prop([
    // prettier-ignore
    fc.integer({ min: 3, max: 10 })
    .chain((node_cnt) =>
      fc.uniqueArray(fc.uuid({ version: 4 }), { minLength: node_cnt, maxLength: node_cnt, })
      .noShrink()
    ).chain((nodes) =>{
      return fc.array(
        fc.record({
          dir: fc.boolean(),
          amount: fc.option(fc.nat(10000), { nil: 0 }).map((n) => Prisma.Decimal(n / 100)),
        }), { minLength: edge_cnt(nodes.length), maxLength: edge_cnt(nodes.length), }
      )
      .map((t: { dir: boolean; amount: Prisma.Decimal }[]) =>{
        return t
          .map(({ dir, amount }, i) => ({
            to: nodes[ dir ? to(nodes.length, i) : from(nodes.length, i) ],
            from: nodes[ dir ? from(nodes.length, i) : to(nodes.length, i) ],
            amount,
          }))
          .filter(t=>t.amount.gt(0))
      })
    }),
  ])(
    `verifies no new edges are made, 
    the net total amount of money for each user hasn't changed, 
    `,
    (graph_arb) => {
      const edge_cnt = graph_arb.length;
      const split = new Split(graph_arb as []);
      const split_payments = split.split();
      expect(split_payments.length).toBeLessThanOrEqual(edge_cnt);
      const reduced_pays = netuser(split.payments);
      const start_pays = netuser(graph_arb);

      expect(reduced_pays).toStrictEqual(start_pays);
    },
  );
  // prettier-ignore
  it.each([
    {
      name: "3 people split where 3 payments can reduce to one",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "a", to: "c", },
        { amount: 1, from: "c", to: "b", },
      ],
      expected: [
        { amount: 2, from: "a", to: "b", },
      ],
    },
    {
      name: "8 people split where 8 payments can reduce to one",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "a", to: "c", },
        { amount: 1, from: "c", to: "d", },
        { amount: 1, from: "d", to: "e", },
        { amount: 1, from: "e", to: "f", },
        { amount: 1, from: "f", to: "g", },
        { amount: 1, from: "g", to: "h", },
        { amount: 1, from: "h", to: "b", },
      ],
      expected: [
        { amount: 2, from: "a", to: "b", },
      ],
    },
    {
      name: "3 people owe each other in a loop",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "b", to: "c", },
        { amount: 1, from: "c", to: "a", },
      ],
      expected: [],
    },
    {
      name: "4 people owe each other in a loop",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "b", to: "c", },
        { amount: 1, from: "c", to: "d", },
        { amount: 1, from: "d", to: "a", },
      ],
      expected: [],
    },
    {
      name: "5 people with a 3 person loop",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "b", to: "c", },
        { amount: 1, from: "c", to: "d", },
        { amount: 1, from: "d", to: "b", },
        { amount: 1, from: "d", to: "e", },
      ],
      expected: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "d", to: "e", },
      ],
    },
    {
      name: "4 person loop with additional edge",
      edges: [
        { amount: 1, from: "a", to: "b", },
        { amount: 1, from: "b", to: "c", },
        { amount: 1, from: "c", to: "d", },
        { amount: 1, from: "d", to: "a", },
        { amount: 1, from: "d", to: "b", },
      ],
      expected: [
        { amount: 1, from: "d", to: "b", },
      ],
    },
  ])("split scenarios: $name", ({ edges, expected }) => {
    const split = new Split(convert(edges));
    const split_payments = split.split()
    expect(split_payments).toStrictEqual(convert(expected));
  });

  it.each([
    {
      name: "3 person loop that doesn't fully cancel",
      edges: [
        { amount: 3.75, from: "a", to: "b" },
        { amount: 9.99, from: "b", to: "c" },
        { amount: 6, from: "c", to: "a" },
      ],
      expected: [
        { amount: 6.24, from: "b", to: "c" },
        { amount: 2.25, from: "c", to: "a" },
      ],
    },
    {
      name: "4 person loop",
      edges: [
        { amount: 1, from: "a", to: "b" },
        { amount: 1, from: "b", to: "c" },
        { amount: 1, from: "c", to: "d" },
        { amount: 1, from: "d", to: "a" },
      ],
      expected: [],
    },
    {
      name: "3 person loop with external edge",
      edges: [
        { amount: 1, from: "a", to: "b" },
        { amount: 1, from: "b", to: "c" },
        { amount: 1, from: "c", to: "a" },
        { amount: 1, from: "d", to: "a" },
      ],
      expected: [{ amount: 1, from: "d", to: "a" }],
    },
    {
      name: "2 independent 3 person loops",
      edges: [
        { amount: 1, from: "a", to: "b" },
        { amount: 1, from: "b", to: "c" },
        { amount: 1, from: "c", to: "a" },
        { amount: 1, from: "d", to: "e" },
        { amount: 1, from: "e", to: "f" },
        { amount: 1, from: "f", to: "d" },
      ],
      expected: [],
    },
    {
      name: "2 attached 3 person loops",
      edges: [
        { amount: 1, from: "a", to: "b" },
        { amount: 1, from: "b", to: "c" },
        { amount: 1, from: "c", to: "a" },
        { amount: 1, from: "c", to: "d" },
        { amount: 1, from: "d", to: "e" },
        { amount: 1, from: "e", to: "c" },
      ],
      expected: [],
    },
    {
      name: "2 loops with 1 shared edge",
      edges: [
        { amount: 1, from: "a", to: "b" },
        { amount: 2, from: "b", to: "c" },
        { amount: 1, from: "c", to: "a" },
        { amount: 1, from: "c", to: "d" },
        { amount: 1, from: "d", to: "b" },
      ],
      expected: [],
    },
  ])("testing dfs_remove_cycles: $name", ({ edges, expected }) => {
    const split = new Split(convert(edges));
    split.construct_graph();
    split.dfs_remove_cycles();
    split.reset_graph();
    split.make_payments();
    expect(split.split_payments).toStrictEqual(convert(expected));
  });
});
