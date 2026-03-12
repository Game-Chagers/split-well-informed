import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import prisma from "../db.js";
import { authenticate } from "./middleware/auth.js";

const user = Router({ mergeParams: true });

// Create new user
user.post("/", async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: "Bad format for user" });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.upsert({
    where: { email },
    update: { name, password: hashedPassword, isGuest: false },
    create: {
      email,
      name,
      password: hashedPassword,
      isGuest: false,
    },
  });
  const { password: _, ...userWithoutPassword } = newUser;
  res.status(201).json(userWithoutPassword);
});

// Get all users or search by email
user.get("/", async (req: Request, res: Response) => {
  // Search by email if email query given
  const email = req.query.email;
  if (email) {
    if (!(email as string).includes("@")) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    const user = await prisma.user.findUnique({
      where: { email: email as string },
      select: {
        id: true,
        email: true,
        name: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
        groups: true,
       },
    });
    if (!user) {
      return res
        .status(404)
        .json({ error: `User with email ${email} not found` });
    } else {
      return res.json(user);
    }
  }

  // Get all users
  else {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
        groups: true,
      }
    });
    res.json(users);
  }
});

// Get specific user by id
user.get("/:userId", async (req: Request, res: Response) => {
  const userId = req.params.userId;
  let user;

  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
        groups: true,
      },
    });
  } else {
    return res.status(400).json({ error: "Must provide id" });
  }

  if (!user) {
    res.status(404).json({ error: `User with ID ${userId} not found` });
  } else {
    res.json(user);
  }
});

// Update account
user.patch("/", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, email } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      email: email,
      name: name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isGuest: true,
      createdAt: true,
      updatedAt: true,
      groups: true,
    }
  });

  res.status(200).json(updatedUser);
});

// Delete user
user.delete("/", authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    return res.status(404).json({ error: `User with ID ${userId} not found` });
  }

  const deletedUser = await prisma.user.delete({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
  res.json(deletedUser);
});

export default user;
