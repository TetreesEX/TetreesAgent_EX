import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Ajv } from 'ajv';
import { z } from 'zod';

const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_RESULT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const executable = z.string().min(1).max(1_000).refine(
  (value) => isAbsolute(value) || /^[a-zA-Z0-9_.-]+$/.test(value),
  'command must be an absolute path or one bare executable name',
);
const commandArgs = z.array(z.string().max(4_000)).max(64).default([]);
const envKeys = z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)).max(12).default([]);
const methodMap = z.record(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/)).refine(
  (value) => Object.keys(value).length <= 32,
  'method map exceeds 32 entries',
);

const bindingSchema = z.discriminatedUnion('kind', [
  z.object({
    extensionId: z.string().min(2).max(64),
    kind: z.literal('https_api'),
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().min(100).max(60_000).default(DEFAULT_TIMEOUT_MS),
    methods: z.record(z.object({
      path: z.string().regex(/^\/(?!\/)[^\s]*$/).max(2_000),
      httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      headers: z.record(z.string().regex(/^env:[A-Z][A-Z0-9_]{1,63}$/)).refine(
        (value) => Object.keys(value).length <= 24,
        'header map exceeds 24 entries',
      ).default({}),
    }).strict()),
  }).strict(),
  z.object({
    extensionId: z.string().min(2).max(64),
    kind: z.literal('mcp'),
    command: executable,
    args: commandArgs,
    envKeys,
    timeoutMs: z.number().int().min(100).max(60_000).default(DEFAULT_TIMEOUT_MS),
    methods: methodMap,
  }).strict(),
  z.object({
    extensionId: z.string().min(2).max(64),
    kind: z.literal('local_skill'),
    command: executable,
    args: commandArgs,
    envKeys,
    timeoutMs: z.number().int().min(100).max(60_000).default(DEFAULT_TIMEOUT_MS),
    methods: methodMap,
  }).strict(),
]);

const configSchema = z.object({
  version: z.literal(1),
  bindings: z.array(bindingSchema).max(24),
}).strict().superRefine((config, context) => {
  const ids = config.bindings.map((binding) => binding.extensionId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['bindings'], message: 'extension bindings must be unique' });
  }
});

type Binding = z.infer<typeof bindingSchema>;
type DeclaredExtension = {
  id: string;
  kind: 'https_api' | 'mcp' | 'local_skill';
  environmentKeys?: string[];
  methods?: Array<{
    id: string;
    effect: 'read' | 'write';
    confirmation: 'none' | 'per_call';
    inputSchema: Record<string, unknown>;
  }>;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeEnvironment(keys: string[], declaredKeys: string[]): { env: Record<string, string>; secrets: string[] } {
  const allowed = new Set(declaredKeys);
  const env: Record<string, string> = {};
  const secrets: string[] = [];
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  for (const key of keys) {
    if (!allowed.has(key)) throw new Error(`Binding requested undeclared environment key: ${key}`);
    const value = process.env[key];
    if (!value) throw new Error(`Required client extension environment key is missing: ${key}`);
    env[key] = value;
    secrets.push(value);
  }
  return { env, secrets };
}

function redact(value: unknown, secrets: string[]): unknown {
  let serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > MAX_RESULT_BYTES) throw new Error('Client extension result exceeds 1 MiB');
  for (const secret of secrets.filter((item) => item.length >= 4)) serialized = serialized.split(secret).join('[REDACTED]');
  serialized = serialized
    .replace(/sk-(?:proj|ant)-[A-Za-z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._\-+=\/]{8,}/gi, 'Bearer [REDACTED]')
    .replace(/\btxk_[A-Za-z0-9._-]{8,}/g, '[REDACTED]')
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED]');
  try { return JSON.parse(serialized); } catch { return '[unserializable extension result]'; }
}

async function loadBinding(extensionId: string): Promise<Binding> {
  const configPath = process.env.TETREES_CLIENT_EXTENSIONS_FILE;
  if (!configPath) throw new Error('TETREES_CLIENT_EXTENSIONS_FILE is required for client extension execution');
  const bytes = await readFile(resolve(configPath));
  if (!bytes.length || bytes.length > MAX_CONFIG_BYTES) throw new Error('Client extension configuration must contain 1 byte to 256 KiB');
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Client extension configuration must be valid JSON'); }
  const parsed = configSchema.parse(raw);
  const binding = parsed.bindings.find((item) => item.extensionId === extensionId);
  if (!binding) throw new Error(`No client-owned binding is configured for ${extensionId}`);
  return binding;
}

