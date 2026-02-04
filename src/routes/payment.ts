import { NextFunction, Request, Response, Router } from "express";
import prisma from "../db.js";

const payment = Router({ mergeParams: true });

const verify_payment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const paymentId = req.params.paymentId;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) {
    res.status(404).json("Payment not found");
  }
  (req as any).paymentId = paymentId;
  next();
};

payment.get("/", async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
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
  const all_payments = await prisma.payment.findMany({
    where: { groupId: groupId },
  });
  res.status(200).json(all_payments);
});

payment.post(
  "/settle/:paymentId",
  verify_payment,
  async (req: Request, res: Response) => {
    await prisma.payment.update({
      where: { id: (req as any).paymentId },
      data: { settled: true },
    });
    res.status(201);
  },
);

export default payment;
