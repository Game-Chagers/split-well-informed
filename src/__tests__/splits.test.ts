import { Prisma } from "@prisma/client";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import Split from "../split/split.js";

describe("Splits unit tests", () => {
  it(`verifies no new edges are made, 
    the net total amount of money for each user hasn't changed, 
    `, async () => {
    const node_cnt = 3;
    const edge_cnt = (Math.pow(node_cnt - 1, 2) + node_cnt - 1) / 2;
    const from = (i: number) =>
      node_cnt -
      2 -
      Math.floor(
        (Math.sqrt(4 * node_cnt * (node_cnt - 1) - 8 * i - 7) - 1) / 2,
      );
    const to = (i: number) =>
      i + from(i) + 1 - (from(i) * (2 * node_cnt - from(i) - 1)) / 2;
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid({ version: 4 }), {
          minLength: node_cnt,
          maxLength: node_cnt,
        }),
        fc.array(
          fc.record({
            dir: fc.boolean(),
            amount: fc
              .option(fc.nat(10000), { nil: 0 })
              .map((n) => Prisma.Decimal(n / 100)),
          }),
          { minLength: edge_cnt, maxLength: edge_cnt },
        ),
        (nodes, amounts) => {
          const edges = amounts
            .map(({ dir, amount }, i) => ({
              to: nodes[dir ? to(i) : from(i)],
              from: nodes[dir ? from(i) : to(i)],
              amount,
            }))
            .filter((e) => e.amount.gt(0));
          const split = new Split(edges as []);
          expect(split.payments.length).toBeLessThanOrEqual(edge_cnt);

          const totalperuser = (arr: any[]) =>
            arr.reduce(
              (acc: Prisma.Decimal[], e: any, i) => {
                if (e.dir) {
                  acc[to(i)].plus(e.amount);
                  acc[from(i)].minus(e.amount);
                } else {
                  acc[to(i)].minus(e.amount);
                  acc[from(i)].plus(e.amount);
                }
                return acc;
              },
              [new Array(node_cnt)].map(() => Prisma.Decimal(0)),
            );

          expect(totalperuser(split.payments)).toStrictEqual(
            totalperuser(amounts),
          );
        },
      ),
    );
  });
  it.each([
    {
      name: "3 people split where 3 payments can reduce to one",
      edges: [
        {
          amount: 1,
          from: "a",
          to: "b",
        },
        {
          amount: 1,
          from: "a",
          to: "c",
        },
        {
          amount: 1,
          from: "c",
          to: "b",
        },
      ],
      expected: [
        {
          amount: 2,
          from: "a",
          to: "b",
        },
      ],
    },
    {
      name: "3 people owe each other so no one owes each other",
      edges: [
        {
          amount: 1,
          from: "a",
          to: "b",
        },
        {
          amount: 1,
          from: "b",
          to: "c",
        },
        {
          amount: 1,
          from: "c",
          to: "a",
        },
      ],
      expected: [],
    },
    {
      name: "8 people split where 8 payments can reduce to one",
      edges: [
        {
          amount: 1,
          from: "a",
          to: "b",
        },
        {
          amount: 1,
          from: "a",
          to: "c",
        },
        {
          amount: 1,
          from: "c",
          to: "d",
        },
        {
          amount: 1,
          from: "d",
          to: "e",
        },
        {
          amount: 1,
          from: "e",
          to: "f",
        },
        {
          amount: 1,
          from: "f",
          to: "g",
        },
        {
          amount: 1,
          from: "g",
          to: "h",
        },
        {
          amount: 1,
          from: "h",
          to: "b",
        },
      ],
      expected: [
        {
          amount: 2,
          from: "a",
          to: "b",
        },
      ],
    },
  ])("split scenarios: $name", async ({ edges, expected }) => {
    const convert = (s: any[]) =>
      s.map((e) => ({ ...e, amount: Prisma.Decimal(e.amount) }));
    const split = new Split(convert(edges), "amount", "to", "from");
    expect(split.payments).toStrictEqual(convert(expected));
  });
});
