import { NextFunction, Request, Response, Router } from "express";
import prisma from "../db.js";
import { Decimal } from "@prisma/client/runtime/library";
import { authenticate } from "./middleware/auth.js";

const payment = Router({ mergeParams: true });

const verify_payment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const paymentId = req.params.paymentId;
  const groupId = req.params.groupId;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, groupId: groupId },
  });

  if (!payment) {
    return res.status(404).json("Payment not found");
  }
  
  (req as any).paymentId = paymentId;
  next();
};

// Calculate base, un-simplified payments
async function calculateBasePayments(groupId: string) {
  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId },
    include: { splits: true },
  });

  await prisma.payment.deleteMany({
    where: { groupId: groupId, settled: true },
  });

  const edges: Map<string, any> = new Map([]);
  for (const { payerId, splits } of expenses) {
    for (const split of splits) {
      if (split.userId === payerId) continue;

      const index = [split.userId, payerId].sort().join("-");
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
        if (payment.receiverId === payerId)
          payment.amount = payment.amount.plus(split.amount);
        else payment.amount = payment.amount.minus(split.amount);

        if (payment.amount.isNegative()) {
          payment.senderId = split.userId;
          payment.receiverId = payerId;
          payment.amount = payment.amount.negated();
        }
        if (payment.amount.isZero()) edges.delete(index);
        else edges.set(index, payment);
      }
    }
  }

  const payments = await prisma.payment.findMany({
    where: { groupId: groupId },
  });
  for (const pay of payments) {
    const index = [pay.receiverId, pay.senderId].sort().join("-");
    if (edges.has(index)) {
      const edge = edges.get(index);
      if (edge.receiverId === pay.receiverId)
        edge.amount = edge.amount.minus(pay.amount);
      else edge.amount = edge.amount.plus(pay.amount);

      if (edge.amount.isNegative()) {
        edge.senderId = pay.senderId;
        edge.receiverId = pay.receiverId;
        edge.amount = edge.amount.negated();
      }
      if (edge.amount.isZero()) edges.delete(index);
      else edges.set(index, edge);
    }
  }

  await prisma.payment.createMany({
    data: Array.from(edges.values()),
  });

  const allPayments = await prisma.payment.findMany({
    where: { groupId: groupId },
  });

  return allPayments;
}

async function simplifyPayments(groupId: string) {
  const basePayments = await prisma.payment.findMany({
    where: {
      groupId: groupId,
      settled: false,
    },
  });

  const balances: Map<string, Decimal> = new Map([]);

  for (const payment of basePayments) {
    const senderBalance = balances.get(payment.senderId) ?? new Decimal(0);
    const receiverBalance = balances.get(payment.receiverId) ?? new Decimal(0);

    balances.set(payment.senderId, senderBalance.minus(payment.amount));
    balances.set(payment.receiverId, receiverBalance.plus(payment.amount));
  }

  let balanceArray = Array.from(balances.entries())
    .map(([userId, amount]) => ({ userId, amount }))
    .filter((b) => !b.amount.isZero());

  const simplifiedPayments = [];

  while (balanceArray.length > 0) {
    balanceArray.sort((a, b) => a.amount.comparedTo(b.amount));

    const sender = balanceArray[0];
    const receiver = balanceArray[balanceArray.length - 1];

    const settlementAmount = Decimal.min(
      sender.amount.abs(),
      receiver.amount.abs(),
    );

    simplifiedPayments.push({
      amount: settlementAmount,
      settled: false,
      groupId: groupId,
      senderId: sender.userId,
      receiverId: receiver.userId,
    });

    sender.amount = sender.amount.plus(settlementAmount);
    receiver.amount = receiver.amount.minus(settlementAmount);

    balanceArray = balanceArray.filter((b) => !b.amount.isZero());
  }

  await prisma.payment.deleteMany({
    where: {
      groupId: groupId,
      settled: false,
    },
  });

  await prisma.payment.createMany({
    data: simplifiedPayments,
  });

  const allPayments = await prisma.payment.findMany({
    where: {
      groupId: groupId,
    },
  });

  return allPayments;
}

// Calculate and get payments
payment.get("/", authenticate, async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { simplifyPayments: true },
  });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  const simplified = group.simplifyPayments;

  const basePayments = await calculateBasePayments(groupId);
  if (simplified) {
    const simplifiedPayments = await simplifyPayments(groupId);
    return res.status(200).json(simplifiedPayments);
  }
  res.status(200).json(basePayments);
});

payment.post(
  "/settle/:paymentId",
  authenticate,
  verify_payment,
  async (req: Request, res: Response) => {
    try {
      const updatedPayment = await prisma.payment.update({
        where: { id: (req as any).paymentId },
        data: { settled: true },
      });
      res.status(200).json(updatedPayment);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

export default payment;
