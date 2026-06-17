'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Rocket,
  Play,
  Download,
  History,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  RotateCcw,
  Terminal,
  Zap,
  Clock,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { cn, copyToClipboard, getWebhookUrl, formatDuration, timeAgo } from '@/lib/utils';
import { ExecutionLogViewer } from '@/components/pipeline/ExecutionLogViewer';
import { useRunSocket, usePipelineSocket } from '@/hooks/useWebSocket';
import type { PipelineNode, PipelineEdge, LiveNodeStatus, PipelineRun } from '@/types';

const PipelineCanvas = dynamic(
  () => import('@/components/pipeline/PipelineCanvas').then((m) => m.PipelineCanvas),
  { ssr: false, loading: () => <CanvasLoading /> }
);

function CanvasLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950">
      <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    SUCCESS: { cls: 'text-emerald-400 bg-emerald-400/10', label: 'Success' },
    FAILED: { cls: 'text-red-400 bg-red-400/10', label: 'Failed' },
    RUNNING: { cls: 'text-blue-400 bg-blue-400/10 animate-pulse', label: 'Running' },
  }[status] || { cls: 'text-gray-400 bg-gray-400/10', label: status };

  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export default function PipelineEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [currentNodes, setCurrentNodes] = useState<PipelineNode[]>([]);
  const [currentEdges, setCurrentEdges] = useState<PipelineEdge[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "hello": "world"\n}');
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showRunLog, setShowRunLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [liveNodeStatuses, setLiveNodeStatuses] = useState<
    Record<string, { status: string; data?: unknown }>
  >({});
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const { data: pipeline, mutate } = useSWR(
    id ? `pipeline-${id}` : null,
    () => api.pipelines.get(id),
    {
      onSuccess(data) {
        const v = data.activeVersion || data.versions?.[0];
        if (v && !isDirty) {
          setCurrentNodes(v.nodes || []);
          setCurrentEdges(v.edges || []);
        }
      },
    }
  );

  const { data: versionsData, mutate: mutateVersions } = useSWR(
    showVersions ? `versions-${id}` : null,
    () => api.pipelines.versions(id)
  );

  const { data: runsData, mutate: mutateRuns } = useSWR(
    showRunLog ? `runs-${id}` : null,
    () => api.pipelines.runs(id),
    { refreshInterval: activeRunId ? 2000 : 0 }
  );

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // WebSocket — subscribe to run events
  useRunSocket(
    activeRunId,
    (evt: LiveNodeStatus) => {
      setLiveNodeStatuses((prev) => ({
        ...prev,
        [evt.nodeId]: { status: evt.status, data: evt.data },
      }));
    },
    (evt) => {
      if (evt.status === 'SUCCESS' || evt.status === 'FAILED') {
        setActiveRunId(null);
        mutateRuns();
        showToast(
          evt.status === 'SUCCESS' ? 'Pipeline run completed ✓' : 'Pipeline run failed',
          evt.status === 'SUCCESS' ? 'success' : 'error'
        );
      }
    }
  );

  usePipelineSocket(id, (evt) => {
    if (evt.status === 'RUNNING') {
      setActiveRunId(evt.runId);
      setLiveNodeStatuses({});
      setShowRunLog(true);
      mutateRuns();
    }
  });

  const onCanvasChange = useCallback((nodes: PipelineNode[], edges: PipelineEdge[]) => {
    setCurrentNodes(nodes);
    setCurrentEdges(edges);
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    if (!pipeline) return;
    setSaving(true);
    try {
      await api.pipelines.update(id, {
        name: pipeline.name,
        description: pipeline.description,
        tags: pipeline.tags,
        nodes: currentNodes,
        edges: currentEdges,
      });
      setIsDirty(false);
      mutate();
      mutateVersions();
      showToast('Saved successfully');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (isDirty) await handleSave();
    setDeploying(true);
    try {
      const result = await api.pipelines.deploy(id);
      mutate();
      showToast(`Deployed as v${result.version} — webhook is live!`);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setDeploying(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setLiveNodeStatuses({});
    setShowRunLog(true);
    try {
      let payload: unknown = {};
      try {
        payload = JSON.parse(testPayload);
      } catch {}
      const result = await api.pipelines.test(id, payload);
      setActiveRunId(result.runId);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleRollback = async (versionId: string, version: number) => {
    if (!confirm(`Roll back to v${version}?`)) return;
    try {
      await api.pipelines.rollback(id, versionId);
      mutate();
      mutateVersions();
      setShowVersions(false);
      showToast(`Rolled back to v${version}`);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleExport = () => {
    if (!pipeline) return;
    api.pipelines.export(id, pipeline.name);
  };

  const handleCopyWebhook = () => {
    if (!pipeline) return;
    copyToClipboard(getWebhookUrl(pipeline.webhookKey));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Editor Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <Link
          href="/pipelines"
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors mr-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-white truncate">{pipeline.name}</h1>
            {pipeline.isDeployed ? (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-400/10 text-emerald-400 rounded-full border border-emerald-400/20">
                Live
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-500 rounded-full border border-gray-700">
                Draft
              </span>
            )}
            {isDirty && (
              <span className="text-[10px] text-amber-400">• unsaved</span>
            )}
          </div>
          <div className="text-[10px] text-gray-600">
            {currentNodes.length} nodes · {currentEdges.length} edges
          </div>
        </div>

        {/* Webhook URL copy */}
        {pipeline.isDeployed && (
          <button
            onClick={handleCopyWebhook}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-[10px] text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Webhook URL'}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowRunLog(!showRunLog)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
              showRunLog
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <Terminal className="w-3.5 h-3.5" />
            Logs
          </button>

          <button
            onClick={() => { setShowVersions(!showVersions); setShowTestPanel(false); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
              showVersions
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <History className="w-3.5 h-3.5" />
            Versions
          </button>

          <button
            onClick={() => { setShowTestPanel(!showTestPanel); setShowVersions(false); }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
              showTestPanel
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <Play className="w-3.5 h-3.5" />
            Test
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>

          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {deploying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            Deploy
          </button>
        </div>
      </div>

      {/* Secondary panels (test / versions / run log) */}
      <AnimatePresence>
        {showTestPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-900 border-b border-gray-800 overflow-hidden flex-shrink-0"
          >
            <div className="p-4 flex gap-4 items-start">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-400 mb-2 block">
                  Test Payload (JSON)
                </label>
                <textarea
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>
              <div className="flex flex-col items-end gap-2 pt-5">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Run Test
                </button>
                <div className="text-[10px] text-gray-600 text-right">
                  Uses latest saved version.
                  <br />
                  Does not require deployment.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area: canvas + optional side panels */}
      <div className="flex flex-1 overflow-hidden">
        <PipelineCanvas
          initialNodes={currentNodes}
          initialEdges={currentEdges}
          liveStatuses={liveNodeStatuses}
          onChange={onCanvasChange}
        />

        {/* Versions panel */}
        <AnimatePresence>
          {showVersions && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col bg-gray-900 border-l border-gray-800 overflow-hidden flex-shrink-0"
            >
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Version History</span>
                <button onClick={() => setShowVersions(false)} className="text-gray-500 hover:text-white text-xs">
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!versionsData && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                  </div>
                )}
                {versionsData?.map((v: any) => (
                  <div
                    key={v.id}
                    className={cn(
                      'rounded-lg border p-3 space-y-1.5',
                      v.isActive
                        ? 'border-brand-500/40 bg-brand-500/5'
                        : 'border-gray-700 bg-gray-800/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">v{v.version}</span>
                        {v.isActive && (
                          <span className="text-[9px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full">
                            active
                          </span>
                        )}
                      </div>
                      {!v.isActive && (
                        <button
                          onClick={() => handleRollback(v.id, v.version)}
                          className="text-[10px] text-gray-500 hover:text-brand-400 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Rollback
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {v.deployedAt
                        ? `Deployed ${timeAgo(v.deployedAt)}`
                        : `Saved ${timeAgo(v.createdAt)}`}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {v._count?.runs ?? 0} runs
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Run log panel */}
        <AnimatePresence>
          {showRunLog && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col bg-gray-900 border-l border-gray-800 overflow-hidden flex-shrink-0"
            >
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Execution Logs</span>
                  {activeRunId && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Live
                    </span>
                  )}
                </div>
                <button onClick={() => setShowRunLog(false)} className="text-gray-500 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              {/* Recent runs list */}
              <div className="border-b border-gray-800 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {!runsData && (
                  <div className="text-xs text-gray-600 text-center py-2">Loading runs…</div>
                )}
                {runsData?.runs?.slice(0, 5).map((run: any) => (
                  <button
                    key={run.id}
                    onClick={async () => {
                      const full = await api.pipelines.run(id, run.id);
                      setActiveRun(full);
                      setActiveRunId(null);
                      setLiveNodeStatuses({});
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                      activeRun?.id === run.id
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-800'
                    )}
                  >
                    <StatusBadge status={run.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 truncate">
                        {timeAgo(run.startedAt)}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {formatDuration(run.durationMs)}
                    </div>
                  </button>
                ))}
                {runsData?.runs?.length === 0 && (
                  <div className="text-[10px] text-gray-600 text-center py-2">
                    No runs yet. Test or deploy to trigger a run.
                  </div>
                )}
              </div>

              {/* Node executions */}
              <div className="flex-1 overflow-y-auto p-3">
                {activeRun ? (
                  <ExecutionLogViewer
                    executions={activeRun.executions || []}
                    liveStatuses={liveNodeStatuses}
                  />
                ) : activeRunId ? (
                  <div className="space-y-2">
                    {Object.entries(liveNodeStatuses).map(([nodeId, s]) => {
                      const node = currentNodes.find((n) => n.id === nodeId);
                      return (
                        <div
                          key={nodeId}
                          className={cn(
                            'rounded-lg border p-2.5 flex items-center gap-2.5',
                            s.status === 'SUCCESS' && 'border-emerald-400/20 bg-emerald-400/5',
                            s.status === 'FAILED' && 'border-red-400/20 bg-red-400/5',
                            s.status === 'RUNNING' && 'border-blue-400/20 bg-blue-400/5'
                          )}
                        >
                          {s.status === 'RUNNING' && (
                            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
                          )}
                          {s.status === 'SUCCESS' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                          {s.status === 'FAILED' && (
                            <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                          <span className="text-xs text-white">
                            {node?.name ?? nodeId}
                          </span>
                        </div>
                      );
                    })}
                    {Object.keys(liveNodeStatuses).length === 0 && (
                      <div className="text-center py-6 text-gray-600 text-xs">
                        Waiting for execution to start…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600 text-xs">
                    Select a run above to view node-level details
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium border z-50',
              toast.type === 'success'
                ? 'bg-gray-900 border-emerald-500/30 text-emerald-400'
                : 'bg-gray-900 border-red-500/30 text-red-400'
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
