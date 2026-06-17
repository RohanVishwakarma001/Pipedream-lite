'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronRight,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDuration, timeAgo, copyToClipboard, getWebhookUrl } from '@/lib/utils';
import type { Pipeline } from '@/types';

const fetcher = () => api.pipelines.list();

const statusBadge: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  SUCCESS: { label: 'Success', icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-400/10' },
  FAILED: { label: 'Failed', icon: XCircle, cls: 'text-red-400 bg-red-400/10' },
  RUNNING: { label: 'Running', icon: Play, cls: 'text-blue-400 bg-blue-400/10' },
};

function PipelineCard({ pipeline, onDelete }: { pipeline: Pipeline; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const lastRun = pipeline.lastRun;
  const badgeCfg = lastRun ? statusBadge[lastRun.status] : null;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(getWebhookUrl(pipeline.webhookKey));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <Link href={`/pipelines/${pipeline.id}`}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-800/60 transition-all duration-200 cursor-pointer">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5',
                  pipeline.isDeployed ? 'bg-emerald-400' : 'bg-gray-600'
                )}
              />
              <h3 className="text-sm font-semibold text-white truncate">{pipeline.name}</h3>
            </div>
            {badgeCfg && (
              <div className={cn('flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0', badgeCfg.cls)}>
                <badgeCfg.icon className="w-2.5 h-2.5" />
                {badgeCfg.label}
              </div>
            )}
          </div>

          {pipeline.description && (
            <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
              {pipeline.description}
            </p>
          )}

          {/* Tags */}
          {pipeline.tags && pipeline.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {pipeline.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <div className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              <span>{pipeline._count?.runs ?? 0} runs</span>
            </div>
            {pipeline.successCount !== undefined && pipeline._count?.runs ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>
                  {Math.round((pipeline.successCount / pipeline._count.runs) * 100)}%
                </span>
              </div>
            ) : null}
            {lastRun && (
              <div className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(lastRun.startedAt)}</span>
              </div>
            )}
          </div>

          {/* Webhook URL */}
          {pipeline.isDeployed && (
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
              <span className="font-mono text-[9px] text-gray-600 flex-1 truncate">
                /webhook/{pipeline.webhookKey}
              </span>
              <button
                onClick={handleCopy}
                className="text-[10px] text-gray-500 hover:text-brand-400 flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </Link>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Link
          href={`/pipelines/${pipeline.id}`}
          className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm('Delete this pipeline?')) onDelete(pipeline.id);
          }}
          className="p-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

export default function PipelinesPage() {
  const { data: pipelines, error, mutate } = useSWR('pipelines', fetcher, {
    refreshInterval: 10000,
  });

  const handleDelete = async (id: string) => {
    await api.pipelines.delete(id);
    mutate();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-400 text-sm mb-2">Failed to connect to server</div>
          <div className="text-gray-600 text-xs">Make sure the server is running on port 4000</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipelines</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {pipelines?.length ?? '—'} pipeline{pipelines?.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/pipelines/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Pipeline
          </Link>
        </div>

        {/* Loading */}
        {!pipelines && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {pipelines?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No pipelines yet</h2>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              Create your first pipeline to start wiring APIs together visually.
            </p>
            <Link
              href="/pipelines/new"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Pipeline
            </Link>
          </div>
        )}

        {/* Grid */}
        {pipelines && pipelines.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map((p: Pipeline) => (
              <PipelineCard key={p.id} pipeline={p} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
