import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../db.js";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Extract Bearer <token>

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const secret = process.env.JWT_SECRET || "your_fallback_secret";
    const decoded = jwt.verify(token, secret) as { userId: string };

    (req as any).userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token." });
  }
};

export const verify_group = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = (req as any).userId;
  const groupId = parseInt(req.params.groupId);

  const member = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: {
        userId: userId,
        groupId: groupId,
      },
    },
  });

  if (member === null) {
    if ((await prisma.group.findUnique({ where: { id: groupId } })) === null) {
      return res
        .status(404)
        .json({ error: `Group with ID ${groupId} not found` });
    }
    return res.status(400).json({ error: "User doesn't belong to group" });
  }
  (req as any).groupId = groupId;
  next();
};

export const verify_expense = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = (req as any).userId;
  const groupId = (req as any).groupId;
  const expenseId = parseInt(req.params.expenseId);

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });
  if (!expense) {
    return res
      .status(404)
      .json({ error: `Expense with id ${expenseId} not found` });
  } else if (expense.groupId != groupId) {
    return res.status(400).json({
      error: `Expense id ${expenseId} does not belong to group id ${groupId} `,
    });
  }

  (req as any).expenseId = expenseId;
  next();
};
