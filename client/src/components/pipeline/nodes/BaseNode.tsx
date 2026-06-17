'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';

export interface BaseNodeData {
  label: string;
  nodeType: string;
  icon: string;
  color: string;
  execStatus?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
  selected?: boolean;
}

const statusRing: Record<string, string> = {
  RUNNING: 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900 animate-pulse',
  SUCCESS: 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900',
  FAILED: 'ring-2 ring-red-400 ring-offset-2 ring-offset-gray-900',
  SKIPPED: 'ring-2 ring-gray-500 ring-offset-2 ring-offset-gray-900',
};

const statusDot: Record<string, string> = {
  RUNNING: 'bg-blue-400 animate-pulse',
  SUCCESS: 'bg-emerald-400',
  FAILED: 'bg-red-400',
  SKIPPED: 'bg-gray-500',
};

interface Props extends NodeProps<BaseNodeData> {
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  extraSourceHandles?: Array<{ id: string; label: string; className?: string }>;
  children?: React.ReactNode;
}

function BaseNodeComponent({
  data,
  selected,
  showTargetHandle = true,
  showSourceHandle = true,
  extraSourceHandles,
  children,
}: Props) {
  const status = data.execStatus;

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[220px] rounded-xl border bg-gray-900 shadow-lg transition-all duration-200',
        selected
          ? 'border-brand-500 shadow-brand-500/20 shadow-xl'
          : 'border-gray-700 hover:border-gray-500',
        status && statusRing[status]
      )}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-gray-600 !bg-gray-800 hover:!border-brand-400 transition-colors"
        />
      )}

      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-b',
          `border-b-gray-700/60`
        )}
        style={{ background: `${data.color}18` }}
      >
        <span className="text-lg leading-none">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white/90 truncate">{data.label}</div>
          <div className="text-[10px] text-gray-400 capitalize">{data.nodeType.replace(/_/g, ' ')}</div>
        </div>
        {status && (
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDot[status])} />
        )}
      </div>

      {/* Body */}
      {children && (
        <div className="px-3 py-2 text-[11px] text-gray-400">{children}</div>
      )}

      {showSourceHandle && !extraSourceHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-gray-600 !bg-gray-800 hover:!border-brand-400 transition-colors"
        />
      )}

      {extraSourceHandles?.map((h) => (
        <Handle
          key={h.id}
          type="source"
          position={Position.Bottom}
          id={h.id}
          style={{
            left: h.id === 'true' ? '30%' : '70%',
            bottom: -6,
          }}
          className={cn(
            '!w-3 !h-3 !border-2 !bg-gray-800 transition-colors',
            h.id === 'true'
              ? '!border-emerald-500 hover:!border-emerald-400'
              : '!border-red-500 hover:!border-red-400',
            h.className
          )}
        >
          <span
            className={cn(
              'absolute -bottom-5 text-[9px] font-medium whitespace-nowrap',
              h.id === 'true' ? 'text-emerald-400 -left-1' : 'text-red-400 -left-2'
            )}
          >
            {h.label}
          </span>
        </Handle>
      ))}
    </div>
  );
}

export const BaseNode = memo(BaseNodeComponent);
