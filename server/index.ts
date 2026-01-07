// Run server to test: node server/index.js

import express, { Request, Response } from 'express';   // Allows creating paths for API
import cors from 'cors';                                // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Allow JSON data to be sent to server
app.use(express.json());
app.use(cors());

// Create a new user
app.post('/users', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    const newUser = await prisma.user.create({
      data: {
        email: email,
        name: name,
      },
    });
    // Send result back
    res.json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all users
app.get('/users', async (req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});