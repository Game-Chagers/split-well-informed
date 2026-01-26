import { User } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import prisma from "../db.js";
import clear_columns from "./clear.js";

// call create group and ensure a
// Group is created along with a group member and connects a user
describe("login process", async () => {
  beforeEach(async () => {
    await clear_columns(prisma);
  });
  it("creates user and logs in as user and update account to test auth", async () => {
    await request(app)
      .post("/user")
      .send({
        name: "user_test_user",
        email: "user_test_user@email.com",
        password: "password",
      })
      .expect(201);

    const res = await request(app).post("/login").send({
      email: "user_test_user@email.com",
      password: "password",
    });

    await request(app)
      .patch("/user")
      .set("Authorization", `Bearer ${res.body.token}`)
      .send({
        name: "update_test_user",
      })
      .expect(201);
  });
  it("claim account", async () => {
    await request(app)
      .post("/group")
      .send({
        name: "user_test_group",
        members: [
          { email: "test_member1@email.com" },
          { name: "test_member2", email: "test_member2@email.com" },
        ],
      });

    await request(app)
      .post("/user")
      .send({
        name: "test_member1",
        email: "test_member1@email.com",
        password: "password",
      })
      .expect(201)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            name: "test_member1",
            email: "test_member1@email.com",
            isGuest: false,
          }),
        );
      });

    await request(app)
      .post("/user")
      .send({
        name: "test_member_created2",
        email: "test_member2@email.com",
        password: "password",
      })
      .expect(201)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            name: "test_member_created2",
            email: "test_member2@email.com",
            isGuest: false,
          }),
        );
      });
  });
});
describe("/user.post", async () => {
  beforeEach(async () => {
    await clear_columns(prisma);
  });
  it("user.post success", async () => {
    await request(app)
      .post("/user")
      .send({
        name: "user_test_user",
        email: "user_test_user@email.com",
        password: "password",
      })
      .expect(201);

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    const user = users[0];
    expect(user).toEqual(
      expect.objectContaining({
        name: "user_test_user",
        email: "user_test_user@email.com",
        isGuest: false,
      }),
    );
    expect(user.password).not.toBe("password");
  });
  it("user.post failure", async () => {
    await request(app)
      .post("/user")
      .send({
        name: "user_test_user",
        email: "user_test_user@email.com",
      })
      .expect(400);
    await request(app)
      .post("/user")
      .send({
        name: "user_test_user",
        email: "user_test_user",
        password: "password",
      })
      .expect(400);
  });
});

describe("/user", async () => {
  let test_user: User;
  beforeEach(async () => {
    await clear_columns(prisma);
    test_user = await prisma.user.create({
      data: {
        name: "user_test_user",
        email: "user_test_user@email.com",
        isGuest: true,
      },
    });
  });
  it("user.get", async () => {
    await request(app)
      .get(`/user?email=${test_user.email}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            name: "user_test_user",
            email: "user_test_user@email.com",
            isGuest: true,
          }),
        );
      });
    await request(app)
      .get("/user?email=doesnt_exist@email.com")
      .send()
      .expect(404);
  });
  it("user/:userId.get", async () => {
    await request(app)
      .get(`/user/${test_user.id}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            name: "user_test_user",
            email: "user_test_user@email.com",
            isGuest: true,
          }),
        );
      });
    await request(app).get("/user/0000-0000").send().expect(404);
  });
  it("/user/:userId.patch", async () => {
    const token = jwt.sign(
      { userId: test_user.id },
      process.env.JWT_SECRET || "needs a fallback secret ig",
    );
    const res = await request(app)
      .patch(`/user`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "test_user_changed",
      })
      .expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        name: "test_user_changed",
        email: "user_test_user@email.com",
        isGuest: true,
      }),
    );
  });
});
