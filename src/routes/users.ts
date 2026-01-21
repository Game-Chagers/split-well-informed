import { Request, Response, Router } from "express";
import prisma from "../db.js";

const user = Router();

// Create new user
user.post("/", async (req: Request, res: Response) => {
  try {
    const { newEmail, newName } = req.body;

    if (!newEmail.includes("@")) {
      res.status(400).json({ error: "Invalid email" });
    }

    const newUser = await prisma.user.create({
      data: { email: newEmail, name: newName, isGuest: false },
    });
    res.json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all users or search by email
user.get("/", async (req: Request, res: Response) => {
  try {
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
        return res.status(404).json({ error: `User with email ${email} not found` });
      } else {
        return res.json(user);
      }
    }

    // Get all users
    else {
      const users = await prisma.user.findMany();
      res.json(users);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific user by id
user.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    let user;

    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { groups: true },
      });
    } else {
      res.status(400).json({ error: "Must provide id or email" });
    }

    if (!user) {
      res.status(404).json({ error: `User with ID ${userId} not found` });
    } else {
      res.json(user);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update account (including claiming guest account)
user.patch("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { name, email, isGuest } = req.body;

    if (!userId || userId.trim() == '') {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (email && !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ error: `User with ID ${userId} not found` });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email,
        name: name,
        isGuest: isGuest,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete user
user.delete("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: `User with ID ${userId} not found` });
    }

    const deletedUser = await prisma.user.delete({
      where: { id: userId },
    });
    res.json(deletedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
});

export default user;
