// Run server to test: node server/index.js

import express from 'express';   // Allows creating paths for API
import cors from 'cors';         // Adds special HTTP headers to tell browser to allow requests from different domains (our react native expo code)
import userRoutes from './routes/users';
// import groupRoutes from './routes/groups';

const app = express();

// Allow JSON data to be sent to server
app.use(express.json());
app.use(cors());

app.use('/users', userRoutes);
// app.use('/groups', groupRoutes);

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});