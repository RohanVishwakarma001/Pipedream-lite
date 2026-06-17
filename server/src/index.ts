import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './lib/socket';
import { startPipelineWorker } from './workers/pipelineWorker';
import pipelinesRouter from './routes/pipelines';
import webhooksRouter from './routes/webhooks';

const app = express();
const httpServer = http.createServer(app);

const PORT = parseInt(process.env.PORT || '4000');
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Middleware
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Routes
app.use('/api/pipelines', pipelinesRouter);
app.use('/webhook', webhooksRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Init Socket.io
initSocket(httpServer, CLIENT_URL);

// Start BullMQ worker
startPipelineWorker();

// Start server
httpServer.listen(PORT, () => {
  console.log(`\n  ✦ Pipedream-lite server running`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  WebSocket on same port`);
  console.log(`  ➜  Webhook endpoint: http://localhost:${PORT}/webhook/:key\n`);
});
