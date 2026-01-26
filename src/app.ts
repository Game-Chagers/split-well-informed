import bcrypt from "bcryptjs";
import cors from "cors"; // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import express from "express"; // Allows creating paths for API
import jwt from "jsonwebtoken";
import prisma from "./db.js";
import expense from "./routes/expense.js";
import group from "./routes/group.js";
import { authenticate, verify_group } from "./routes/middleware/auth.js";
import user from "./routes/users.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use("/user", user);
app.use("/group", authenticate, group);
app.use("/group/:groupId", authenticate, verify_group, expense);

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password ?? ""))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Generate token with an expiration
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }, // Token is valid for 7 days
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

export default app;
