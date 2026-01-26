import { Request, Response, Router } from "express";
import prisma from "../db.js";
import { verify_expense } from "./middleware/auth.js";

// Expense body structure
// {
//   description: "Description",
//   category: "Food",
//   amount: 70,
//   payerId: 2,
//   splitType: "custom",  // or "equal" or "percent"
//   splits: [
//     { userId: 1, amount: 60 }, // Percent or specific amount
//     { userId: 2, amount: 30 },
//     { userId: 3, amount: 10 },
//   ]
// }

const expense = Router({ mergeParams: true });

// Add expense to group
expense.post("/expense", async (req: Request, res: Response) => {
  try {
    const groupId = (req as any).groupId;
    const { description, category, amount, payerId, splitType, splits } =
      req.body;

    if (!description || !amount || !payerId || !splits || splits.length === 0) {
      return res
        .status(400)
        .json({ error: "Missing one or more required fields" });
    }

    //checks for users specified in split
    const usersInSplit = splits.map((split: any) => split.userId);
    const membersInGroup = await prisma.groupMember.findMany({
      where: {
        groupId: groupId,
        userId: { in: usersInSplit },
      },
    });
    if (usersInSplit.length !== membersInGroup.length) {
      return res
        .status(400)
        .json({ error: "All participants of split must be in the group" });
    }

    let splitsToAdd;
    const amountCents = Math.round(amount * 100);

    // Equal split
    if (splitType == "equal") {
      const baseSplitCents = Math.floor(amountCents / usersInSplit.length);
      let remainder = amountCents % usersInSplit.length;

      splitsToAdd = splits.map((split: any, index: number) => {
        let splitCents = baseSplitCents;
        if (remainder > 0) {
          splitCents += 1;
          remainder -= 1;
        }
        return {
          userId: split.userId,
          amount: splitCents / 100,
        };
      });
    }

    // Percentage split
    else if (splitType == "percent") {
      const totalPercent = splits.reduce(
        (sum: number, split: any) => sum + split.amount,
      );
      if (totalPercent != 100) {
        return res.status(400).json({
          error: `Percent splits sum ${totalPercent} not equal to 100%`,
        });
      }

      const splitsCents = splits.map((split: any) => ({
        userId: split.userId,
        cents: Math.floor((amountCents * split.amount) / 100),
      }));
      const totalAssigned = splitsCents.reduce(
        (sum: number, split: any) => sum + split.cents,
      );
      let remainder = amountCents - totalAssigned;

      splitsToAdd = splitsCents.map((split: any, index: number) => {
        let finalSplit = split.cents;
        if (index < remainder) {
          finalSplit += 1;
          remainder -= 1;
        }
        return {
          userId: split.userId,
          amount: finalSplit / 100,
        };
      });
    }

    // Custom amount split
    else if (splitType == "custom") {
      const totalAssigned = splits.reduce(
        (sum: number, split: any) => sum + split.amount,
      );
      if (totalAssigned != amount) {
        return res.status(400).json({
          error: `Cutsom split total ${totalAssigned} not equal to total expense cost ${amount}`,
        });
      }

      splitsToAdd = splits.map((split: any) => ({
        userId: split.userId,
        amount: split.amount,
      }));
    } else {
      return res.status(400).json({
        error: `Split type ${splitType} invalid. Valid options: "equal", "percent", "custom"`,
      });
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
          create: splitsToAdd,
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
});

// Delete expense
expense.delete(
  "/expense/:expenseId",
  verify_expense,
  async (req: Request, res: Response) => {
    try {
      const expenseId = (req as any).expense;

      const deletedExpense = await prisma.expense.delete({
        where: { id: expenseId },
      });
      res.json(deletedExpense);
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

export default expense;
