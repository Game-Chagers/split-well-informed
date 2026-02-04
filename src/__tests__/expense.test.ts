import { Prisma } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";
import { create_group } from "./setup.js";

// call create group and ensure a
// Group is created along with a group member and connects a user

describe("/expense", async () => {
  it.each([
    {
      name: "splits $3.00 equally among 3 people",
      user_cnt: 3,
      amount: 3,
      test_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      status: 201,
    },
    {
      name: "fails to split $10 with one cent missing",
      user_cnt: 3,
      amount: 10,
      test_splits: [
        { userId: 0, amount: 3.33 },
        { userId: 1, amount: 3.33 },
        { userId: 2, amount: 3.33 },
      ],
      status: 400,
    },
  ])(
    "/expense.post $name",
    async ({ user_cnt, amount, test_splits, status }) => {
      await clear_columns(prisma);
      const { test_users, token, test_group } = await create_group(user_cnt);
      const splits = test_splits.map(
        (s: { userId: number; amount: number }) => ({
          userId: test_users[s.userId].id,
          amount: s.amount,
        }),
      );
      await request(app)
        .post(`/group/${test_group.id}/expense`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "test_expense",
          category: "test",
          amount,
          payerId: test_users[0].id,
          splits,
        })
        .expect(status)
        .then((res) => {
          if (status === 400) return;
          expect(res.body.splits).toEqual(
            splits.map((s) =>
              expect.objectContaining({
                userId: s.userId,
                amount: String(s.amount),
              }),
            ),
          );
        });

      if (status === 400) return;
      const expenses = await prisma.expense.findMany();
      expect(expenses).toHaveLength(1);
      const expense = expenses[0];

      const expense_splits = await prisma.expenseSplit.findMany();
      expect(expense_splits).toHaveLength(user_cnt);
      expect(expense_splits).toEqual(
        splits.map((s) =>
          expect.objectContaining({
            userId: s.userId,
            amount: Prisma.Decimal(s.amount),
            expenseId: expense.id,
          }),
        ),
      );
    },
  );
  it.each([
    {
      name: "moves split between two people",
      user_cnt: 3,
      amount: 3,
      init_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 2 },
      ],
      update_splits: [
        { userId: 0, amount: 2 },
        { userId: 1, amount: 1 },
      ],
      final_splits: [
        { userId: 0, amount: 2 },
        { userId: 1, amount: 1 },
      ],
      status: 201,
    },
    {
      name: "removes one user from split",
      user_cnt: 3,
      amount: 3,
      init_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      update_splits: [
        { userId: 0, amount: 2 },
        { userId: 2, amount: 0 },
      ],
      final_splits: [
        { userId: 0, amount: 2 },
        { userId: 1, amount: 1 },
      ],
      status: 201,
    },
    {
      name: "adds two extra in a split",
      user_cnt: 3,
      amount: 3,
      init_splits: [{ userId: 0, amount: 3 }],
      update_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      final_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      status: 201,
    },
    {
      name: "fails adds to split without taking away from another",
      user_cnt: 3,
      amount: 3,
      init_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      update_splits: [{ userId: 0, amount: 2 }],
      final_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      status: 400,
    },
    {
      name: "fails to remove from one without adding to another",
      user_cnt: 3,
      amount: 3,
      init_splits: [{ userId: 0, amount: 3 }],
      update_splits: [{ userId: 1, amount: 1 }],
      final_splits: [{ userId: 0, amount: 3 }],
      status: 400,
    },
  ])(
    "/expense.patch $name",
    async ({
      user_cnt,
      amount,
      init_splits,
      update_splits,
      final_splits,
      status,
    }) => {
      await clear_columns(prisma);
      const { test_users, token, test_group } = await create_group(user_cnt);
      const init = init_splits.map((s) => ({
        userId: test_users[s.userId].id,
        amount: s.amount,
      }));
      const update = update_splits.map((s) => ({
        userId: test_users[s.userId].id,
        amount: s.amount,
      }));
      const final = final_splits.map((s) => ({
        userId: test_users[s.userId].id,
        amount: s.amount,
      }));
      const test_expense = await prisma.expense.create({
        data: {
          description: "For testing of expense.patch",
          category: "test",
          amount,
          payerId: test_users[0].id,
          groupId: test_group.id,
          splits: {
            create: init,
          },
        },
      });
      await request(app)
        .patch(`/group/${test_group.id}/expense/${test_expense.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          splits: update,
        })
        .expect(status)
        .then((res) => {
          if (status >= 300) return;
          expect(res.body.splits).toEqual(
            expect.arrayContaining(
              final.map((s) =>
                expect.objectContaining({
                  userId: s.userId,
                  amount: String(s.amount),
                }),
              ),
            ),
          );
        });
      const expenses = await prisma.expense.findMany();
      expect(expenses).toHaveLength(1);
      const expense = expenses[0];

      const expense_splits = await prisma.expenseSplit.findMany();
      expect(expense_splits).toHaveLength(final.length);
      expect(expense_splits).toEqual(
        expect.arrayContaining(
          final.map((s) =>
            expect.objectContaining({
              userId: s.userId,
              amount: Prisma.Decimal(s.amount),
              expenseId: expense.id,
            }),
          ),
        ),
      );
    },
  );
  it("/expense.delete", async () => {
    await clear_columns(prisma);
    const { test_users, token, test_group } = await create_group(1);
    const test_user = test_users[0];
    const test_expense = await prisma.expense.create({
      data: {
        description: "For testing of expense.patch",
        category: "test",
        amount: 1,
        payerId: test_user.id,
        groupId: test_group.id,
        splits: {
          create: { userId: test_user.id, amount: 1 },
        },
      },
    });
    await request(app)
      .delete(`/group/${test_group.id}/expense/${test_expense.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(await prisma.expense.findMany()).toHaveLength(0);
    expect(await prisma.expenseSplit.findMany()).toHaveLength(0);
  });
});
