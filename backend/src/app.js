import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);

app.use((req, res) => {
    res.status(404).json({ error: { message: 'Route not found' } });
});

// Last-resort handler: log the real error, never send a stack trace to the client
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: { message: 'Something went wrong' } });
});

export default app;