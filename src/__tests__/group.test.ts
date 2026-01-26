import { User } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";

import clear_columns from "./clear.js";

// call create group and ensure a
// Group is created along with a group member and connects a user

describe("/group.post", async () => {
  let test_user: User;
  let token: string;
  beforeEach(async () => {
    await clear_columns(prisma);
    test_user = await prisma.user.create({
      data: {
        name: "group_test_user",
        email: "group_test_user@email.com",
        isGuest: false,
      },
    });
    token = jwt.sign(
      { userId: test_user.id },
      process.env.JWT_SECRET || "needs a fallback secret ig",
    );
  });
  it("test for creating many to many relations", async () => {
    const newGroup = await prisma.group.create({
      data: {
        name: "many to many group",
        members: {
          create: [
            { user: { connect: { id: test_user.id } } },
            {
              user: {
                connectOrCreate: {
                  where: { email: "email@email.com" },
                  create: { name: "email", email: "email@email.com" },
                },
              },
            },
          ],
        },
      },
      include: {
        members: { include: { user: true } },
      },
    });
    expect(newGroup).toEqual(
      expect.objectContaining({
        name: "many to many group",
        members: [
          expect.objectContaining({
            user: expect.objectContaining({
              name: test_user.name,
              email: test_user.email,
              id: test_user.id,
            }),
          }),
          expect.objectContaining({
            user: expect.objectContaining({
              name: "email",
              email: "email@email.com",
            }),
          }),
        ],
      }),
    );
  });
  it("creates group without auth", async () => {
    const res = await request(app)
      .post("/group")
      .send({
        name: "group_test_name",
      })
      .expect(401);

    const group = await prisma.group.findFirst({
      where: { name: "group_test_name" },
    });
    expect(group).toBeNull();
  });
  it("creates group with no added members", async () => {
    const res = await request(app)
      .post("/group")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "group_test_name",
      })
      .expect("Content-Type", /json/)
      .expect(201);

    const new_group = await prisma.group.findUnique({
      where: { id: res.body.id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    expect(new_group).toEqual(
      expect.objectContaining({
        name: "group_test_name",
        members: [
          expect.objectContaining({
            user: expect.objectContaining({ id: test_user.id }),
          }),
        ],
      }),
    );
  });
  it("creates group with members without connected users", async () => {
    const res = await request(app)
      .post("/group")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "group_test_name",
        members: [
          { name: "test-user1" },
          { name: "test-user2", email: "test-user2@email.com" },
          { email: "test-user3@email.com" },
        ],
      })
      .expect("Content-Type", /json/)
      .expect(201);

    const new_group = await prisma.group.findUnique({
      where: { id: res.body.id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
    const res_obj_form = expect.objectContaining({
      name: "group_test_name",
      members: expect.arrayContaining([
        expect.objectContaining({ userId: test_user.id }),
        expect.objectContaining({
          user: expect.objectContaining({ name: "test-user1", isGuest: true }),
        }),
        expect.objectContaining({
          user: expect.objectContaining({
            name: "test-user2",
            email: "test-user2@email.com",
            isGuest: true,
          }),
        }),
        expect.objectContaining({
          user: expect.objectContaining({
            name: "test-user3",
            email: "test-user3@email.com",
            isGuest: true,
          }),
        }),
      ]),
    });
    expect(new_group).toEqual(res_obj_form);
    expect(res.body).toEqual(res_obj_form);
  });
  it("creates group with an unconnected id", async () => {
    const res = await request(app)
      .post("/group")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "group_test_name",
        members: [{ id: "0000-0000" }],
      })
      .expect("Content-Type", /json/)
      .expect(404);

    const group = await prisma.group.findFirst({
      where: { name: "group_test_name" },
    });
    expect(group).toBeNull();
  });
  it("creates group with connected id", async () => {
    const test_user_connected = await prisma.user.create({
      data: {
        name: "test_user_connected",
        email: "test_user_connected@email.com",
      },
    });
    const res = await request(app)
      .post("/group")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "group_test_name",
        members: [{ id: test_user_connected.id }],
      })
      .expect("Content-Type", /json/)
      .expect(201);

    const new_group = await prisma.group.findUnique({
      where: { id: res.body.id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    expect(new_group).toEqual(
      expect.objectContaining({
        name: "group_test_name",
        members: expect.arrayContaining([
          expect.objectContaining({ userId: test_user.id }),
          expect.objectContaining({
            user: expect.objectContaining({
              name: "test_user_connected",
              email: "test_user_connected@email.com",
              id: test_user_connected.id,
            }),
          }),
        ]),
      }),
    );
  });
});
