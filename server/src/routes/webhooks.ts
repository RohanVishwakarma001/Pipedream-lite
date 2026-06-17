import { Router } from 'express';
import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { PIPELINE_QUEUE } from '../workers/pipelineWorker';
import type { PipelineNode, PipelineEdge, TriggerPayload } from '../types';

const router = Router();
const pipelineQueue = new Queue(PIPELINE_QUEUE, { connection: redis });

// All methods: POST /webhook/:webhookKey
const handler = async (req: any, res: any) => {
  const { webhookKey } = req.params;

  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { webhookKey },
      include: {
        versions: { where: { isActive: true }, take: 1 },
      },
    });

    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    if (!pipeline.isDeployed || !pipeline.versions.length) {
      return res.status(400).json({ error: 'Pipeline is not deployed' });
    }

    const activeVersion = pipeline.versions[0];

    const triggerPayload: TriggerPayload = {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.body,
      query: req.query as Record<string, string>,
      params: req.params,
      timestamp: new Date().toISOString(),
    };

    const run = await prisma.pipelineRun.create({
      data: {
        pipelineId: pipeline.id,
        versionId: activeVersion.id,
        status: 'RUNNING',
        trigger: triggerPayload as never,
      },
    });

    await pipelineQueue.add('run', {
      pipelineId: pipeline.id,
      versionId: activeVersion.id,
      runId: run.id,
      nodes: activeVersion.nodes as unknown as PipelineNode[],
      edges: activeVersion.edges as unknown as PipelineEdge[],
      triggerPayload,
    });

    res.json({
      accepted: true,
      runId: run.id,
      pipelineId: pipeline.id,
    });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.all('/:webhookKey', handler);

export default router;
