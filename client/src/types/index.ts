export type NodeType =
  | 'webhook_trigger'
  | 'http_request'
  | 'transform'
  | 'filter'
  | 'delay'
  | 'slack_notify'
  | 'log'
  | 'email';

export interface NodeConfig {
  method?: string;
  url?: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;
  mode?: 'js' | 'template';
  code?: string;
  template?: string;
  condition?: string;
  stopOnFalse?: boolean;
  delayMs?: number;
  webhookUrl?: string;
  slackMessage?: string;
  to?: string;
  subject?: string;
  emailBody?: string;
  message?: string;
  level?: 'info' | 'warn' | 'error';
}

export interface PipelineNode {
  id: string;
  type: NodeType;
  name: string;
  config: NodeConfig;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

export interface PipelineVersion {
  id: string;
  version: number;
  isActive: boolean;
  deployedAt: string | null;
  createdAt: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  webhookKey: string;
  isDeployed: boolean;
  activeVersionId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  versions?: PipelineVersion[];
  activeVersion?: PipelineVersion;
  lastRun?: {
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    startedAt: string;
    durationMs: number | null;
  } | null;
  successCount?: number;
  _count?: { runs: number; versions: number };
}

export interface NodeExecution {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  input: unknown;
  output: unknown;
  error?: string;
  startedAt: string;
  durationMs: number | null;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  versionId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  trigger: {
    method: string;
    headers: Record<string, string>;
    body: unknown;
    query: Record<string, string>;
    timestamp: string;
  };
  error?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  executions?: NodeExecution[];
}

export interface PipelineStats {
  total: number;
  success: number;
  failed: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
  recentRuns: Array<{ status: string; startedAt: string; durationMs: number | null }>;
}

export interface LiveNodeStatus {
  runId: string;
  nodeId: string;
  status: string;
  data?: unknown;
  ts: number;
}
