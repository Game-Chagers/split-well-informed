import { Prisma, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";

// call create group and ensure a
// Group is created along with a group member and connects a user

describe("/expense", async () => {
  it.each([
    {
      name: "splits $3.00 equally among 3 people",
      test_user_amt: 3,
      amount: 3,
      test_splits: [
        { userId: 0, amount: 1 },
        { userId: 1, amount: 1 },
        { userId: 2, amount: 1 },
      ],
      status: 201,
    },
    {
      name: "splits $10.00 equally among 3 people",
      test_user_amt: 3,
      amount: 10,
      test_splits: [
        { userId: 0, amount: 3.3334 },
        { userId: 1, amount: 3.3333 },
        { userId: 2, amount: 3.3333 },
      ],
      status: 201,
    },
  ])(
    "/expense.post $name",
    async ({ test_user_amt, amount, test_splits, status }) => {
      await clear_columns(prisma);
      const test_users: User[] = [];
      for (let i = 1; i <= test_user_amt; i++) {
        const tu = await prisma.user.create({
          data: {
            name: `expense_test_user${i}`,
            email: `expense_test_user${i}@email.com`,
            isGuest: false,
          },
        });
        test_users.push(tu);
      }
      const token = jwt.sign(
        { userId: test_users[0].id },
        process.env.JWT_SECRET || "needs a fallback secret ig",
      );
      const test_group = await prisma.group.create({
        data: {
          name: "expense-test",
          members: {
            create: test_users.map((tu) => ({
              userId: tu.id,
            })),
          },
        },
      });
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
          expect(res.body.splits).toEqual(
            splits.map((s) =>
              expect.objectContaining({
                userId: s.userId,
                amount: String(s.amount),
              }),
            ),
          );
        });

      const expenses = await prisma.expense.findMany();
      expect(expenses).toHaveLength(1);
      const expense = expenses[0];

      const expense_splits = await prisma.expenseSplit.findMany();
      expect(expense_splits).toHaveLength(test_user_amt);
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
      test_user_amt: 3,
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
      test_user_amt: 3,
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
      test_user_amt: 3,
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
      test_user_amt: 3,
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
      test_user_amt: 3,
      amount: 3,
      init_splits: [{ userId: 0, amount: 3 }],
      update_splits: [{ userId: 1, amount: 1 }],
      final_splits: [{ userId: 0, amount: 3 }],
      status: 400,
    },
  ])(
    "/expense.patch $name",
    async ({
      test_user_amt,
      amount,
      init_splits,
      update_splits,
      final_splits,
      status,
    }) => {
      await clear_columns(prisma);
      const test_users: User[] = [];
      for (let i = 1; i <= test_user_amt; i++) {
        const tu = await prisma.user.create({
          data: {
            name: `expense_test_user${i}`,
            email: `expense_test_user${i}@email.com`,
            isGuest: false,
          },
        });
        test_users.push(tu);
      }
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

      const token = jwt.sign(
        { userId: test_users[0].id },
        process.env.JWT_SECRET || "needs a fallback secret ig",
      );
      const test_group = await prisma.group.create({
        data: {
          name: "expense-test",
          members: {
            create: test_users.map((tu) => ({
              userId: tu.id,
            })),
          },
        },
      });
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
    const test_user = await prisma.user.create({
      data: {
        name: `expense_test_user`,
        email: `expense_test_user@email.com`,
        isGuest: false,
      },
    });
    const token = jwt.sign(
      { userId: test_user.id },
      process.env.JWT_SECRET || "needs a fallback secret ig",
    );
    const test_group = await prisma.group.create({
      data: {
        name: "expense-test",
        members: {
          create: { userId: test_user.id },
        },
      },
    });
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
