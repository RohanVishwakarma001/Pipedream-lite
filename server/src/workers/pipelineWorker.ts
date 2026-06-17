import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { executePipeline } from '../services/executionEngine';
import type { PipelineNode, PipelineEdge, TriggerPayload } from '../types';

export const PIPELINE_QUEUE = 'pipeline-runs';

export interface PipelineJobData {
  pipelineId: string;
  versionId: string;
  runId: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  triggerPayload: TriggerPayload;
}

export function startPipelineWorker(): Worker {
  const worker = new Worker<PipelineJobData>(
    PIPELINE_QUEUE,
    async (job: Job<PipelineJobData>) => {
      const { pipelineId, versionId, runId, nodes, edges, triggerPayload } = job.data;
      console.log(`[Worker] Starting pipeline run ${runId} for pipeline ${pipelineId}`);

      try {
        await executePipeline(pipelineId, versionId, runId, nodes, edges, triggerPayload);
        console.log(`[Worker] Completed run ${runId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] Run ${runId} failed:`, msg);
        await prisma.pipelineRun.update({
          where: { id: runId },
          data: { status: 'FAILED', finishedAt: new Date(), error: msg },
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
