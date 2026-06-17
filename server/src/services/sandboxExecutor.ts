import vm from 'vm';

export interface SandboxResult {
  output: unknown;
  error?: string;
  durationMs: number;
}

export function executeInSandbox(
  code: string,
  input: unknown,
  timeout = 5000
): SandboxResult {
  const start = Date.now();

  const sandbox = {
    input,
    __result: undefined as unknown,
    console: {
      log: (...args: unknown[]) => console.log('[Sandbox]', ...args),
      error: (...args: unknown[]) => console.error('[Sandbox]', ...args),
    },
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
  };

  vm.createContext(sandbox);

  try {
    const wrappedCode = `__result = (function() { ${code} })()`;
    vm.runInContext(wrappedCode, sandbox, { timeout });
    return { output: sandbox.__result ?? null, durationMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: null, error: msg, durationMs: Date.now() - start };
  }
}

export function interpolateTemplate(template: string, input: unknown): unknown {
  try {
    const str = JSON.stringify(input);
    const replaced = template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const keys = path.trim().split('.');
      let value: unknown = input;
      for (const key of keys) {
        if (key === 'input') continue;
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[key];
        } else {
          return '';
        }
      }
      return value !== undefined && value !== null ? String(value) : '';
    });

    try {
      return JSON.parse(replaced);
    } catch {
      return replaced;
    }
  } catch {
    return template;
  }
}
