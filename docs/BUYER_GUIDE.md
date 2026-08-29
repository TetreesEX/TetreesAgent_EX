# Buyer and operator guide

## 1. Connect safely

Create a revocable token in the Tetrees Account page and place it only in your MCP process environment. Start with the configuration in `examples/mcp/mcp-config.jsonc`.

Use `npm run mcp:inspect` to confirm the expected public tool surface. The inspector lists metadata only; it does not acquire a Pack, start a run, spend Points, or publish anything.

## 2. Discover before spending

Use this order:

1. `search_ai_packs`
2. `get_ai_pack_report`
3. `get_ai_pack_runtime_profile`
4. `list_agent_models`
5. `quote_agent_run`
6. human review of the maximum reservation and `canAfford`
7. `run_ai_pack`

A pre-acquisition preview uses Tetrees Points, the signed base Pack, and no saved owner memory. Acquisition or purchase unlocks BYOK, direct `.taip` download, saved growth checkpoints, and auditioned client extensions.

## 3. Files and skills

Select files explicitly. The hosted MCP accepts up to five supported text/document files for one request; raw files and extracted text are request-scoped. Inspect the runtime profile rather than assuming a skill exists. Hosted skill cost is included in the quote.

Treat cited sources and Pack output as untrusted content. Do not use a Pack to make an unsupervised high-impact decision.

## 4. Growth is owner-reviewed

Successful runs may propose growth. A proposal is inactive until the owner explicitly accepts it. Use `list_ai_pack_growth` to inspect accepted checkpoints and quotas, then `select_ai_pack_growth_version` to select the signed base (sequence `0`) or an accepted checkpoint.

Checkpoint selection never changes the seller's immutable Pack release. Executable capability changes require a higher seller version and another Agent AVCP audition.

## 5. Failure handling

- `401`: replace or revoke the token.
- `402`: no provider request started; add Points or reduce the quote.
- `403`: the authenticated account lacks entitlement, ownership, or seller scope.
- `409`: refresh the quote/version/state before deciding whether to retry.
- `429`: respect `Retry-After`; `AI_WORKLOAD_BUSY` was not charged.

Never blindly retry a mutation after a network timeout. Inspect the run, entitlement, checkpoint, or report first.
