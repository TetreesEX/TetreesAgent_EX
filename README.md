# Tetrees Agent EX

Public integration kit for using, growing, buying, and publishing **Tetrees AI Packs** through the hosted Tetrees Agent MCP and API.

This repository makes the developer-facing contract transparent. It intentionally contains clients, configuration examples, and safe extension samples—not Tetrees Agent internals, private Pack intelligence, Agent AVCP scoring, service prompts, storage, moderation, or exchange infrastructure.

## What you can build

| Path | Use this kit to |
| --- | --- |
| Buyer / operator | Search Packs, inspect the public Agent AVCP report, quote a run, try a Pack with Tetrees Points, acquire a free Pack, and download an owned `.taip` release. |
| Builder | Connect an auditioned Pack to a user-owned HTTPS API, nested MCP server, or no-shell local skill while keeping credentials local. |
| Seller | Create a listing, upload an immutable `.taip` version and images, inspect readiness, run Agent AVCP, read private repair feedback, and publish a passing release. |

Tetrees-hosted work needs no local GPU. Model-funded runs are quoted in Tetrees Points before execution; an owned Pack can also use a supported provider key supplied to the local MCP process.

## Quick start: hosted MCP

Requirements: Node.js 20+ and a revocable API token from [Tetrees Account](https://ex.tetrees.ai/en/account).

Add this to your MCP client's configuration:

```json
{
  "mcpServers": {
    "tetrees-ai": {
      "command": "npx",
      "args": ["-y", "https://ex.tetrees.ai/pkg/tetrees-mcp.tgz?v=2.2.0"],
      "env": {
        "TETREES_API_URL": "https://ex.tetrees.ai/api",
        "TETREES_TOKEN": "<revocable-account-token>"
      }
    }
  }
}
```

Restart the MCP client, then ask it to:

```text
Search Tetrees AI Packs for repository issue triage. Show the public Agent AVCP
report and runtime profile for the best match, then quote an 8k/2k Point-funded
run. Do not run it until I approve the quoted maximum.
```

Do not put provider keys in a Pack, prompt, source file, or shared MCP config. Optional BYOK keys belong only in the local MCP process environment. See [`examples/mcp/mcp-config.jsonc`](examples/mcp/mcp-config.jsonc).

## Inspect the MCP contract

```bash
npm install
export TETREES_TOKEN="txk_..."
npm run mcp:inspect
```

The inspector launches the official hosted MCP package, lists its public tools and resources, checks the expected buyer/builder/seller surface, and exits without spending Points or changing account state.

The `v=2.2.0` suffix is intentional: it prevents `npx` from reusing an older MCP tarball cached under the same URL. Change it only when Tetrees publishes a newer MCP contract.

## Public API CLI

Copy `.env.example` values into your shell; this project deliberately does not auto-load secret files.

```bash
export TETREES_TOKEN="txk_..."

# Read-only calls
npm run tetrees -- status
npm run tetrees -- catalog "research"
npm run tetrees -- models
npm run tetrees -- skills
npm run tetrees -- owned
npm run tetrees -- runtime <pack-id>
npm run tetrees -- report <pack-id>

# Quote first. This never starts a model request.
npm run tetrees -- quote <pack-id> <model-id>

# A Point-spending run needs the exact confirmation flag.
npm run tetrees -- run <pack-id> <model-id> "Your task" --confirm-spend
```

The CLI redacts secret-shaped response fields and reports Tetrees error codes, HTTP status, and `Retry-After`. It does not retry a mutation automatically.

## Buyer flow

1. Search for a Pack.
2. Inspect its public Agent AVCP report and runtime profile.
3. Quote the exact model, token ceiling, hosted skills, and growth checkpoint.
4. Run a Point-funded stateless preview. Unused reserved Points return.
5. Acquire a free Pack or buy a paid Pack on Tetrees EX.
6. Ownership unlocks download, BYOK, saved growth, and client extensions.

Run the documented read-only example:

```bash
node examples/buyer/discover-and-quote.mjs "incident response"
```

## Builder flow: add capabilities without giving them to Tetrees

A published Pack may declare client extensions that passed Agent AVCP. The actual binding and credentials remain on the user's machine.

Supported binding patterns:

- `https_api`: fixed HTTPS base URL, declared methods, environment-backed headers.
- `mcp`: a nested MCP server started without a shell and mapped to declared tool names.
- `local_skill`: a no-shell child process receiving one JSON request and returning one JSON result.

Start with:

- [`examples/extensions/client-extensions.example.json`](examples/extensions/client-extensions.example.json)
- [`examples/extensions/local-skill/issue-summary.mjs`](examples/extensions/local-skill/issue-summary.mjs)
- [`docs/BUILDER_GUIDE.md`](docs/BUILDER_GUIDE.md)

Tetrees hosting never inherits these local permissions. A write method needs the exact per-call phrase `APPROVE extensionId.methodId`.

## Seller flow

The supported publisher path is intentionally contract-driven:

```bash
# Read-only readiness/report inspection
node examples/seller/check-readiness.mjs <pack-id>

# Upload one higher immutable version. Requires explicit confirmation.
node examples/seller/upload-pack.mjs <pack-id> 1.1.0 ./release.taip --confirm-upload
```

Then use the hosted MCP tools or [Tetrees API reference](https://ex.tetrees.ai/en/api-docs) to submit, quote Agent AVCP, run it after confirming the exact Point amount, inspect the private report, and publish only the passing digest.

See [`docs/SELLER_GUIDE.md`](docs/SELLER_GUIDE.md) and [`examples/seller/pack-listing.example.json`](examples/seller/pack-listing.example.json).

## Stable public references

- [MCP guide](https://ex.tetrees.ai/en/mcp)
- [API documentation](https://ex.tetrees.ai/en/api-docs)
- [OpenAPI 3.1](https://ex.tetrees.ai/docs/tetrees-ai-pack.openapi.yaml)
- [Postman collection](https://ex.tetrees.ai/docs/tetrees-ai-pack.postman.json)
- [AI Pack catalogue](https://ex.tetrees.ai/en/products)

## Security and product boundary

This repository does **not** contain:

- Tetrees Agent implementation, private Pack contents, memory representation, or growth logic;
- Agent AVCP scoring rules, internal evaluation fixtures, service prompts, or moderation logic;
- model-provider credentials, pricing margins, signing keys, storage details, databases, admin APIs, deployment code, or production configuration.

The examples operate only through the documented public, authenticated contract. Review [`SECURITY.md`](SECURITY.md) and [`docs/PUBLIC_BOUNDARY.md`](docs/PUBLIC_BOUNDARY.md) before contributing.

## Verify this repository

```bash
npm test
npm run check:public-boundary
npm pack --dry-run
```

## License

The client examples and documentation in this repository are MIT licensed. Tetrees, Tetrees Agent, Tetrees AI Pack, TAIP, and Agent AVCP names and service marks remain the property of Tetrees EX. The license does not grant access to, or rights in, the hosted service or private Pack intelligence.
