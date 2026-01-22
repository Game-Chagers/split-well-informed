import cors from "cors"; // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import express from "express"; // Allows creating paths for API
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

export default app;
