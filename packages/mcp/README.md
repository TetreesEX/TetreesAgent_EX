# @tetrees/mcp 2.2.1

The unified MCP server for the Tetrees AI Pack exchange and runtime. One
revocable account token can search, acquire, download, run, grow, upload,
audition and publish owner-bound TAIP/1 assets.

Package identity (must stay aligned across npm, GitHub, and marketplace scanners):

- npm: `@tetrees/mcp@2.2.1`
- MCP name: `ai.tetrees/mcp`
- GitHub: https://github.com/TetreesEX/TetreesAgent_EX
- Transport: stdio only. There is no public Streamable HTTP MCP URL.

## Execution capabilities

- `get_ai_pack_runtime_profile` returns the exact Pack-version tools, hosted
  skill pricing, ephemeral file policy and optional client extensions.
- `quote_agent_run` reserves both model Points and the worst-case cost of
  selected hosted skills. BYOK removes model Points, but a hosted skill still
  requires its disclosed Tetrees Points.
- `run_ai_pack` supports `enabledSkills` and up to five explicit
  `attachmentPaths`. TXT, Markdown, CSV, TSV, JSON, YAML, XML, PDF and DOCX are
  parsed for that request only. Raw files and extracted text are not stored.
- `web_search` is a Pack-declared, bounded hosted read skill that returns source
  evidence. Results are treated as untrusted context.
- `prepare_local_ai_pack_run` validates selected Agent-AVCP extension ids,
  exposes their named read/write method contracts, blocks unapproved writes,
  and explains how a user-controlled MCP host can add
  its own approved tools, resources, prompts and HTTPS APIs. Tetrees hosting
  never silently inherits those permissions.
- `execute_client_extension` performs one method locally after ownership,
  signed-profile, JSON-schema, binding-kind and write-confirmation checks. It
  supports HTTPS APIs, nested MCP tools and no-shell local-skill children while
  keeping their configuration and credentials outside Tetrees hosting.

The server also exposes the `tetrees://runtime/skills` resource and the
`run_ai_pack_with_client_tools` prompt for MCP-native discovery and composition.

## Supported operating paths

### Buyer and agent operator

1. `search_ai_packs`, then acquire a free Pack or complete a paid purchase on
   the website.
2. Inspect `get_ai_pack_report` and `get_ai_pack_runtime_profile` before use.
3. Call `quote_agent_run`; check `availablePoints` and `canAfford` before a
   Points run. BYOK quotes model cost as zero, but selected hosted skills still
   reserve their disclosed Points.
4. Call `run_ai_pack`. File paths are explicit, bounded, request-scoped inputs.
5. Use `propose_ai_pack_growth`, `accept_ai_pack_growth`, and
   `list_ai_pack_growth` for owner-reviewed growth. The growth response includes
   the signed base Pack, available accepted checkpoints, the active checkpoint,
   current usage, and hosted storage limits.
6. Use `select_ai_pack_growth_version` with the exact confirmation
   `SELECT_GROWTH_CHECKPOINT` to pin later runs to the signed base Pack or an
   accepted owner checkpoint. `quote_agent_run` and `run_ai_pack` also accept an
   explicit `growthVersion` for a one-run override.

Accepted memory becomes active only for that owner and Pack. A proposed skill
or evaluation delta is audit evidence, not executable code. Adding or changing
an executable capability requires a higher immutable TAIP/1 version and a new
Agent AVCP audition.

Tetrees-hosted persistence is deliberately bounded: 20 memory checkpoints and
128 KiB per Pack, 100 checkpoints and 1 MiB per account, with 16 KiB per memory.
Proposal history is capped at 40/256 KiB per Pack and 200/2 MiB per account.
These limits do not apply to memory a user keeps in their own local MCP host.
Checkpoint selection never rewrites the immutable seller Pack.

### Maker and publisher

Use `accept_ai_pack_terms`, `create_ai_pack_draft`,
`update_ai_pack_draft`, `upload_ai_pack`, `upload_ai_pack_image`,
`get_ai_pack_submission_readiness`, `submit_ai_pack_for_audition`,
`quote_ai_pack_audition`, `run_ai_pack_audition`,
`get_ai_pack_private_report`, and `publish_ai_pack` in that order. A failed
audition stays private and supplies actionable gates. Publication never flips
a failed digest into a pass.

