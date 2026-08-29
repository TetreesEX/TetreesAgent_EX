import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { TetreesClient, TetreesApiError, redact } from "../src/api-client.mjs";

let server;
let apiUrl;
const requests = [];

before(async () => {
  server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString("utf8") });
      response.setHeader("content-type", "application/json");
      if (request.url === "/api/fail") {
        response.statusCode = 429;
        response.setHeader("retry-after", "7");
        return response.end(JSON.stringify({ error: { code: "AI_WORKLOAD_BUSY", message: "Try later" } }));
      }
      response.end(JSON.stringify({ ok: true, url: request.url, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("rejects missing and placeholder tokens before a request", () => {
  assert.throws(() => new TetreesClient({ apiUrl, token: "" }), /TETREES_TOKEN/);
  assert.throws(() => new TetreesClient({ apiUrl, token: "txk_replace_me" }), /TETREES_TOKEN/);
});

test("sends a bearer token and encoded catalogue query", async () => {
  const client = new TetreesClient({ apiUrl, token: "test-token" });
  const result = await client.search("risk & evidence", 5);
  assert.equal(result.ok, true);
  const request = requests.at(-1);
  assert.equal(request.authorization, "Bearer test-token");
  assert.equal(request.url, "/api/ai-packs/catalog?q=risk%20%26%20evidence&limit=5");
});

test("uses the production catalogue path and leaves response collections intact", async () => {
  const client = new TetreesClient({
    apiUrl,
    token: "test-token",
    fetchImpl: async (url, init) => new Response(JSON.stringify({ packs: [{ id: "pack-1" }], total: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  const result = await client.search("research", 1);
  assert.deepEqual(result.packs, [{ id: "pack-1" }]);
});

test("serializes quote input exactly once", async () => {
  const client = new TetreesClient({ apiUrl, token: "test-token" });
  const input = { productId: "00000000-0000-4000-8000-000000000000", model: "provider:model", fundingMode: "points" };
  const result = await client.quoteRun(input);
  assert.deepEqual(result.body, input);
  assert.equal(requests.at(-1).method, "POST");
});

test("returns stable error metadata and Retry-After", async () => {
  const client = new TetreesClient({ apiUrl, token: "test-token" });
  await assert.rejects(client.request("/fail"), (error) => {
    assert(error instanceof TetreesApiError);
    assert.equal(error.status, 429);
    assert.equal(error.code, "AI_WORKLOAD_BUSY");
    assert.equal(error.retryAfter, "7");
    return true;
  });
});

test("redacts secret-shaped keys and values", () => {
  const value = redact({ token: "sensitive", nested: { authorization: "Bearer secret-value" }, text: "token txk_demo-value" });
  assert.equal(value.token, "[REDACTED]");
  assert.equal(value.nested.authorization, "[REDACTED]");
  assert.equal(value.text, "token txk_[REDACTED]");
});
