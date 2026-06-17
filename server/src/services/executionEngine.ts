import { prisma } from '../lib/prisma';
import { emitNodeStatus, emitRunStatus } from '../lib/socket';
import { topologicalSort } from './cycleDetection';
import { executeInSandbox, interpolateTemplate } from './sandboxExecutor';
import type { PipelineNode, PipelineEdge, ExecutionContext, TriggerPayload } from '../types';

async function runNode(
  node: PipelineNode,
  input: unknown,
  context: ExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const cfg = node.config;

  switch (node.type) {
    case 'webhook_trigger': {
      return { output: input };
    }

    case 'http_request': {
      const url = interpolateString(cfg.url || '', input);
      const method = cfg.httpMethod || 'GET';
      const timeout = cfg.timeout || 10000;
      const maxRetries = cfg.retries || 0;

      let rawBody: string | undefined;
      if (cfg.body) {
        const interpolated = interpolateString(cfg.body, input);
        rawBody = interpolated;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.headers) {
        for (const [k, v] of Object.entries(cfg.headers)) {
          headers[k] = interpolateString(v, input);
        }
      }

      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);

          const res = await fetch(url, {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : rawBody,
            signal: controller.signal,
          });
          clearTimeout(timer);

          let responseBody: unknown;
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            responseBody = await res.json();
          } else {
            responseBody = await res.text();
          }

          return {
            output: {
              status: res.status,
              statusText: res.statusText,
              headers: Object.fromEntries(res.headers.entries()),
              body: responseBody,
              ok: res.ok,
            },
          };
        } catch (err: unknown) {
          if (attempt >= maxRetries) {
            return { output: null, error: err instanceof Error ? err.message : String(err) };
          }
          attempt++;
          await sleep(500 * attempt);
        }
      }
      return { output: null, error: 'Max retries exceeded' };
    }

    case 'transform': {
      if (cfg.mode === 'template') {
        const result = interpolateTemplate(cfg.template || '{}', input);
        return { output: result };
      }
      const code = cfg.code || 'return input;';
      const result = executeInSandbox(code, input);
      if (result.error) return { output: null, error: result.error };
      return { output: result.output };
    }

    case 'filter': {
      const condition = cfg.condition || 'return true;';
      const result = executeInSandbox(condition, input);
      if (result.error) return { output: null, error: result.error };
      const passed = Boolean(result.output);
      return { output: { passed, value: input, _branch: passed ? 'true' : 'false' } };
    }

    case 'delay': {
      const ms = cfg.delayMs || 1000;
      await sleep(ms);
      return { output: input };
    }

    case 'slack_notify': {
      const webhookUrl = cfg.webhookUrl || '';
      if (!webhookUrl) return { output: null, error: 'No Slack webhook URL configured' };
      const text = cfg.slackMessage
        ? interpolateString(cfg.slackMessage, input)
        : JSON.stringify(input, null, 2);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      return { output: { ok: res.ok, status: res.status } };
    }

    case 'log': {
      const level = cfg.level || 'info';
      const msg = cfg.message ? interpolateString(cfg.message, input) : JSON.stringify(input);
      console[level](`[Pipeline Log] ${msg}`);
      return { output: { logged: true, message: msg, level, input } };
    }

    case 'email': {
      console.log('[Email node] Would send email to', cfg.to);
      return { output: { sent: false, reason: 'Email not configured in this env' } };
    }

    default: {
      return { output: input };
    }
  }
}

function interpolateString(str: string, input: unknown): string {
  return str.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const keys = path.trim().split('.');
    let value: unknown = input;
    for (const key of keys) {
      if (key === 'input') continue;
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[key];
      } else {
        return '';
      }
    }
    return value !== undefined && value !== null ? String(value) : '';
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function executePipeline(
  pipelineId: string,
  versionId: string,
  runId: string,
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  triggerPayload: TriggerPayload
): Promise<void> {
  const context: ExecutionContext = {};
  const nodeMap: Record<string, PipelineNode> = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const sortedIds = topologicalSort(
    nodes.map((n) => n.id),
    edges
  );

  // Build edge map for determining input routing
  const incomingEdges: Record<string, PipelineEdge[]> = {};
  for (const edge of edges) {
    if (!incomingEdges[edge.target]) incomingEdges[edge.target] = [];
    incomingEdges[edge.target].push(edge);
  }

  emitRunStatus(pipelineId, runId, 'RUNNING');

  let runFailed = false;

  for (const nodeId of sortedIds) {
    const node = nodeMap[nodeId];
    if (!node) continue;

    // Determine input
    let nodeInput: unknown = triggerPayload;
    const incoming = incomingEdges[nodeId] || [];

    if (incoming.length > 0) {
      // Check filter branch routing
      const shouldSkip = incoming.every((edge) => {
        const srcCtx = context[edge.source];
        if (!srcCtx) return true;
        if (srcCtx.status === 'failed' || srcCtx.status === 'skipped') return true;
        // Filter node — only follow matching branch
        const srcNode = nodeMap[edge.source];
        if (srcNode?.type === 'filter') {
          const out = srcCtx.output as { _branch?: string } | null;
          if (out && edge.sourceHandle && out._branch !== edge.sourceHandle) {
            return true;
          }
        }
        return false;
      });

      if (shouldSkip) {
        context[nodeId] = { input: null, output: null, status: 'skipped' };
        await prisma.nodeExecution.updateMany({
          where: { runId, nodeId },
          data: { status: 'SKIPPED' },
        });
        emitNodeStatus(runId, nodeId, 'SKIPPED');
        continue;
      }

      // Use output of first non-skipped parent
      for (const edge of incoming) {
        const srcCtx = context[edge.source];
        if (srcCtx && srcCtx.status === 'success') {
          nodeInput = srcCtx.output;
          break;
        }
      }
    }

    // Mark running
    context[nodeId] = { input: nodeInput, output: null, status: 'running' };
    const execStart = Date.now();

    await prisma.nodeExecution.create({
      data: {
        runId,
        nodeId,
        nodeName: node.name,
        nodeType: node.type,
        status: 'RUNNING',
        input: nodeInput as never,
      },
    });
    emitNodeStatus(runId, nodeId, 'RUNNING', { input: nodeInput });

    const { output, error } = await runNode(node, nodeInput, context);
    const durationMs = Date.now() - execStart;

    if (error) {
      context[nodeId] = { input: nodeInput, output, status: 'failed', error, durationMs };
      await prisma.nodeExecution.updateMany({
        where: { runId, nodeId },
        data: { status: 'FAILED', output: output as never, error, durationMs },
      });
      emitNodeStatus(runId, nodeId, 'FAILED', { error, output });
      runFailed = true;
      break;
    } else {
      context[nodeId] = { input: nodeInput, output, status: 'success', durationMs };
      await prisma.nodeExecution.updateMany({
        where: { runId, nodeId },
        data: { status: 'SUCCESS', output: output as never, durationMs },
      });
      emitNodeStatus(runId, nodeId, 'SUCCESS', { output });
    }
  }

  const finalStatus = runFailed ? 'FAILED' : 'SUCCESS';
  const now = new Date();
  const run = await prisma.pipelineRun.findUnique({ where: { id: runId } });
  const durationMs = run ? now.getTime() - run.startedAt.getTime() : 0;

  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { status: finalStatus, finishedAt: now, durationMs },
  });

  emitRunStatus(pipelineId, runId, finalStatus);
}
