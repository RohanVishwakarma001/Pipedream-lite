import type { PipelineEdge } from '../types';

export function hasCycle(edges: PipelineEdge[]): boolean {
  const adj: Record<string, string[]> = {};

  for (const edge of edges) {
    if (!adj[edge.source]) adj[edge.source] = [];
    adj[edge.source].push(edge.target);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adj[node] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  const allNodes = new Set<string>();
  for (const edge of edges) {
    allNodes.add(edge.source);
    allNodes.add(edge.target);
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
}

export function topologicalSort(
  nodeIds: string[],
  edges: PipelineEdge[]
): string[] {
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const id of nodeIds) {
    adj[id] = [];
    inDegree[id] = 0;
  }

  for (const edge of edges) {
    if (adj[edge.source] && inDegree[edge.target] !== undefined) {
      adj[edge.source].push(edge.target);
      inDegree[edge.target]++;
    }
  }

  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDegree[id] === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  return result;
}
