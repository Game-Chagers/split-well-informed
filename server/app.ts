import cors from 'cors'; // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import express, { Request, Response } from 'express'; // Allows creating paths for API
import { prisma } from './db';
import group from './routes/group';

const app = express();
// Allow JSON data to be sent to server
app.use(express.json());
app.use(cors());
app.use('/group', group)

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

export default app;