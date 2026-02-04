import { Prisma } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";
import { create_group, create_payments } from "./setup.js";

describe("/payment", async () => {
  it.each([
    {
      name: "basic test",
      user_cnt: 3,
      expenses: [
        {
          amount: 3,
          payerIndex: 0,
          splits: [
            { userIndex: 0, amount: 1 },
            { userIndex: 1, amount: 1 },
            { userIndex: 2, amount: 1 },
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
    {
      name: "cancels out",
      user_cnt: 3,
      expenses: [
        {
          amount: 3,
          payerIndex: 0,
          splits: [
            { userIndex: 0, amount: 1 },
            { userIndex: 1, amount: 1 },
            { userIndex: 2, amount: 1 },
          ],
        },
        {
          amount: 3,
          payerIndex: 1,
          splits: [
            { userIndex: 0, amount: 1 },
            { userIndex: 1, amount: 1 },
            { userIndex: 2, amount: 1 },
          ],
        },
      ],
      payment_expected: [
        {
          amount: 1,
          senderId: 2,
          receiverId: 0,
        },
        {
          amount: 1,
          senderId: 2,
          receiverId: 1,
        },
      ],
    },
    {
      name: "everyone owes something and is owed",
      user_cnt: 3,
      expenses: [
        {
          amount: 100,
          payerIndex: 0,
          splits: [
            { userIndex: 0, amount: 60 },
            { userIndex: 1, amount: 20 },
            { userIndex: 2, amount: 20 },
          ],
        },
        {
          amount: 60,
          payerIndex: 1,
          splits: [
            { userIndex: 0, amount: 30 },
            { userIndex: 1, amount: 10 },
            { userIndex: 2, amount: 20 },
          ],
        },
        {
          amount: 50,
          payerIndex: 2,
          splits: [
            { userIndex: 0, amount: 40 },
            { userIndex: 1, amount: 10 },
            { userIndex: 2, amount: 0 },
          ],
        },
      ],
      payment_expected: [
        {
          amount: 10,
          senderId: 0,
          receiverId: 1,
        },
        {
          amount: 10,
          senderId: 2,
          receiverId: 1,
        },
        {
          amount: 20,
          senderId: 0,
          receiverId: 2,
        },
      ],
    },
  ])(
    "generating payments $name",
    async ({ user_cnt, expenses, payment_expected }) => {
      await clear_columns(prisma);
      const { test_users, token, test_group } = await create_group(user_cnt);
      await create_payments(test_users, test_group.id, expenses);

      const pay_expect_JSON = payment_expected.map((p: any) =>
        expect.objectContaining({
          ...p,
          amount: String(Prisma.Decimal(p.amount)),
          senderId: test_users[p.senderId].id,
          receiverId: test_users[p.receiverId].id,
        }),
      );
      await request(app)
        .get(`/group/${test_group.id}/payment`)
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
  it.each([
    {
      name: "basic test",
      user_cnt: 3,
      expenses: [
        {
          amount: 3,
          payerIndex: 0,
          splits: [
            { userIndex: 0, amount: 1 },
            { userIndex: 1, amount: 1 },
            { userIndex: 2, amount: 1 },
          ],
        },
      ],
      settle: [
        {
          amount: 1,
          senderId: 1,
          receiverId: 0,
        },
      ],
      payment_expected: [
        {
          amount: 1,
          senderId: 2,
          receiverId: 0,
        },
      ],
    },
    {
      name: "settling all payments",
      user_cnt: 3,
      expenses: [
        {
          amount: 3,
          payerIndex: 0,
          splits: [
            { userIndex: 0, amount: 1 },
            { userIndex: 1, amount: 1 },
            { userIndex: 2, amount: 1 },
          ],
        },
      ],
      settle: [
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
      payment_expected: [],
    },
  ])(
    "regenerating payments after settling $name",
    async ({ user_cnt, expenses, settle, payment_expected }) => {
      await clear_columns(prisma);
      const { test_users, token, test_group } = await create_group(user_cnt);
      await create_payments(test_users, test_group.id, expenses);

      const settled_JSON = settle.map((p: any) =>
        expect.objectContaining({
          ...p,
          amount: String(Prisma.Decimal(p.amount)),
          senderId: test_users[p.senderId].id,
          receiverId: test_users[p.receiverId].id,
        }),
      );
      const made_payments = await request(app)
        .get(`/group/${test_group.id}/payment`)
        .set("Authorization", `Bearer ${token}`)
        .send()
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual(expect.arrayContaining(settled_JSON));
          return res;
        });
      //settling
      const responses = Promise.all(
        made_payments.body
          .filter((p: any) =>
            settle.find(
              (s) => p.senderId === s.senderId && p.receiverId === s.receiverId,
            ),
          )
          .map((p: any) =>
            request(app).post(`/group/${test_group.id}/settle/${p.id}`),
          ),
      );

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