### Custom MCP, API, and local capabilities

A maker declares client extensions in `manifest.clientExtensions`. Every
method needs a strict object input schema and a matching behavior eval. A write
method also needs `confirmation: "per_call"` and a safety eval. Agent AVCP must
pass `clientExtensionContracts` before publication.

At runtime, call `prepare_local_ai_pack_run` with exact selected extension ids.
Then use `execute_client_extension` for one configured method. A write requires
the exact one-call phrase `APPROVE extensionId.methodId`. Unknown extensions,
undeclared methods, mismatched binding kinds, invalid arguments and unapproved
writes are blocked. Tetrees never executes these client extensions on its
hosted server or inherits their credentials; the user-controlled MCP process
performs the final tool call.

Set `TETREES_CLIENT_EXTENSIONS_FILE` to a local JSON file with `version: 1` and
one binding per extension id. Bindings are controlled by the user, never by the
downloaded Pack:

- `https_api`: an HTTPS `baseUrl` and a method map containing relative path,
  HTTP verb and headers whose values use `env:DECLARED_KEY` references;
- `mcp`: a no-shell command/argument list, declared environment keys and a map
  from Pack method ids to nested MCP tool names;
- `local_skill`: a no-shell command/argument list and method map. The child
  receives one JSON line `{method, arguments}` and must return one JSON value.

Each call is timeout- and output-bounded. Redirects are not followed, response
credentials are redacted, and child processes receive only PATH plus the
environment keys declared by the auditioned Pack and selected local binding.

## Failure and retry behavior

- `401`: invalid, expired, or revoked API token.
- `402`: insufficient Points; no provider request is started.
- `403`: authenticated but outside ownership, entitlement, or seller scope.
- `409`: stale quote/version or an immutable/single-claim conflict.
- `410`: expired download capability or retired route.
- `429`: rate limit, or `AI_WORKLOAD_BUSY` with `Retry-After`. Workload-busy responses are not charged.

Provider-backed runs, Agent AVCP and hosted growth use distributed global,
per-provider and per-user admission limits. Points are debited only after a
request is admitted; stale admitted work is recovered and refunded exactly
once from its durable workload record.

After a mutation timeout, inspect the Pack version, run id, growth sequence, or
private report before retrying. Do not blindly repeat a Point-spending call.

## Install

Node.js 20 or newer is required.

Preferred install after `@tetrees/mcp` is on the public npm registry:

```json
{
  "mcpServers": {
    "tetrees-ai": {
      "command": "npx",
      "args": ["-y", "@tetrees/mcp@2.2.1"],
      "env": {
        "TETREES_API_URL": "https://ex.tetrees.ai/api",
        "TETREES_TOKEN": "<Account API access token>",
        "TETREES_CLIENT_EXTENSIONS_FILE": "</absolute/path/client-extensions.json>",
        "OPENAI_API_KEY": "<optional BYOK>",
        "ANTHROPIC_API_KEY": "<optional BYOK>",
        "ZAI_API_KEY": "<optional BYOK>"
      }
    }
  }
}
```

Hosted tarball fallback (same contract, used until npm publish completes, and as a pin if a client cannot resolve the scoped package):

```json
{
  "mcpServers": {
    "tetrees-ai": {
      "command": "npx",
      "args": ["-y", "https://ex.tetrees.ai/pkg/tetrees-mcp.tgz?v=2.2.1"],
      "env": {
        "TETREES_API_URL": "https://ex.tetrees.ai/api",
        "TETREES_TOKEN": "<Account API access token>"
      }
    }
  }
}
```

Provider keys are read from the MCP process environment only. They are never
accepted as ordinary tool arguments or persisted by Tetrees.

Pin the npm version (`@2.2.1`) or the tarball `?v=` query so clients cannot reuse
a retired cache. Update both together when the public MCP contract changes.

## Develop

```bash
npm install
npm run dev
npm run build
```

The server speaks MCP over stdio. Diagnostics must go to stderr; stdout is
reserved for protocol messages.
