'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { LiveNodeStatus } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(WS_URL, { transports: ['websocket', 'polling'] });
  }
  return sharedSocket;
}

export function useRunSocket(
  runId: string | null,
  onNodeStatus: (evt: LiveNodeStatus) => void,
  onRunStatus?: (evt: { runId: string; status: string }) => void
) {
  const cbRef = useRef(onNodeStatus);
  cbRef.current = onNodeStatus;
  const runCbRef = useRef(onRunStatus);
  runCbRef.current = onRunStatus;

  useEffect(() => {
    if (!runId) return;
    const socket = getSocket();

    socket.emit('subscribe:run', runId);

    const handleNode = (evt: LiveNodeStatus) => cbRef.current(evt);
    const handleRun = (evt: any) => runCbRef.current?.(evt);

    socket.on('node:status', handleNode);
    socket.on('run:status', handleRun);

    return () => {
      socket.off('node:status', handleNode);
      socket.off('run:status', handleRun);
    };
  }, [runId]);
}

export function usePipelineSocket(
  pipelineId: string | null,
  onRunStatus?: (evt: any) => void
) {
  const cbRef = useRef(onRunStatus);
  cbRef.current = onRunStatus;

  useEffect(() => {
    if (!pipelineId) return;
    const socket = getSocket();

    socket.emit('subscribe:pipeline', pipelineId);

    const handleRun = (evt: any) => cbRef.current?.(evt);
    socket.on('run:status', handleRun);

    return () => {
      socket.off('run:status', handleRun);
    };
  }, [pipelineId]);
}
