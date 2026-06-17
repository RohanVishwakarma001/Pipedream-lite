import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export function initSocket(httpServer: HttpServer, clientUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('subscribe:run', (runId: string) => {
      socket.join(`run:${runId}`);
      console.log(`[Socket] ${socket.id} subscribed to run ${runId}`);
    });

    socket.on('subscribe:pipeline', (pipelineId: string) => {
      socket.join(`pipeline:${pipelineId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function emitNodeStatus(
  runId: string,
  nodeId: string,
  status: string,
  data?: unknown
): void {
  if (!io) return;
  io.to(`run:${runId}`).emit('node:status', { runId, nodeId, status, data, ts: Date.now() });
}

export function emitRunStatus(
  pipelineId: string,
  runId: string,
  status: string,
  data?: unknown
): void {
  if (!io) return;
  io.to(`pipeline:${pipelineId}`).emit('run:status', { runId, status, data, ts: Date.now() });
}
