'use client';

import { memo } from 'react';
import { type NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';

// Shared node data shape
interface NodeData {
  label: string;
  config: Record<string, unknown>;
  execStatus?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
}

export const TriggerNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="webhook_trigger"
    data={{ label: data.label, nodeType: 'webhook_trigger', icon: '⚡', color: '#f59e0b', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
    showTargetHandle={false}
  >
    {data.config.method && (
      <div className="font-mono text-[10px] bg-amber-500/10 text-amber-400 rounded px-1.5 py-0.5 w-fit">
        {String(data.config.method)}
      </div>
    )}
  </BaseNode>
));
TriggerNode.displayName = 'TriggerNode';

export const HttpNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="http_request"
    data={{ label: data.label, nodeType: 'http_request', icon: '🌐', color: '#3b82f6', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    {data.config.url && (
      <div className="font-mono text-[10px] text-blue-400 truncate" title={String(data.config.url)}>
        {String(data.config.httpMethod || 'GET')} {String(data.config.url).replace(/^https?:\/\//, '')}
      </div>
    )}
  </BaseNode>
));
HttpNode.displayName = 'HttpNode';

export const TransformNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="transform"
    data={{ label: data.label, nodeType: 'transform', icon: '⚙️', color: '#8b5cf6', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    <div className="font-mono text-[10px] bg-purple-500/10 text-purple-400 rounded px-1.5 py-0.5 w-fit">
      {data.config.mode === 'template' ? 'JSON Template' : 'JS Code'}
    </div>
  </BaseNode>
));
TransformNode.displayName = 'TransformNode';

export const FilterNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="filter"
    data={{ label: data.label, nodeType: 'filter', icon: '🔀', color: '#10b981', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
    extraSourceHandles={[
      { id: 'true', label: '✓ true' },
      { id: 'false', label: '✗ false' },
    ]}
  >
    {data.config.condition && (
      <div className="font-mono text-[10px] text-emerald-400 truncate" title={String(data.config.condition)}>
        {String(data.config.condition).slice(0, 40)}
      </div>
    )}
  </BaseNode>
));
FilterNode.displayName = 'FilterNode';

export const DelayNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="delay"
    data={{ label: data.label, nodeType: 'delay', icon: '⏱️', color: '#f97316', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    {data.config.delayMs !== undefined && (
      <div className="text-[10px] text-orange-400">
        Wait {Number(data.config.delayMs) / 1000}s
      </div>
    )}
  </BaseNode>
));
DelayNode.displayName = 'DelayNode';

export const SlackNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="slack_notify"
    data={{ label: data.label, nodeType: 'slack_notify', icon: '💬', color: '#4a154b', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    {data.config.slackMessage && (
      <div className="text-[10px] text-gray-400 truncate">{String(data.config.slackMessage).slice(0, 50)}</div>
    )}
  </BaseNode>
));
SlackNode.displayName = 'SlackNode';

export const LogNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="log"
    data={{ label: data.label, nodeType: 'log', icon: '📋', color: '#6b7280', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    {data.config.message && (
      <div className="text-[10px] text-gray-400 truncate">{String(data.config.message)}</div>
    )}
  </BaseNode>
));
LogNode.displayName = 'LogNode';

export const EmailNode = memo(({ data, selected }: NodeProps<NodeData>) => (
  <BaseNode
    id=""
    type="email"
    data={{ label: data.label, nodeType: 'email', icon: '✉️', color: '#ec4899', execStatus: data.execStatus }}
    selected={selected}
    xPos={0}
    yPos={0}
    zIndex={0}
    isConnectable
    dragging={false}
  >
    {data.config.to && (
      <div className="text-[10px] text-pink-400 truncate">To: {String(data.config.to)}</div>
    )}
  </BaseNode>
));
EmailNode.displayName = 'EmailNode';

export const nodeTypes = {
  webhook_trigger: TriggerNode,
  http_request: HttpNode,
  transform: TransformNode,
  filter: FilterNode,
  delay: DelayNode,
  slack_notify: SlackNode,
  log: LogNode,
  email: EmailNode,
};
