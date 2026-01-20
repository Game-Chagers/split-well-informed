import cookieParser from 'cookie-parser';
import cors from 'cors'; // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import express from 'express'; // Allows creating paths for API
import group from './routes/group.js';

const app = express();
// Allow JSON data to be sent to server
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use('/group', group)
app.use('/user', group)

export default app;