function validateArguments(schema: Record<string, unknown>, input: Record<string, unknown>) {
  const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: false, useDefaults: false, $data: false });
  const validate = ajv.compile(schema);
  const valid = validate(input);
  if (!valid) {
    const details = ajv.errorsText(validate.errors || [], { separator: '; ' });
    throw new Error(`Client extension arguments do not match the auditioned schema: ${details}`);
  }
}

function assertHttpsOrigin(url: URL) {
  if (url.username || url.password) throw new Error('Client extension URL must not contain credentials');
  if (url.protocol === 'https:') return;
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(url.hostname);
  if (url.protocol === 'http:' && loopback && process.env.TETREES_ALLOW_INSECURE_LOOPBACK === '1') return;
  throw new Error('HTTPS is required; insecure HTTP is allowed only for an explicitly enabled loopback QA fixture');
}

async function readBoundedResponse(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESULT_BYTES) throw new Error('Client extension response exceeds 1 MiB');
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESULT_BYTES) {
      await reader.cancel();
      throw new Error('Client extension response exceeds 1 MiB');
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  const contentType = response.headers.get('content-type') || '';
  if (/json/i.test(contentType)) {
    try { return text ? JSON.parse(text) : null; } catch { throw new Error('Client extension returned invalid JSON'); }
  }
  return text;
}

async function executeHttps(binding: Extract<Binding, { kind: 'https_api' }>, methodId: string, input: Record<string, unknown>, declaredKeys: string[]) {
  const method = binding.methods[methodId];
  if (!method) throw new Error(`No HTTPS binding exists for method ${methodId}`);
  const baseUrl = new URL(binding.baseUrl);
  assertHttpsOrigin(baseUrl);
  const url = new URL(method.path, baseUrl);
  if (url.origin !== baseUrl.origin) throw new Error('Client extension method cannot change the configured origin');
  const referencedKeys = Object.values(method.headers).map((value) => value.slice(4));
  const { secrets } = safeEnvironment(referencedKeys, declaredKeys);
  const headers = new Headers({ accept: 'application/json', 'user-agent': 'tetrees-mcp-client-extension/1' });
  for (const [name, reference] of Object.entries(method.headers)) headers.set(name, process.env[reference.slice(4)]!);
  let body: string | undefined;
  if (['GET', 'DELETE'].includes(method.httpMethod)) {
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } else {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(input);
  }
  const response = await fetch(url, {
    method: method.httpMethod,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(binding.timeoutMs),
  });
  if (response.status >= 300 && response.status < 400) throw new Error('Client extension redirects are not followed');
  const result = await readBoundedResponse(response);
  if (!response.ok) throw new Error(`Client extension HTTP ${response.status}: ${JSON.stringify(redact(result, secrets)).slice(0, 2_000)}`);
  return redact(result, secrets);
}

