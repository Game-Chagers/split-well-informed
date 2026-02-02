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
  try {
    const groupId = (req as any).groupId;
    const expenseId = (req as any).expenseId;
    const exp = await prisma.expense.findUnique({
      where: { id: expenseId ?? ("0" as UUID) },
      select: { amount: true, splits: true },
    });
    // combines splits in request with the splits in db that are not include
    const splits = req.body.splits.concat(
      exp?.splits?.filter(
        (prev) =>
          !req.body.splits.find((cur: any) => cur.userId === prev.userId),
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
      (sum: number, split: any) => sum + Number(split.amount),
      0,
    );
    if (totalAssigned !== amount) {
      console.error(
        `400 Split total ${totalAssigned} not equal to total expense cost ${amount}`,
      );
      return res.status(400).json({
        error: `Split total ${totalAssigned} not equal to total expense cost ${amount}`,
      });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
};

// Add expense to group
expense.post(
  "/expense",
  validate_splits,
  async (req: Request, res: Response) => {
    try {
      const groupId = (req as any).groupId;
      const { description, category, amount, payerId, splits } = req.body;
      if (
        !description ||
        !amount ||
        !payerId ||
        !splits ||
        splits.length === 0
      ) {
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
            create: splits,
          },
        },
        include: {
          payer: true,
          splits: { include: { user: true } },
        },
      });

      res.status(201).json(newExpense);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error as Error });
    }
  },
);

expense.patch(
  "/expense/:expenseId",
  verify_expense,
  validate_splits,
  async (req: Request, res: Response) => {
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
      try {
        await Promise.all(promisedSplits);
        await prisma.expenseSplit.deleteMany({
          where: { expenseId: expenseId, amount: 0 },
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error as Error });
      }
    }
    const promisedUpdatedExpense = prisma.expense.update({
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
    try {
      const updatedExpense = await promisedUpdatedExpense;
      res.status(201).json(updatedExpense);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error as Error });
    }
  },
);

// Delete expense
expense.delete(
  "/expense/:expenseId",
  verify_expense,
  async (req: Request, res: Response) => {
    try {
      const expenseId = (req as any).expenseId;

      const deletedExpense = await prisma.expense.delete({
        where: { id: expenseId },
      });
      res.status(201).json(deletedExpense);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error as Error });
    }
  },
);

// Get all expenses from group
expense.get("/expense", async (req: Request, res: Response) => {
  try {
    const groupId = (req as any).groupId;
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { expenses: true },
    });

    res.json(group?.expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
});

expense.get("/expense/payment", async (req: Request, res: Response) => {
  try {
    const groupId = (req as any).groupId;
    const expenses = await prisma.expense.findMany({
      where: { groupId: groupId },
      include: { splits: true },
    });
    const edges: Map<[UUID, UUID], any> = new Map([]);
    for (const { payerId, splits } of expenses) {
      for (const split of splits) {
        if (payerId === split.userId) continue;
        const index = [payerId, split.userId].sort() as [UUID, UUID];
        if (!edges.has(index)) {
          edges.set(index, {
            amount: split.amount,
            groupId: groupId,
            settled: false,
            senderId: split.userId,
            receiverId: payerId,
          });
        } else {
          const payment = edges.get(index);
          if (payment.receiverId !== payerId) {
            if (payment.amount.lt(split.amount)) {
              payment.amount = split.amount.minus(payment.amount);
              payment.senderId = payment.receiverId;
              payment.receiverId = payerId;
            } else payment.amount = payment.amount.minus(split.amount);
          } else payment.amount = payment.amount.plus(split.amount);
          edges.set(index, payment);
        }
      }
    }
    console.log(Array.from(edges.values()));
    const payments = await prisma.payment.createManyAndReturn({
      data: Array.from(edges.values()),
    });
    res.status(200).json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
});
export default expense;
