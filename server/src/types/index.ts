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
  // webhook_trigger
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';

  // http_request
  url?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;

  // transform
  mode?: 'js' | 'template';
  code?: string;
  template?: string;

  // filter
  condition?: string;
  stopOnFalse?: boolean;

  // delay
  delayMs?: number;

  // slack_notify
  webhookUrl?: string;
  slackMessage?: string;

  // email
  to?: string;
  subject?: string;
  emailBody?: string;

  // log
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

export interface ExecutionContext {
  [nodeId: string]: {
    input: unknown;
    output: unknown;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    error?: string;
    durationMs?: number;
  };
}

export interface TriggerPayload {
  method: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  timestamp: string;
}
