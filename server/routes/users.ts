import { Request, Response, Router } from 'express';
import { prisma } from '../db';

const router = Router();

// Create new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { newEmail, newName } = req.body;

    if (!newEmail.includes('@')) {
      res.status(400).json({ error: 'Invalid email' });
    }

    const newUser = await prisma.user.create({
      data: { email: newEmail, name: newName },
    });
    res.json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific user by id or email
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { id, email } = req.query;

    if (!email || !(email as string).includes('@')) {
      res.status(400).json({ error: 'Invalid email' });
    }

    let user;

    if (id) {
      user = await prisma.user.findUnique({
        where: { id: parseInt(id as string) },
        include: { groups: true },
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: { email: email as string },
        include: { groups: true },
      });
    } else {
      res.status(400).json({ error: 'Must provide id or email' });
    }

    if (!user) {
      res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Claim guest account
router.post('/claim-account', async (req: Request, res: Response) => {
  try {
    const { userId, email } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        isGuest: false,
      }
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router; 