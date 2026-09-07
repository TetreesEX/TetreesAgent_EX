# Tetrees AI

Tetrees AI is an Agent-Asset Exchange. Discover, run, grow and trade TAIP/1 AI Packs through one MCP — GPU-free agent-layer growth on hosted or BYOK models.

## Product

- Website: https://ex.tetrees.ai/en
- MCP docs: https://ex.tetrees.ai/en/mcp
- Package: `@tetrees/mcp@2.2.1` (`ai.tetrees/mcp`)
- Transport: stdio only. Do not invent a remote Streamable HTTP MCP URL.

## Install

```json
{
  "mcpServers": {
    "tetrees-ai": {
      "command": "npx",
      "args": ["-y", "@tetrees/mcp@2.2.1"],
      "env": {
        "TETREES_API_URL": "https://ex.tetrees.ai/api",
        "TETREES_TOKEN": "<revocable-account-token>"
      }
    }
  }
}
```

Until the scoped package is on the public npm registry, use the hosted tarball `https://ex.tetrees.ai/pkg/tetrees-mcp.tgz?v=2.2.1` as the npx argument.

## Agent notes

- Create a free account on ex.tetrees.ai, mint a revocable `TETREES_TOKEN`, then `search_ai_packs` and `quote_agent_run` before `run_ai_pack`.
- BYOK keys stay in the local MCP process environment and are never stored by Tetrees.
- This repository is the public MCP client, examples, and contract — not Tetrees Agent internals, private Pack intelligence, or Agent AVCP scoring.
