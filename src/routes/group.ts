import { Request, Response, Router } from "express";
import prisma from "../db.js";

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
    const groupId = parseInt(req.params.groupId);
    const { userId, email } = req.body;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      return res.status(404).json({ error: `Group with ID ${groupId} not found` });
    }

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
});

// Remove member from group
group.delete(
  "/:groupId/members/:userId",
  async (req: Request, res: Response) => {
    try {
      const groupId = parseInt(req.params.groupId);
      let userId = parseInt(req.params.groupId);
      const { email } = req.body;

      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });
      if (!group) {
        return res
          .status(404)
          .json({ error: `Group with ID ${groupId} not found` });
      }

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
  }
);

// Expense body structure
// {
//   description: "Description",
//   category: "Food",
//   amount: 70,
//   payerId: 2,
//   splitType: "custom",  // or "equal" or "percent"
//   splits: [
//     { userId: 1, amount: 60 }, // Percent or specific amount
//     { userId: 2, amount: 30 },
//     { userId: 3, amount: 10 },
//   ]
// }

// Add expense to group
group.post("/:groupId/expenses", async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { description, category, amount, payerId, splitType, splits } =
      req.body;

    if (!description || !amount || !payerId || !splits || splits.length == 0) {
      return res
        .status(400)
        .json({ error: "Missing one or more required fields" });
    }

    const payerInGroup = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId: payerId,
          groupId: groupId,
        },
      },
    });
    if (!payerInGroup) {
      return res
        .status(400)
        .json({ error: "Payer not a member of this group" });
    }

    const usersInSplit = splits.map((split: any) => split.userId);
    const membersInGroup = await prisma.groupMember.findMany({
      where: {
        groupId: groupId,
        userId: { in: usersInSplit },
      },
    });
    if (usersInSplit.length !== membersInGroup.length) {
      return res
        .status(400)
        .json({ error: "All participants of split must be in the group" });
    }

    let splitsToAdd;
    const amountCents = Math.round(amount * 100);

    // Equal split
    if (splitType == "equal") {
      const baseSplitCents = Math.floor(amountCents / usersInSplit.length);
      let remainder = amountCents % usersInSplit.length;

      splitsToAdd = splits.map((split: any, index: number) => {
        let splitCents = baseSplitCents;
        if (remainder > 0) {
          splitCents += 1;
          remainder -= 1;
        }
        return {
          userId: split.userId,
          amount: splitCents / 100,
        };
      });
    }

    // Percentage split
    else if (splitType == "percent") {
      const totalPercent = splits.reduce(
        (sum: number, split: any) => sum + split.amount
      );
      if (totalPercent != 100) {
        return res.status(400).json({
          error: `Percent splits sum ${totalPercent} not equal to 100%`,
        });
      }

      const splitsCents = splits.map((split: any) => ({
        userId: split.userId,
        cents: Math.floor((amountCents * split.amount) / 100),
      }));
      const totalAssigned = splitsCents.reduce(
        (sum: number, split: any) => sum + split.cents
      );
      let remainder = amountCents - totalAssigned;

      splitsToAdd = splitsCents.map((split: any, index: number) => {
        let finalSplit = split.cents;
        if (index < remainder) {
          finalSplit += 1;
          remainder -= 1;
        }
        return {
          userId: split.userId,
          amount: finalSplit / 100,
        };
      });
    }

    // Custom amount split
    else if (splitType == "custom") {
      const totalAssigned = splits.reduce(
        (sum: number, split: any) => sum + split.amount
      );
      if (totalAssigned != amount) {
        return res.status(400).json({
          error: `Cutsom split total ${totalAssigned} not equal to total expense cost ${amount}`,
        });
      }

      splitsToAdd = splits.map((split: any) => ({
        userId: split.userId,
        amount: split.amount,
      }));
    } else {
      return res.status(400).json({
        error: `Split type ${splitType} invalid. Valid options: "equal", "percent", "custom"`,
      });
    }

    const newExpense = await prisma.expense.create({
      data: {
        description: description,
        category: category,
        amount: amount,
        payerId: payerId,
        groupId: groupId,
        splits: {
          create: splitsToAdd,
        },
      },
      include: {
        payer: true,
        splits: { include: { user: true } },
      },
    });

    res.json(newExpense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error as Error });
  }
});

// Delete expense
group.delete(
  "/:groupId/expenses/:expenseId",
  async (req: Request, res: Response) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const expenseId = parseInt(req.params.expenseId);

      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
      });
      if (!expense) {
        return res
          .status(404)
          .json({ error: `Expense with id ${expenseId} not found` });
      } else if (expense.groupId != groupId) {
        return res.status(400).json({
          error: `Expense id ${expenseId} does not belong to group id ${groupId} `,
        });
      }

      const deletedExpense = await prisma.expense.delete({
        where: { id: expenseId },
      });
      res.json(deletedExpense);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error as Error });
    }
  }
);

// Get all expenses from group
group.get("/:groupId/expenses", async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const expenses = await prisma.group.findUnique({
      where: { id: groupId },
      include: { expenses: true },
    }).expenses;
    res.json(expenses);
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
