'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, SkipForward, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils';
import type { NodeExecution } from '@/types';

const statusConfig = {
  SUCCESS: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  FAILED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  RUNNING: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  SKIPPED: { icon: SkipForward, color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
  PENDING: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
};

function JsonViewer({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null || data === undefined)
    return <span className="text-gray-500">null</span>;
  if (typeof data === 'boolean')
    return <span className={data ? 'text-emerald-400' : 'text-red-400'}>{String(data)}</span>;
  if (typeof data === 'number')
    return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'string')
    return <span className="text-amber-300">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          {' '}[{data.length}]
        </button>
        {!collapsed && (
          <div className="ml-3 border-l border-gray-700 pl-2 space-y-0.5 mt-0.5">
            {data.map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-gray-600 select-none">{i}:</span>
                <JsonViewer data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-400">{'{}'}</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          {' '}{'{'}…{'}'}
        </button>
        {!collapsed && (
          <div className="ml-3 border-l border-gray-700 pl-2 space-y-0.5 mt-0.5">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="text-purple-400">"{k}"</span>
                <span className="text-gray-500">:</span>
                <JsonViewer data={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="text-gray-300">{String(data)}</span>;
}

function NodeExecutionRow({ exec }: { exec: NodeExecution }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[exec.status] || statusConfig.PENDING;
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-lg border', cfg.bg)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.color, exec.status === 'RUNNING' && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white">{exec.nodeName}</div>
          <div className="text-[10px] text-gray-500 capitalize">{exec.nodeType.replace(/_/g, ' ')}</div>
        </div>
        {exec.durationMs != null && (
          <span className="text-[10px] text-gray-500 flex-shrink-0">
            {formatDuration(exec.durationMs)}
          </span>
        )}
        {(exec.input !== undefined || exec.output !== undefined) && (
          <ChevronDown
            className={cn('w-3 h-3 text-gray-500 transition-transform', expanded && 'rotate-180')}
          />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {exec.error && (
            <div className="rounded bg-red-500/10 border border-red-500/20 p-2">
              <div className="text-[10px] font-semibold text-red-400 mb-1">Error</div>
              <div className="font-mono text-[10px] text-red-300">{exec.error}</div>
            </div>
          )}
          {exec.input !== undefined && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 mb-1">Input</div>
              <div className="font-mono text-[10px] bg-gray-900/60 rounded p-2 overflow-x-auto">
                <JsonViewer data={exec.input} />
              </div>
            </div>
          )}
          {exec.output !== undefined && exec.output !== null && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 mb-1">Output</div>
              <div className="font-mono text-[10px] bg-gray-900/60 rounded p-2 overflow-x-auto">
                <JsonViewer data={exec.output} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  executions: NodeExecution[];
  liveStatuses?: Record<string, { status: string; data?: unknown }>;
}

export function ExecutionLogViewer({ executions, liveStatuses }: Props) {
  const merged = executions.map((e) => {
    const live = liveStatuses?.[e.nodeId];
    if (live) {
      return {
        ...e,
        status: live.status as NodeExecution['status'],
        output: (live.data as any)?.output ?? e.output,
      };
    }
    return e;
  });

  if (merged.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 text-xs">
        No executions yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {merged.map((exec) => (
        <NodeExecutionRow key={exec.id || exec.nodeId} exec={exec} />
      ))}
    </div>
  );
}
