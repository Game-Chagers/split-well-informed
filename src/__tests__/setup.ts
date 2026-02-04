import { Expense, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../db.js";

export async function create_group(user_cnt: number) {
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

export async function create_payments(
  users: User[],
  groupId: string,
  expenses: {
    amount: number;
    payerIndex: number;
    splits: { amount: number; userIndex: number }[];
  }[],
) {
  return await Promise.all(
    expenses.map(
      (exp): Promise<Expense> =>
        prisma.expense.create({
          data: {
            description: "For testing of /expense",
            category: "test",
            amount: exp.amount,
            payerId: users[exp.payerIndex].id,
            groupId: groupId,
            splits: {
              create: exp.splits.map((s: any) => ({
                userId: users[s.userIndex].id,
                amount: s.amount,
              })) as any,
            },
          },
        }),
    ),
  );
}
