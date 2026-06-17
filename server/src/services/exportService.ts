import type { PipelineNode, PipelineEdge } from '../types';
import { topologicalSort } from './cycleDetection';

export function exportToNodeScript(
  pipelineName: string,
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): string {
  const sortedIds = topologicalSort(
    nodes.map((n) => n.id),
    edges
  );
  const nodeMap: Record<string, PipelineNode> = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const nodeBlocks = sortedIds
    .map((id) => {
      const node = nodeMap[id];
      if (!node) return '';
      return `  // Node: ${node.name} (${node.type})\n  // config: ${JSON.stringify(node.config)}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `#!/usr/bin/env node
/**
 * ${pipelineName}
 * Exported from Pipedream-lite
 * Generated: ${new Date().toISOString()}
 *
 * Usage:
 *   node pipeline.js '{"method":"POST","body":{"key":"value"}}'
 */

const http = require('http');
const vm = require('vm');

async function runPipeline(triggerPayload) {
  const context = {};

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function interpolate(str, input) {
    return str.replace(/\\{\\{([^}]+)\\}\\}/g, (_, path) => {
      const keys = path.trim().split('.');
      let value = input;
      for (const key of keys) {
        if (key === 'input') continue;
        if (value && typeof value === 'object') value = value[key];
        else return '';
      }
      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  // Pipeline nodes (in topological order)
${nodeBlocks}

  // Execution order: ${sortedIds.join(' -> ')}
  const nodes = ${JSON.stringify(nodes, null, 2)};
  const edges = ${JSON.stringify(edges, null, 2)};

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const incomingEdges = {};
  for (const edge of edges) {
    if (!incomingEdges[edge.target]) incomingEdges[edge.target] = [];
    incomingEdges[edge.target].push(edge);
  }

  const sortedIds = ${JSON.stringify(sortedIds)};

  for (const nodeId of sortedIds) {
    const node = nodeMap[nodeId];
    if (!node) continue;

    let nodeInput = triggerPayload;
    const incoming = incomingEdges[nodeId] || [];
    for (const edge of incoming) {
      const src = context[edge.source];
      if (src && src.status === 'success') { nodeInput = src.output; break; }
    }

    console.log(\`[\\x1b[36m\${node.name}\\x1b[0m] Running...\`);
    const start = Date.now();

    try {
      let output;

      switch (node.type) {
        case 'webhook_trigger':
          output = nodeInput;
          break;

        case 'http_request': {
          const url = interpolate(node.config.url || '', nodeInput);
          const res = await fetch(url, {
            method: node.config.httpMethod || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: ['GET','HEAD'].includes(node.config.httpMethod || 'GET')
              ? undefined
              : node.config.body ? interpolate(node.config.body, nodeInput) : undefined,
          });
          const body = res.headers.get('content-type')?.includes('json')
            ? await res.json()
            : await res.text();
          output = { status: res.status, body, ok: res.ok };
          break;
        }

        case 'transform': {
          if (node.config.mode === 'template') {
            const tpl = node.config.template || '{}';
            output = JSON.parse(tpl.replace(/\\{\\{([^}]+)\\}\\}/g, (_, p) => {
              const keys = p.trim().split('.');
              let v = nodeInput;
              for (const k of keys) { if (k !== 'input' && v && typeof v === 'object') v = v[k]; }
              return v !== undefined ? String(v) : '';
            }));
          } else {
            const sandbox = { input: nodeInput, __r: undefined, console, JSON, Math };
            vm.createContext(sandbox);
            vm.runInContext(\`__r = (function() { \${node.config.code || 'return input;'} })()\`, sandbox, { timeout: 5000 });
            output = sandbox.__r;
          }
          break;
        }

        case 'filter': {
          const sandbox = { input: nodeInput, __r: undefined };
          vm.createContext(sandbox);
          vm.runInContext(\`__r = (function() { \${node.config.condition || 'return true;'} })()\`, sandbox, { timeout: 5000 });
          const passed = Boolean(sandbox.__r);
          output = { passed, value: nodeInput, _branch: passed ? 'true' : 'false' };
          break;
        }

        case 'delay':
          await sleep(node.config.delayMs || 1000);
          output = nodeInput;
          break;

        case 'log': {
          const msg = node.config.message ? interpolate(node.config.message, nodeInput) : JSON.stringify(nodeInput);
          console[node.config.level || 'info'](\`[Log] \${msg}\`);
          output = { logged: true, message: msg };
          break;
        }

        default:
          output = nodeInput;
      }

      context[nodeId] = { status: 'success', output };
      console.log(\`[\\x1b[32m\${node.name}\\x1b[0m] Done (\${Date.now() - start}ms)\`);
    } catch (err) {
      context[nodeId] = { status: 'failed', error: err.message };
      console.error(\`[\\x1b[31m\${node.name}\\x1b[0m] Failed: \${err.message}\`);
      break;
    }
  }

  return context;
}

// Run from CLI
const arg = process.argv[2];
const payload = arg ? JSON.parse(arg) : { method: 'GET', body: {}, headers: {}, query: {} };
runPipeline(payload).then(ctx => {
  console.log('\\n--- Final Context ---');
  console.log(JSON.stringify(ctx, null, 2));
}).catch(console.error);
`;
}