async function executeNestedMcp(binding: Extract<Binding, { kind: 'mcp' }>, methodId: string, input: Record<string, unknown>, declaredKeys: string[]) {
  const toolName = binding.methods[methodId];
  if (!toolName) throw new Error(`No nested MCP binding exists for method ${methodId}`);
  const { env, secrets } = safeEnvironment(binding.envKeys, declaredKeys);
  const child = spawn(binding.command, binding.args, { env, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buffer = '';
  let stderr = Buffer.alloc(0);
  let nextId = 1;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  const rejectAll = (error: Error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };
  child.on('error', rejectAll);
  child.stderr.on('data', (chunk) => { stderr = Buffer.concat([stderr, chunk]).subarray(0, 64 * 1024); });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > MAX_RESULT_BYTES) {
      child.kill('SIGKILL');
      rejectAll(new Error('Nested MCP output exceeds 1 MiB'));
      return;
    }
    while (buffer.includes('\n')) {
      const at = buffer.indexOf('\n');
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      const waiter = pending.get(Number(message.id));
      if (!waiter) continue;
      pending.delete(Number(message.id));
      if (message.error) waiter.reject(new Error(String(message.error.message || 'Nested MCP error')));
      else waiter.resolve(message.result);
    }
  });
  child.on('close', (code) => {
    if (pending.size) rejectAll(new Error(`Nested MCP exited ${code}: ${String(redact(stderr.toString('utf8'), secrets)).slice(0, 2_000)}`));
  });
  const request = <T = any>(method: string, params: Record<string, unknown> = {}) => {
    const id = nextId++;
    const response = new Promise<T>((resolvePromise, reject) => {
      pending.set(id, { resolve: resolvePromise, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
    return withTimeout(response, binding.timeoutMs, `Nested MCP ${method} timed out`);
  };
  try {
    await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'tetrees-client-extension-runner', version: '1.0.0' } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
    const tools = await request<{ tools: Array<{ name: string }> }>('tools/list');
    if (!tools.tools.some((tool) => tool.name === toolName)) throw new Error(`Configured nested MCP tool is unavailable: ${toolName}`);
    const result = await request('tools/call', { name: toolName, arguments: input });
    return redact(result, secrets);
  } finally {
    child.stdin.end();
    child.kill('SIGTERM');
  }
}

async function executeLocalSkill(binding: Extract<Binding, { kind: 'local_skill' }>, methodId: string, input: Record<string, unknown>, declaredKeys: string[]) {
  const mappedMethod = binding.methods[methodId];
  if (!mappedMethod) throw new Error(`No local skill binding exists for method ${methodId}`);
  const { env, secrets } = safeEnvironment(binding.envKeys, declaredKeys);
  const result = await new Promise<unknown>((resolvePromise, reject) => {
    const child = spawn(binding.command, binding.args, { env, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolvePromise(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Local skill timed out'));
    }, binding.timeoutMs);
    child.on('error', (error) => finish(error));
    child.stdout.on('data', (chunk) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > MAX_RESULT_BYTES) {
        child.kill('SIGKILL');
        finish(new Error('Local skill output exceeds 1 MiB'));
      }
    });
    child.stderr.on('data', (chunk) => { stderr = Buffer.concat([stderr, chunk]).subarray(0, 64 * 1024); });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return finish(new Error(`Local skill exited ${code}: ${String(redact(stderr.toString('utf8'), secrets)).slice(0, 2_000)}`));
      try { finish(undefined, JSON.parse(stdout.toString('utf8'))); }
      catch { finish(new Error('Local skill must return one JSON value on stdout')); }
    });
    child.stdin.end(`${JSON.stringify({ method: mappedMethod, arguments: input })}\n`);
  });
  return redact(result, secrets);
}

export async function executeClientExtension(input: {
  extension: DeclaredExtension;
  methodId: string;
  arguments: Record<string, unknown>;
  writeConfirmation?: string;
}) {
  const method = input.extension.methods?.find((item) => item.id === input.methodId);
  if (!method) throw new Error(`Pack did not declare client extension method: ${input.extension.id}.${input.methodId}`);
  const expectedApproval = `APPROVE ${input.extension.id}.${input.methodId}`;
  if (method.effect === 'write' && input.writeConfirmation !== expectedApproval) {
    throw new Error(`Write method requires this exact one-call confirmation: ${expectedApproval}`);
  }
  validateArguments(method.inputSchema, input.arguments);
  const binding = await loadBinding(input.extension.id);
  if (binding.kind !== input.extension.kind) throw new Error('Client binding kind does not match the signed Pack declaration');
  const declaredKeys = input.extension.environmentKeys || [];
  let result: unknown;
  if (binding.kind === 'https_api') result = await executeHttps(binding, input.methodId, input.arguments, declaredKeys);
  else if (binding.kind === 'mcp') result = await executeNestedMcp(binding, input.methodId, input.arguments, declaredKeys);
  else result = await executeLocalSkill(binding, input.methodId, input.arguments, declaredKeys);
  return {
    extensionId: input.extension.id,
    methodId: input.methodId,
    effect: method.effect,
    executedBy: 'client',
    result,
  };
}
