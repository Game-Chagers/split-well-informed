import { Prisma } from "@prisma/client";
import { Request, Response, Router } from "express";
import prisma from "../db.js";
import { verify_group } from "./middleware/auth.js";

const group = Router({ mergeParams: true });

//??
async function findUserByEmailOrID(id?: string, email?: string) {
  try {
    let user = null;
    if (id) {
      user = await prisma.user.findUnique({ where: { id: id } });
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
// Create new group
group.post("/", async (req: Request, res: Response) => {
  if (!req.body || !req.body.name) {
    res.status(400).json({ error: "Bad Request" });
    return;
  }
  const members = req.body.members ?? [];

  const user_join = members.map(
    (member: { name?: string; email?: string; id?: number }) => {
      if (member.id != undefined) {
        // should fail completely on connected records were not found.
        // Unknown id in request means problem
        return {
          user: {
            connect: { id: member.id },
          },
        };
      } else if (member.email) {
        return {
          user: {
            connectOrCreate: {
              where: { email: member.email },
              create: {
                name: member.name ?? member.email.split("@")[0],
                email: member.email,
                isGuest: true,
              },
            },
          },
        };
      } else if (member.name) {
        return {
          user: {
            create: { name: member.name, isGuest: true },
          },
        };
      }
    },
  );
  try {
    const newGroup = await prisma.group.create({
      data: {
        name: req.body.name,
        members: {
          create: [
            { user: { connect: { id: (req as any).userId } } },
            ...user_join,
          ],
        },
      },
      include: {
        members: { include: { user: true } },
      },
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025")
        return res
          .status(404)
          .json({ error: "One or more users could not be found." });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all groups  // change to get all groups for user?
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
group.get("/:groupId", verify_group, async (req: Request, res: Response) => {
  try {
    const groupId = (req as any).groupId;

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
group.post(
  "/:groupId/member",
  verify_group,
  async (req: Request, res: Response) => {
    try {
      const groupId = req.params.groupId;
      const { userId, email } = req.body;

      const user = await findUserByEmailOrID(userId, email);
      if (!user) {
        return res
          .status(400)
          .json({ error: "User not found, must provide either ID or email" });
      }

      const existingMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: groupId,
          },
        },
      });

      if (existingMember) {
        return res
          .status(400)
          .json({ error: "User is already a member of this group" });
      }

      const updatedGroup = await prisma.group.update({
        where: { id: groupId },
        data: {
          members: {
            create: {
              userId: user.id,
            },
          },
        },
      });

      res.json(updatedGroup);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error as Error });
    }
  },
);

// Remove member from group
group.delete(
  "/:groupId/member/:userId",
  verify_group,
  async (req: Request, res: Response) => {
    const groupId = (req as any).groupId;
    const del_user = req.params.userId;
    try {
      const groupMember = await prisma.groupMember.delete({
        where: {
          userId_groupId: {
            userId: del_user,
            groupId: groupId,
          },
        },
      });
      res.json(groupMember);
    } catch (error) {
      console.error(error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025")
          return res.status(404).json({
            error: "The member of the group was not found could not be found.",
          });
      }
      res.status(500).json({ error: error as Error });
    }
  },
);

export default group;
