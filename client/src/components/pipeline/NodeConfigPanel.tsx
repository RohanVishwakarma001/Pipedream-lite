'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { X, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineNode, NodeConfig } from '@/types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Props {
  node: PipelineNode | null;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<PipelineNode>) => void;
  onDelete: (nodeId: string) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors',
        className
      )}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors pr-8"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
    </div>
  );
}

function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  height = 200,
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  height?: number;
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 11,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          suggestOnTriggerCharacters: true,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const LOG_LEVELS = [
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: Props) {
  const [cfg, setCfg] = useState<NodeConfig>({});
  const [name, setName] = useState('');

  useEffect(() => {
    if (node) {
      setCfg({ ...node.config });
      setName(node.name);
    }
  }, [node?.id]);

  const update = useCallback(
    (key: keyof NodeConfig, value: unknown) => {
      if (!node) return;
      const next = { ...cfg, [key]: value };
      setCfg(next);
      onUpdate(node.id, { config: next });
    },
    [node, cfg, onUpdate]
  );

  const handleNameBlur = () => {
    if (!node) return;
    onUpdate(node.id, { name });
  };

  if (!node) return null;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-80 min-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="text-sm font-semibold text-white truncate">{node.name}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { onDelete(node.id); onClose(); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <Field label="Node Name">
          <Input
            value={name}
            onChange={setName}
            onBlur={handleNameBlur as any}
            placeholder="Node name"
          />
        </Field>

        {/* Type-specific config */}
        {node.type === 'webhook_trigger' && (
          <Field label="Accept Method">
            <Select
              value={cfg.method || 'ANY'}
              onChange={(v) => update('method', v)}
              options={[
                { value: 'ANY', label: 'Any Method' },
                ...HTTP_METHODS,
              ]}
            />
          </Field>
        )}

        {node.type === 'http_request' && (
          <>
            <Field label="Method">
              <Select
                value={cfg.httpMethod || 'GET'}
                onChange={(v) => update('httpMethod', v)}
                options={HTTP_METHODS}
              />
            </Field>
            <Field label="URL">
              <Input
                value={cfg.url || ''}
                onChange={(v) => update('url', v)}
                placeholder="https://api.example.com/endpoint"
              />
            </Field>
            <Field label="Request Body (JSON)">
              <textarea
                value={cfg.body || ''}
                onChange={(e) => update('body', e.target.value)}
                placeholder={'{\n  "key": "{{input.body.value}}"\n}'}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </Field>
            <Field label="Timeout (ms)">
              <Input
                type="number"
                value={String(cfg.timeout || 10000)}
                onChange={(v) => update('timeout', parseInt(v))}
                placeholder="10000"
              />
            </Field>
            <Field label="Retries">
              <Input
                type="number"
                value={String(cfg.retries || 0)}
                onChange={(v) => update('retries', parseInt(v))}
                placeholder="0"
              />
            </Field>
          </>
        )}

        {node.type === 'transform' && (
          <>
            <Field label="Mode">
              <Select
                value={cfg.mode || 'js'}
                onChange={(v) => update('mode', v)}
                options={[
                  { value: 'js', label: 'JavaScript Code' },
                  { value: 'template', label: 'JSON Template' },
                ]}
              />
            </Field>
            {cfg.mode === 'template' ? (
              <Field label="JSON Template (use {{input.field}} to interpolate)">
                <CodeEditor
                  value={cfg.template || '{\n  "field": "{{input.body.field}}"\n}'}
                  onChange={(v) => update('template', v)}
                  language="json"
                />
              </Field>
            ) : (
              <Field label="JavaScript (use `input` variable, must return a value)">
                <CodeEditor
                  value={cfg.code || 'return input;'}
                  onChange={(v) => update('code', v)}
                  language="javascript"
                />
              </Field>
            )}
          </>
        )}

        {node.type === 'filter' && (
          <>
            <Field label="Condition (JS, must return true/false)">
              <CodeEditor
                value={cfg.condition || 'return input.body !== undefined;'}
                onChange={(v) => update('condition', v)}
                language="javascript"
                height={150}
              />
            </Field>
            <div className="rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-1">
              <div className="text-[10px] font-semibold text-gray-400">Branch outputs</div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-emerald-400 font-medium">true</span>
                <span className="text-gray-500">— condition returned true</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-red-400 font-medium">false</span>
                <span className="text-gray-500">— condition returned false</span>
              </div>
            </div>
          </>
        )}

        {node.type === 'delay' && (
          <Field label="Delay (milliseconds)">
            <Input
              type="number"
              value={String(cfg.delayMs || 1000)}
              onChange={(v) => update('delayMs', parseInt(v))}
              placeholder="1000"
            />
            <div className="text-[10px] text-gray-500 mt-1">
              = {((cfg.delayMs || 1000) / 1000).toFixed(2)}s
            </div>
          </Field>
        )}

        {node.type === 'slack_notify' && (
          <>
            <Field label="Slack Webhook URL">
              <Input
                value={cfg.webhookUrl || ''}
                onChange={(v) => update('webhookUrl', v)}
                placeholder="https://hooks.slack.com/services/..."
              />
            </Field>
            <Field label="Message (supports {{input.field}})">
              <textarea
                value={cfg.slackMessage || ''}
                onChange={(e) => update('slackMessage', e.target.value)}
                placeholder="New event: {{input.body.event}}"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </Field>
          </>
        )}

        {node.type === 'log' && (
          <>
            <Field label="Log Level">
              <Select
                value={cfg.level || 'info'}
                onChange={(v) => update('level', v)}
                options={LOG_LEVELS}
              />
            </Field>
            <Field label="Message (supports {{input.field}})">
              <Input
                value={cfg.message || ''}
                onChange={(v) => update('message', v)}
                placeholder="{{input}}"
              />
            </Field>
          </>
        )}

        {node.type === 'email' && (
          <>
            <Field label="To">
              <Input
                value={cfg.to || ''}
                onChange={(v) => update('to', v)}
                placeholder="user@example.com"
              />
            </Field>
            <Field label="Subject">
              <Input
                value={cfg.subject || ''}
                onChange={(v) => update('subject', v)}
                placeholder="Alert: {{input.body.event}}"
              />
            </Field>
            <Field label="Body">
              <textarea
                value={cfg.emailBody || ''}
                onChange={(e) => update('emailBody', e.target.value)}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </Field>
          </>
        )}

        {/* Variable hint */}
        <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
          <div className="text-[10px] font-semibold text-gray-400 mb-1.5">
            Variable Interpolation
          </div>
          <div className="font-mono text-[10px] text-brand-400 space-y-1">
            <div>{'{{input}} — full input object'}</div>
            <div>{'{{input.body.field}} — nested field'}</div>
            <div>{'{{input.headers.x-token}} — header value'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
