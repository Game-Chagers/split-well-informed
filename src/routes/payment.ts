import { Prisma } from "@prisma/client";
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

export interface pay {
  amount: Prisma.Decimal;
  senderId: string;
  receiverId: string;
}
const agg_pay = (pay1: pay, pay2: pay): pay => {
  if (pay1.senderId === pay2.senderId && pay1.receiverId === pay2.receiverId) {
    return {
      amount: pay1.amount.plus(pay2.amount),
      senderId: pay1.senderId,
      receiverId: pay1.receiverId,
    };
  } else if (
    pay1.senderId === pay2.receiverId &&
    pay1.receiverId === pay2.senderId
  ) {
    const pay1gtpay2 = pay1.amount.gt(pay2.amount);
    return {
      amount: pay1gtpay2
        ? pay1.amount.minus(pay2.amount)
        : pay2.amount.minus(pay1.amount),
      senderId: pay1gtpay2 ? pay1.senderId : pay2.senderId,
      receiverId: pay1gtpay2 ? pay1.receiverId : pay2.receiverId,
    };
  } else return {} as pay;
};

payment.get("/generate", async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
  const expenses = await prisma.expense.findMany({
    where: { groupId: groupId },
    include: { splits: true },
  });
  await prisma.payment.deleteMany({
    where: { groupId: groupId, settled: false },
  });
  const new_payments: Map<string, any> = new Map([]);
  for (const { payerId, splits } of expenses) {
    for (const split of splits) {
      if (split.userId === payerId) continue;
      const index = [split.userId, payerId].sort().join("-");
      if (!new_payments.has(index)) {
        new_payments.set(index, {
          amount: split.amount,
          groupId: groupId,
          settled: false,
          senderId: split.userId,
          receiverId: payerId,
        });
      } else {
        const payment: pay = {
          ...new_payments.get(index),
          ...agg_pay(new_payments.get(index), {
            amount: split.amount,
            senderId: split.userId,
            receiverId: payerId,
          }),
        };
        if (payment.amount.isZero()) new_payments.delete(index);
        else new_payments.set(index, payment);
      }
    }
  }
  const payments = await prisma.payment.findMany({
    where: { groupId: groupId },
  });
  for (const settled of payments) {
    const index = [settled.receiverId, settled.senderId].sort().join("-");
    if (new_payments.has(index)) {
      const payment: pay = agg_pay(new_payments.get(index), {
        ...settled,
        senderId: settled.receiverId,
        receiverId: settled.senderId,
      });
      if (payment.amount.isZero()) new_payments.delete(index);
      else new_payments.set(index, payment);
    }
  }
  try {
    await prisma.payment.createMany({
      data: Array.from(new_payments.values()),
    });
  } catch (e) {
    console.error(e);
  }
  const all_payments = await prisma.payment.findMany({
    where: { groupId: groupId },
  });
  res.status(200).json(all_payments);
});

payment.get("/split", async (req: Request, res: Response) => {
  const groupId = (req as any).groupId;
  const payments = await prisma.payment.findMany({
    where: { groupId: groupId, settled: false },
  });
});

export default payment;
