import { Router } from 'express';
import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { hasCycle } from '../services/cycleDetection';
import { exportToNodeScript } from '../services/exportService';
import { PIPELINE_QUEUE } from '../workers/pipelineWorker';
import type { PipelineNode, PipelineEdge, TriggerPayload } from '../types';
import { z } from 'zod';

const router = Router();
const pipelineQueue = new Queue(PIPELINE_QUEUE, { connection: redis });

const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  config: z.record(z.unknown()),
  position: z.object({ x: z.number(), y: z.number() }),
});

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
});

const PipelineBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  tags: z.array(z.string()).optional(),
});

// GET /pipelines
router.get('/', async (req, res) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        _count: { select: { runs: true, versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const enriched = await Promise.all(
      pipelines.map(async (p) => {
        const lastRun = await prisma.pipelineRun.findFirst({
          where: { pipelineId: p.id },
          orderBy: { startedAt: 'desc' },
          select: { status: true, startedAt: true, durationMs: true },
        });

        const successCount = await prisma.pipelineRun.count({
          where: { pipelineId: p.id, status: 'SUCCESS' },
        });

        return { ...p, lastRun, successCount };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
});

// GET /pipelines/:id
router.get('/:id', async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: req.params.id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 10 },
      },
    });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    const activeVersion = pipeline.versions.find((v) => v.isActive);
    res.json({ ...pipeline, activeVersion });
  } catch {
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// POST /pipelines
router.post('/', async (req, res) => {
  const parsed = PipelineBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { name, description, nodes, edges, tags } = parsed.data;

  if (hasCycle(edges as PipelineEdge[])) {
    return res.status(400).json({ error: 'Pipeline graph contains a cycle' });
  }

  try {
    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        description,
        tags: tags || [],
        versions: {
          create: {
            version: 1,
            nodes: nodes as never,
            edges: edges as never,
          },
        },
      },
      include: { versions: true },
    });
    res.status(201).json(pipeline);
  } catch {
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

// PUT /pipelines/:id
router.put('/:id', async (req, res) => {
  const parsed = PipelineBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { name, description, nodes, edges, tags } = parsed.data;

  if (hasCycle(edges as PipelineEdge[])) {
    return res.status(400).json({ error: 'Pipeline graph contains a cycle' });
  }

  try {
    const existing = await prisma.pipeline.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!existing) return res.status(404).json({ error: 'Pipeline not found' });

    const nextVersion = (existing.versions[0]?.version || 0) + 1;

    const [updated] = await prisma.$transaction([
      prisma.pipeline.update({
        where: { id: req.params.id },
        data: { name, description, tags: tags || [], updatedAt: new Date() },
      }),
      prisma.pipelineVersion.create({
        data: {
          pipelineId: req.params.id,
          version: nextVersion,
          nodes: nodes as never,
          edges: edges as never,
        },
      }),
    ]);

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
});

// DELETE /pipelines/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.pipeline.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete pipeline' });
  }
});

// POST /pipelines/:id/deploy
router.post('/:id/deploy', async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    const version = pipeline.versions[0];
    if (!version) return res.status(400).json({ error: 'No version to deploy' });

    const edges = version.edges as unknown as PipelineEdge[];

    if (hasCycle(edges)) {
      return res.status(400).json({ error: 'Pipeline contains a cycle — cannot deploy' });
    }

    await prisma.$transaction([
      prisma.pipelineVersion.updateMany({
        where: { pipelineId: req.params.id },
        data: { isActive: false },
      }),
      prisma.pipelineVersion.update({
        where: { id: version.id },
        data: { isActive: true, deployedAt: new Date() },
      }),
      prisma.pipeline.update({
        where: { id: req.params.id },
        data: { isDeployed: true, activeVersionId: version.id },
      }),
    ]);

    res.json({
      ok: true,
      webhookUrl: `/webhook/${pipeline.webhookKey}`,
      version: version.version,
    });
  } catch {
    res.status(500).json({ error: 'Failed to deploy pipeline' });
  }
});

