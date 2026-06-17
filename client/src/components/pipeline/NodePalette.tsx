'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export const NODE_DEFINITIONS = [
  {
    type: 'webhook_trigger',
    label: 'Webhook Trigger',
    icon: '⚡',
    color: '#f59e0b',
    category: 'Triggers',
    description: 'Entry point — receives incoming HTTP requests',
    defaultConfig: { method: 'POST' },
  },
  {
    type: 'http_request',
    label: 'HTTP Request',
    icon: '🌐',
    color: '#3b82f6',
    category: 'Actions',
    description: 'Make outbound HTTP/API calls',
    defaultConfig: { httpMethod: 'GET', url: '', timeout: 10000, retries: 0 },
  },
  {
    type: 'transform',
    label: 'Transform',
    icon: '⚙️',
    color: '#8b5cf6',
    category: 'Logic',
    description: 'Reshape data with JS code or JSON template',
    defaultConfig: { mode: 'js', code: 'return input;' },
  },
  {
    type: 'filter',
    label: 'Filter / Branch',
    icon: '🔀',
    color: '#10b981',
    category: 'Logic',
    description: 'Route based on a condition (true/false branches)',
    defaultConfig: { condition: 'return input.body !== undefined;' },
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: '⏱️',
    color: '#f97316',
    category: 'Utilities',
    description: 'Pause execution for a fixed duration',
    defaultConfig: { delayMs: 1000 },
  },
  {
    type: 'slack_notify',
    label: 'Slack Notify',
    icon: '💬',
    color: '#4a154b',
    category: 'Actions',
    description: 'Send a message to a Slack channel',
    defaultConfig: { webhookUrl: '', slackMessage: '{{input.body}}' },
  },
  {
    type: 'log',
    label: 'Log',
    icon: '📋',
    color: '#6b7280',
    category: 'Utilities',
    description: 'Log a value to execution history',
    defaultConfig: { message: '{{input}}', level: 'info' },
  },
  {
    type: 'email',
    label: 'Send Email',
    icon: '✉️',
    color: '#ec4899',
    category: 'Actions',
    description: 'Send an email notification',
    defaultConfig: { to: '', subject: '', emailBody: '' },
  },
] as const;

const CATEGORIES = ['Triggers', 'Actions', 'Logic', 'Utilities'];

interface NodePaletteProps {
  onAddNode: (type: string, label: string, defaultConfig: Record<string, unknown>) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = NODE_DEFINITIONS.filter((n) => {
    const matchSearch =
      !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || n.category === activeCategory;
    return matchSearch && matchCat;
  });

  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      <div className="p-3 border-b border-gray-800">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Node Library
        </div>
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
              activeCategory === cat
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            onClick={() => onAddNode(node.type, node.label, { ...node.defaultConfig })}
            className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-800 bg-gray-800/40 hover:bg-gray-800 hover:border-gray-600 cursor-grab active:cursor-grabbing transition-all duration-150"
          >
            <span
              className="text-xl flex-shrink-0 mt-0.5"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.4))' }}
            >
              {node.icon}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-white group-hover:text-white/90 leading-tight">
                {node.label}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                {node.description}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-xs">No nodes match your search</div>
        )}
      </div>

      <div className="p-2 border-t border-gray-800">
        <div className="text-[9px] text-gray-600 text-center">
          Drag onto canvas or click to add
        </div>
      </div>
    </div>
  );
}
