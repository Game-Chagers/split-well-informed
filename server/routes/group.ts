import { Request, Response, Router } from "express";
import { prisma } from "../db";

const group = Router();

async function findUserByEmailOrID(id?: string, email?: string) {
  try {
    let user = null;
    if (id) {
      user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
      if (!user) {
        return null;
      }
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email: email } });
      if (!user) {
        return null;
      }
    }
    return user;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

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

// Create new group
group.post("/", async (req: Request, res: Response) => {
  try {
    const { name, members } = req.body;

    const userIds = await Promise.all(
      members.map(
        async (member: { name: string; email?: string; id?: string }) => {
          let user;

          user = await findUserByEmailOrID(member.id, member.email);

          // Create guest user
          if (!user) {
            user = await prisma.user.create({
              data: { name: member.name, isGuest: true },
            });
          }

          return user.id;
        }
      )
    );

    const newGroup = await prisma.group.create({
      data: {
        name: name,
        members: {
          create: userIds.map((userId) => ({ userId })),
        },
      },
      include: {
        members: { include: { user: true } },
      },
    });

    res.json(newGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all groups
group.get("/", async (req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({ include: { members: true } });
    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get specific group
group.get("/:groupId", async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId);

    const group = await prisma.group.findUnique({
      where: {
        id: groupId,
      },
      include: {
        members: true,
        expenses: true,
        payments: true,
      },
    });
    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add member to group
group.post("/:groupId/members", async (req: Request, res: Response) => {
  try {
    const groupId = req.params.groupId;
    const { userId, email } = req.body;

    const user = await findUserByEmailOrID(userId, email);

    if (!user) {
      return res.status(400).json({ error: "Must provide either ID or email" });
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId: user.id,
          groupId: parseInt(groupId),
        },
      },
    });

    if (existingMember) {
      return res
        .status(400)
        .json({ error: "User is already a member of this group" });
    }

    const group = await prisma.group.update({
      where: { id: parseInt(groupId) },
      data: {
        members: {
          create: {
            userId: user.id,
          },
        },
      },
    });

    res.json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
});

// Remove member from group
group.delete("/:groupId/members/:userId", async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId);
    let userId = parseInt(req.params.groupId);
    const { email } = req.body;

    if (isNaN(userId)) {
      if (!email) {
        return res
          .status(400)
          .json({ error: "Must provide valid ID or email" });
      }

      const user = await prisma.user.findUnique({
        where: { email: email },
      });

      if (!user) {
        res.status(400).json({ error: `User with email ${email} not found` });
      } else {
        userId = user.id;
      }
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId: userId,
          groupId: groupId,
        },
      },
    });

    if (!existingMember) {
      return res
        .status(400)
        .json({ error: "User is not a member of this group" });
    }

    const groupMember = await prisma.groupMember.delete({
      where: {
        userId_groupId: {
          userId: userId,
          groupId: groupId,
        },
      },
    });

    res.json(groupMember);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
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