// POST /pipelines/:id/rollback/:versionId
router.post('/:id/rollback/:versionId', async (req, res) => {
  try {
    const version = await prisma.pipelineVersion.findFirst({
      where: { id: req.params.versionId, pipelineId: req.params.id },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    await prisma.$transaction([
      prisma.pipelineVersion.updateMany({
        where: { pipelineId: req.params.id },
        data: { isActive: false },
      }),
      prisma.pipelineVersion.update({
        where: { id: version.id },
        data: { isActive: true, deployedAt: new Date() },
      }),
      prisma.pipeline.update({
        where: { id: req.params.id },
        data: { activeVersionId: version.id },
      }),
    ]);

    res.json({ ok: true, rolledBackTo: version.version });
  } catch {
    res.status(500).json({ error: 'Failed to rollback' });
  }
});

// GET /pipelines/:id/versions
router.get('/:id/versions', async (req, res) => {
  try {
    const versions = await prisma.pipelineVersion.findMany({
      where: { pipelineId: req.params.id },
      orderBy: { version: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    res.json(versions);
  } catch {
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// GET /pipelines/:id/runs
router.get('/:id/runs', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '20'));
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      prisma.pipelineRun.findMany({
        where: { pipelineId: req.params.id },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { executions: true } } },
      }),
      prisma.pipelineRun.count({ where: { pipelineId: req.params.id } }),
    ]);

    res.json({ runs, total, page, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// GET /pipelines/:id/runs/:runId
router.get('/:id/runs/:runId', async (req, res) => {
  try {
    const run = await prisma.pipelineRun.findFirst({
      where: { id: req.params.runId, pipelineId: req.params.id },
      include: { executions: { orderBy: { startedAt: 'asc' } } },
    });
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch {
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// POST /pipelines/:id/test
router.post('/:id/test', async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: req.params.id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    const version = pipeline.versions[0];
    if (!version) return res.status(400).json({ error: 'No version found. Save first.' });

    const testPayload: TriggerPayload = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-mode': 'true' },
      body: req.body.payload || {},
      query: {},
      params: {},
      timestamp: new Date().toISOString(),
    };

    const run = await prisma.pipelineRun.create({
      data: {
        pipelineId: pipeline.id,
        versionId: version.id,
        status: 'RUNNING',
        trigger: testPayload as never,
      },
    });

    await pipelineQueue.add('run', {
      pipelineId: pipeline.id,
      versionId: version.id,
      runId: run.id,
      nodes: version.nodes as unknown as PipelineNode[],
      edges: version.edges as unknown as PipelineEdge[],
      triggerPayload: testPayload,
    });

    res.json({ runId: run.id, status: 'queued' });
  } catch {
    res.status(500).json({ error: 'Failed to run test' });
  }
});

// POST /pipelines/:id/export
router.post('/:id/export', async (req, res) => {
  try {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: req.params.id },
      include: { versions: { where: { isActive: true }, take: 1 } },
    });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

    const version = pipeline.versions[0];
    if (!version) return res.status(400).json({ error: 'Deploy the pipeline first to export' });

    const script = exportToNodeScript(
      pipeline.name,
      version.nodes as unknown as PipelineNode[],
      version.edges as unknown as PipelineEdge[]
    );

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', `attachment; filename="${pipeline.name.replace(/\s+/g, '-')}.js"`);
    res.send(script);
  } catch {
    res.status(500).json({ error: 'Failed to export pipeline' });
  }
});

// GET /pipelines/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const [total, success, failed] = await Promise.all([
      prisma.pipelineRun.count({ where: { pipelineId: req.params.id } }),
      prisma.pipelineRun.count({ where: { pipelineId: req.params.id, status: 'SUCCESS' } }),
      prisma.pipelineRun.count({ where: { pipelineId: req.params.id, status: 'FAILED' } }),
    ]);

    const avgDuration = await prisma.pipelineRun.aggregate({
      where: { pipelineId: req.params.id, status: 'SUCCESS' },
      _avg: { durationMs: true },
    });

    const recentRuns = await prisma.pipelineRun.findMany({
      where: { pipelineId: req.params.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { status: true, startedAt: true, durationMs: true },
    });

    res.json({
      total,
      success,
      failed,
      running: total - success - failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgDurationMs: Math.round(avgDuration._avg.durationMs || 0),
      recentRuns,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
