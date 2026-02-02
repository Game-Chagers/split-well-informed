import { Expense, Prisma, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";

// call create group and ensure a
// Group is created along with a group member and connects a user

async function create_env(user_cnt: number) {
  const test_users: User[] = [];
  for (let i = 1; i <= user_cnt; i++) {
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
  return { test_users, token, test_group };
}

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
      const { test_users, token, test_group } = await create_env(user_cnt);
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
      const { test_users, token, test_group } = await create_env(user_cnt);
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
    const { test_users, token, test_group } = await create_env(1);
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
  it.each([
    {
      name: "basic test",
      user_cnt: 3,
      expenses: [
        {
          amount: 3,
          splits: [
            { userId: 0, amount: 1 },
            { userId: 1, amount: 1 },
            { userId: 2, amount: 1 },
          ],
        },
      ],
      payment_expected: [
        {
          amount: 1,
          senderId: 1,
          receiverId: 0,
        },
        {
          amount: 1,
          senderId: 2,
          receiverId: 0,
        },
      ],
    },
  ])(
    "/expense/payment $name",
    async ({ user_cnt, expenses, payment_expected }) => {
      await clear_columns(prisma);
      const { test_users, token, test_group } = await create_env(user_cnt);

      await Promise.all(
        expenses.map(
          (exp): Promise<Expense> =>
            prisma.expense.create({
              data: {
                description: "For testing of /expense",
                category: "test",
                amount: exp.amount,
                payerId: test_users[0].id,
                groupId: test_group.id,
                splits: {
                  create: exp.splits.map((s: any) => ({
                    userId: test_users[s.userId].id,
                    amount: s.amount,
                  })) as any,
                },
              },
            }),
        ),
      );
      const pay_expect_JSON = payment_expected.map((p: any) =>
        expect.objectContaining({
          ...p,
          amount: String(Prisma.Decimal(p.amount)),
          senderId: test_users[p.senderId].id,
          receiverId: test_users[p.receiverId].id,
        }),
      );
      await request(app)
        .get(`/group/${test_group.id}/expense/payment`)
        .set("Authorization", `Bearer ${token}`)
        .send()
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual(expect.arrayContaining(pay_expect_JSON));
        });

      const pay_expect = payment_expected.map((p: any) =>
        expect.objectContaining({
          ...p,
          amount: Prisma.Decimal(p.amount),
          senderId: test_users[p.senderId].id,
          receiverId: test_users[p.receiverId].id,
        }),
      );
      const payments = await prisma.payment.findMany();
      expect(payments).toEqual(expect.arrayContaining(pay_expect));
    },
  );
});
