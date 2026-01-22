import { Group, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";

// call create group and ensure a
// Group is created along with a group member and connects a user

describe("/expense", async () => {
  const test_user_amt = 3;
  let test_users: User[];
  let test_group: Group;
  let token: string;
  beforeEach(async () => {
    await clear_columns(prisma);
    test_users = [];
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

    token = jwt.sign(
      { userId: test_users[0].id },
      process.env.JWT_SECRET || "needs a fallback secret ig",
    );

    test_group = await prisma.group.create({
      data: {
        name: "expense-test",
        members: {
          create: test_users.map((tu) => ({
            userId: tu.id,
          })),
        },
      },
    });
  });
  it("server is set up before each", async () => {
    const groupCount = await prisma.group.count();
    const userCount = await prisma.user.count();

    expect(groupCount).toBe(1);
    expect(userCount).toBe(test_user_amt);
    const group = await prisma.group.findUnique({
      where: { id: test_group.id },
    });
    expect(group).toBeTruthy();
    for (let i = 0; i < test_user_amt; i++) {
      const user = await prisma.user.findUnique({
        where: { id: test_users[i].id },
      });
      expect(user).toBeTruthy();
    }
  });
  it("split expense equally no remainder", async () => {
    await request(app)
      .post(`/group/${test_group.id}/expense`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "test_expense",
        category: "test",
        amount: 3,
        payerId: test_users[0].id,
        splitType: "equal",
        splits: test_users.map((tu) => ({
          userId: tu.id,
        })),
      })
      .expect(200);

    const expenses = await prisma.expense.findMany();
    expect(expenses).toHaveLength(1);

    const expense_splits = await prisma.expenseSplit.findMany();
    expect(expense_splits).toHaveLength(3);
    expect(expense_splits).toEqual(
      expect.arrayContaining(
        test_users.map((tu) =>
          expect.objectContaining({
            userId: tu.id,
            amount: 1,
          }),
        ),
      ),
    );
  });
});
