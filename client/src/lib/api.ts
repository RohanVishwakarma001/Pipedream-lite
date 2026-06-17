const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  pipelines: {
    list: () => req<any[]>('/api/pipelines'),
    get: (id: string) => req<any>(`/api/pipelines/${id}`),
    create: (data: any) => req<any>('/api/pipelines', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req<any>(`/api/pipelines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<any>(`/api/pipelines/${id}`, { method: 'DELETE' }),
    deploy: (id: string) => req<any>(`/api/pipelines/${id}/deploy`, { method: 'POST' }),
    rollback: (id: string, versionId: string) =>
      req<any>(`/api/pipelines/${id}/rollback/${versionId}`, { method: 'POST' }),
    versions: (id: string) => req<any[]>(`/api/pipelines/${id}/versions`),
    runs: (id: string, page = 1) => req<any>(`/api/pipelines/${id}/runs?page=${page}&limit=20`),
    run: (id: string, runId: string) => req<any>(`/api/pipelines/${id}/runs/${runId}`),
    test: (id: string, payload: any) =>
      req<any>(`/api/pipelines/${id}/test`, { method: 'POST', body: JSON.stringify({ payload }) }),
    export: async (id: string, name: string) => {
      const res = await fetch(`${BASE}/api/pipelines/${id}/export`, { method: 'POST' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '-')}.js`;
      a.click();
      URL.revokeObjectURL(url);
    },
    stats: (id: string) => req<any>(`/api/pipelines/${id}/stats`),
  },
};
