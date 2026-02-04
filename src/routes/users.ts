import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import prisma from "../db.js";
import { authenticate } from "./middleware/auth.js";

const user = Router({ mergeParams: true });

// Create new user
user.post("/", async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ error: "Bad format for user" });
  }
  if (!email.includes("@")) {
    res.status(400).json({ error: "Invalid email" });
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
      include: { groups: true },
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
    const users = await prisma.user.findMany();
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
      include: { groups: true },
    });
  } else {
    res.status(400).json({ error: "Must provide id" });
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
  });

  res.status(201).json(updatedUser);
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
  });
  res.json(deletedUser);
});

export default user;
