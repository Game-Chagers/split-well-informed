import { Request, Response, Router } from "express";
import { prisma } from "../db";

const group = Router();

group.get("/:group_id", (req: Request, res: Response) => {
  const g = prisma.Group.findUnique({
    where: {
      id: req.params.id,
    },
  });
  res.json(g);
});

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

group.post("/", async (req: Request, res: Response) => {
  try {
    const { name, members } = req.body;

    const userIds = await Promise.all(
      members.map(async (member: { name: string, email?: string, id?: string }) => {
        let user;
        
        // Try to find existing user by email
        if (member.email) {
          user = await prisma.user.findUnique({ where: { email: member.email }});
          if (!user) {
            user = await prisma.user.create({ data: { name: member.name, email: member.email, isGuest: false } });
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
