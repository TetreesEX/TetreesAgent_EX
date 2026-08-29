import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const DEFAULT_API_URL = "https://ex.tetrees.ai/api";

export class TetreesApiError extends Error {
  constructor(message, { status, code, retryAfter, details } = {}) {
    super(message);
    this.name = "TetreesApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.details = details;
  }
}

function normalizeApiUrl(value) {
  const url = new URL(value || DEFAULT_API_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("TETREES_API_URL must use HTTP or HTTPS");
  return url.toString().replace(/\/+$/, "");
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export class TetreesClient {
  constructor({
    apiUrl = process.env.TETREES_API_URL || DEFAULT_API_URL,
    token = process.env.TETREES_TOKEN,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("A Fetch API implementation is required");
    if (!token || token.includes("replace_me") || token.startsWith("<")) {
      throw new Error("TETREES_TOKEN is required; create a revocable token in your Tetrees account");
    }
    this.apiUrl = normalizeApiUrl(apiUrl);
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(path, { method = "GET", body, headers, signal } = {}) {
    const requestHeaders = new Headers(headers || {});
    requestHeaders.set("authorization", `Bearer ${this.token}`);
    let payload = body;
    if (body !== undefined && !(body instanceof FormData) && typeof body !== "string") {
      requestHeaders.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    const response = await this.fetch(`${this.apiUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: payload,
      signal,
      redirect: "error",
    });
    const result = await parseResponse(response);
    if (!response.ok) {
      const error = result?.error || {};
      throw new TetreesApiError(error.message || result?.message || `Tetrees API request failed (${response.status})`, {
        status: response.status,
        code: error.code || result?.code || "HTTP_ERROR",
        retryAfter: response.headers.get("retry-after"),
        details: result,
      });
    }
    return result;
  }

  tokenStatus() { return this.request("/auth/api-token-status"); }
  search(query = "", limit = 12) { return this.request(`/ai-packs/catalog?q=${encodeURIComponent(query)}&limit=${limit}`); }
  models() { return this.request("/ai-packs/models"); }
  skills() { return this.request("/ai-packs/skills"); }
  workload() { return this.request("/ai-packs/workload/status"); }
  owned() { return this.request("/ai-packs/owned"); }
  runtimeProfile(productId) { return this.request(`/ai-packs/${encodeURIComponent(productId)}/runtime-profile`); }
  publicReport(productId) { return this.request(`/ai-packs/${encodeURIComponent(productId)}/report`); }
  quoteRun(input) { return this.request("/ai-packs/runs/quote", { method: "POST", body: input }); }
  run(productId, input, { providerKey } = {}) {
    const headers = providerKey ? { "x-tetrees-provider-key": providerKey } : undefined;
    return this.request(`/ai-packs/${encodeURIComponent(productId)}/runs`, { method: "POST", body: input, headers });
  }
  acquireFree(productId) { return this.request(`/ai-packs/${encodeURIComponent(productId)}/acquire-free`, { method: "POST", body: {} }); }
  download(productId) { return this.request(`/install/products/${encodeURIComponent(productId)}/download`); }
  growth(productId) { return this.request(`/ai-packs/${encodeURIComponent(productId)}/growth`); }
  selectGrowth(productId, sequence) { return this.request(`/ai-packs/${encodeURIComponent(productId)}/growth/select`, { method: "POST", body: { sequence } }); }
  acceptTerms(surface = "api") { return this.request("/ai-packs/terms/accept", { method: "POST", body: { surface } }); }
  createDraft(input) { return this.request("/seller/products", { method: "POST", body: input }); }
  updateDraft(productId, input) { return this.request(`/seller/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: input }); }
  sellerReadiness(productId) { return this.request(`/seller/products/${encodeURIComponent(productId)}/submission-readiness`); }
  sellerReport(productId) { return this.request(`/seller/products/${encodeURIComponent(productId)}/report`); }
  auditionQuote(productId) { return this.request(`/seller/products/${encodeURIComponent(productId)}/prep-quote`); }

  async uploadImage(productId, filePath) {
    const fullPath = resolve(filePath);
    const extension = extname(fullPath).toLowerCase();
    const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" };
    const contentType = types[extension];
    if (!contentType) throw new Error("Catalogue image must be JPEG, PNG, WebP, or AVIF");
    const bytes = await readFile(fullPath);
    if (bytes.length < 1 || bytes.length > 10 * 1024 * 1024) throw new Error("Catalogue image must contain 1 byte to 10 MB");
    const form = new FormData();
    form.set("image", new Blob([bytes], { type: contentType }), basename(fullPath));
    return this.request(`/seller/products/${encodeURIComponent(productId)}/preview-images`, { method: "POST", body: form });
  }

  async uploadPack(productId, version, filePath, { changelog } = {}) {
    const fullPath = resolve(filePath);
    if (extname(fullPath).toLowerCase() !== ".taip") throw new Error("The release file must use the .taip extension");
    const bytes = await readFile(fullPath);
    if (bytes.length < 1 || bytes.length > 200 * 1024 * 1024) throw new Error("The Pack must contain 1 byte to 200 MB");

    const contract = await this.request(`/seller/products/${encodeURIComponent(productId)}/versions/upload-url`, {
      method: "POST",
      body: { version, contentType: "application/zip" },
    });

    if (contract.strategy === "multipart") {
      const form = new FormData();
      form.set("version", version);
      if (changelog) form.set("changelog", changelog);
      form.set("artifact", new Blob([bytes], { type: "application/zip" }), basename(fullPath));
      return this.request(`/seller/products/${encodeURIComponent(productId)}/versions`, { method: "POST", body: form });
    }

    const upload = new FormData();
    for (const [key, value] of Object.entries(contract.fields || {})) upload.set(key, String(value));
    upload.set("file", new Blob([bytes], { type: "application/zip" }), basename(fullPath));
    const stored = await this.fetch(contract.url, { method: "POST", body: upload, redirect: "error" });
    if (!stored.ok) throw new TetreesApiError(`Private storage upload failed (${stored.status})`, { status: stored.status, code: "STORAGE_UPLOAD_FAILED" });

    return this.request(`/seller/products/${encodeURIComponent(productId)}/versions`, {
      method: "POST",
      body: { version, s3Key: contract.key, changelog },
    });
  }
}

const SECRET_KEY = /(^|_)(authorization|token|secret|password|cookie|provider.?key|api.?key|signed.?url)($|_)/i;

export function redact(value, key = "") {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }
  if (typeof value === "string") {
    return value
      .replace(/\btxk_[A-Za-z0-9._-]+/g, "txk_[REDACTED]")
      .replace(/\bBearer\s+[^\s\"']+/gi, "Bearer [REDACTED]");
  }
  return value;
}

export function createClient(overrides) {
  return new TetreesClient(overrides);
}
