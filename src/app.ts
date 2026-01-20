import cookieParser from 'cookie-parser';
import cors from 'cors'; // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import express from 'express'; // Allows creating paths for API
import group from './routes/group.js';
import user from './routes/users.js';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use("/group", group);
app.use("/user", user);

export default app;
