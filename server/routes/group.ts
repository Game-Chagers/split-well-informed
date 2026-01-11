import { Request, Response, Router } from "express";
import { prisma } from "../db";

const group = Router();

// interface create_group {
//     name: string;
//     members: string[];
//     tentativeMem: string[];
// }
// group.post('/', (req: Request, res: Response) => {
//     const g: create_group = req.body
//     const members = g.members.map(id => { connect: { id } })
//     members.concat(g.tentativeMem.map(name => { name }))
//     console.log(members)
//     const created_group = prisma.Group.create({
//         data: {
//             name: g.name,
//             members: {
//                 createMany: {
//                     data: members
//                 }
//             }
//         },
//     })
//     console.log(created_group)
//     res.json()
// })

// Intended members structure:
// members: [
//     { name: "Name", email: "name@email.com", id: "ID" },   // Registered member
//     { name: "GuestName", email: "", id: "" },              // Guest member
// ]

group.post("/new-group", async (req: Request, res: Response) => {
  try {
    const { name, members } = req.body;

    const userIds = await Promise.all(
      members.map(async (member: { name: string, email?: string, id?: string }) => {
        let user;
        
        // Try to find existing user by email
        if (member.email) {
          user = await prisma.user.findUnique({ where: { email: member.email }});
          if (!user) {
            console.error( {message: `User with email ${member.email} not found`});
            throw new Error(`User with email ${member.email} not found`);
          }
        }

        // Try to find existing user by ID
        else if (member.id) {
          user = await prisma.user.findUnique({ where: { id: parseInt(member.id) } });
          if (!user) {
            console.error({ message: `User with ID ${member.id} not found` });
            throw new Error(`User with ID ${member.id} not found`);
          }
        }

        // Create guest user
        else {
          user = await prisma.user.create({ data: { name: member.name, isGuest: true } });
        }

        return user.id;
      })
    );

    const newGroup = await prisma.group.create({
      data: {
        name: name,
        members: {
          create: userIds.map(userId => ({ userId }))
        }
      },
      include: {
        members: { include: { user: true } }
      }
    });

    res.json(newGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

group.get("/list-all", async (req: Request, res: Response) => {
  try {
    const groups = prisma.group.findMany({ include: { members: true } });
    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// This must be last (express checks route matches in the order they're defined)
group.get("/:group_id", async (req: Request, res: Response) => {
  try {
    const g = prisma.group.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
      include: {
        members: true,
        expenses: true,
        payments: true,
      }
    });
    res.json(g);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});


group
  .route("/:id/members")
  .get((req: Request, res: Response) => {})
  .post((req: Request, res: Response) => {});
group
  .route("/:id/expenses")
  .get((req: Request, res: Response) => {})
  .post((req: Request, res: Response) => {});
group
  .route("/:id/payments")
  .get((req: Request, res: Response) => {})
  .post((req: Request, res: Response) => {}); 

export default group;
