import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

if (!process.env.TETREES_TOKEN) {
  throw new Error("Set TETREES_TOKEN to a revocable account token before starting the MCP inspector");
}

const environment = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string"));
environment.TETREES_API_URL ||= "https://ex.tetrees.ai/api";
const packageUrl = "https://ex.tetrees.ai/pkg/tetrees-mcp.tgz?v=2.2.1";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", packageUrl],
  env: environment,
  stderr: "pipe",
});

const client = new Client({ name: "tetrees-public-contract-inspector", version: "1.0.0" });
const expected = [
  "search_ai_packs",
  "list_owned_ai_packs",
  "get_ai_pack_report",
  "get_ai_pack_runtime_profile",
  "quote_agent_run",
  "run_ai_pack",
  "prepare_local_ai_pack_run",
  "execute_client_extension",
  "create_ai_pack_draft",
  "upload_ai_pack",
  "get_ai_pack_submission_readiness",
  "submit_ai_pack_for_audition",
  "get_ai_pack_private_report",
  "publish_ai_pack",
];

try {
  await client.connect(transport);
  const [{ tools }, resources, prompts] = await Promise.all([
    client.listTools(),
    client.listResources().catch(() => ({ resources: [] })),
    client.listPrompts().catch(() => ({ prompts: [] })),
  ]);
  const names = tools.map((tool) => tool.name).sort();
  const missing = expected.filter((name) => !names.includes(name));
  console.log(JSON.stringify({
    transport: "stdio",
    package: packageUrl,
    toolCount: names.length,
    tools: names,
    resources: resources.resources.map((resource) => resource.uri),
    prompts: prompts.prompts.map((prompt) => prompt.name),
    expectedSurfacePresent: missing.length === 0,
    missing,
    mutationsSent: 0,
    pointsSpent: 0,
  }, null, 2));
  if (missing.length) process.exitCode = 1;
} finally {
  await client.close();
}
