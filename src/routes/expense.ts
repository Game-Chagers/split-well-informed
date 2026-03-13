import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { UUID } from "node:crypto";
import prisma from "../db.js";
import { verify_expense } from "./middleware/auth.js";

// Expense body structure
// {
//   description: "Description",
//   category: "Food",
//   amount: 70,
//   payerId: 2,
//   splits: [
//     { userId: 1, amount: 60 },
//     { userId: 2, amount: 30 },
//     { userId: 3, amount: 10 },
//   ]
// }

const expense = Router({ mergeParams: true });

const validate_splits = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const groupId = (req as any).groupId;
  const expenseId = (req as any).expenseId;
  const exp = await prisma.expense.findUnique({
    where: { id: expenseId ?? ("0" as UUID) },
    select: { amount: true, splits: true },
  });
  // combines splits in request with the splits in db that are not include
  const splits = req.body.splits.concat(
    exp?.splits?.filter(
      (prev) => !req.body.splits.find((cur: any) => cur.userId === prev.userId),
    ) ?? [],
  );
  const amount = req.body.amount ?? Number(exp?.amount);

  if (!amount) {
    console.error("400 Amount of money not specified");
    return res.status(400).json({ error: "Amount of money not specified" });
  }
  //checks for users specified in split
  const usersInSplit = splits.map((split: any) => split.userId);
  const membersInGroup = await prisma.groupMember.findMany({
    where: {
      groupId: groupId,
      userId: { in: usersInSplit },
    },
    select: { id: true },
  });
  if (usersInSplit.length !== membersInGroup.length) {
    console.error(`400 All participants of split must be in the group.\n
        There are ${usersInSplit.length - membersInGroup.length} members 
        in your request that are not in the group`);
    return res
      .status(400)
      .json({ error: "All participants of split must be in the group" });
  }
  const totalAssigned = splits.reduce(
    (sum: number, split: any) =>
      split.amount < 0 ? -Infinity : sum + Number(split.amount),
    0,
  );
  if (totalAssigned !== amount) {
    console.error(
      `Split total ${totalAssigned} not equal to total expense cost ${amount}, or invalid split given (<=0)`,
    );
    return res.status(400).json({
      error: `Split total ${totalAssigned} not equal to total expense cost ${amount}`,
    });
  }
  next();
};

// Add expense to group
expense.post("/", validate_splits, async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
  const { description, category, amount, payerId, splits } = req.body;
  if (!description || !amount || !payerId || !splits || splits.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing one or more required fields" });
  }

  // Add expense
  const newExpense = await prisma.expense.create({
    data: {
      description: description,
      category: category,
      amount: amount,
      payerId: payerId,
      groupId: groupId,
      splits: {
        create: splits.filter(
          (s: any) => s.userId !== payerId && s.amount !== 0,
        ),
      },
    },
    include: {
      payer: true,
      splits: true,
    },
  });
  const payer_split = splits.find((s: any) => s.userId === payerId);
  if (payer_split) {
    newExpense.splits.push({
      userId: payer_split.userId,
      amount: Prisma.Decimal(payer_split.amount),
      expenseId: newExpense.id,
      id: "",
    });
  }
  res.status(201).json(newExpense);
});
//going to remov redundant splits
expense.patch(
  "/:expenseId",
  verify_expense,
  validate_splits,
  async (req: Request, res: Response, next: NextFunction) => {
    const expenseId = (req as any).expenseId;
    const { description, category, amount, payerId, splits } = req.body;
    if (splits) {
      const promisedSplits = [];
      for (const s of splits ?? []) {
        promisedSplits.push(
          prisma.expenseSplit.upsert({
            where: {
              userId_expenseId: {
                expenseId: expenseId,
                userId: s.userId,
              },
            },
            update: {
              amount: s.amount,
            },
            create: {
              amount: s.amount,
              userId: s.userId,
              expenseId: expenseId,
            },
          }),
        );
      }
      await Promise.all(promisedSplits);
      await prisma.expenseSplit.deleteMany({
        where: { expenseId: expenseId, amount: 0 },
      });
    }
    const promisedUpdatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        description,
        category,
        amount,
        payerId,
      },
      include: {
        payer: true,
        splits: true,
      },
    });
    const updatedExpense = promisedUpdatedExpense;
    res.status(201).json(updatedExpense);
  },
);

// Delete expense
expense.delete(
  "/:expenseId",
  verify_expense,
  async (req: Request, res: Response) => {
    const expenseId = (req as any).expenseId;

    const deletedExpense = await prisma.expense.delete({
      where: { id: expenseId },
    });
    res.status(201).json(deletedExpense);
  },
);

// Get all expenses from group
expense.get("/", async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { expenses: true },
  });

  res.json(group?.expenses);
});

export default expense;
