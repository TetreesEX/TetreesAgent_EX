# Builder guide: local capabilities

Tetrees AI Packs can declare client extensions for HTTPS APIs, nested MCP tools, and no-shell local skills. The declaration is part of an immutable Pack version and must pass Agent AVCP. The binding in this repository is user-owned configuration; it does not add an undeclared capability to a Pack.

## Safe workflow

1. Inspect `get_ai_pack_runtime_profile` and copy only an extension id you intend to use.
2. Verify its binding `kind`, environment keys, method ids, input schemas, and read/write effects.
3. Create a local binding file based on `examples/extensions/client-extensions.example.json`.
4. Set `TETREES_CLIENT_EXTENSIONS_FILE` to its absolute path.
5. Call `prepare_local_ai_pack_run` with exact selected extension ids.
6. Call `execute_client_extension` for one declared method.
7. For a write, approve that call only with `APPROVE extensionId.methodId`.

## What remains local

- API/MCP credentials and extension configuration.
- The command and arguments used to start a nested MCP server or local skill.
- All capabilities that were not explicitly selected for the current plan.

The local runner passes only declared environment keys, launches child processes without a shell, bounds time/output, validates arguments against the Pack's auditioned JSON schema, and redacts configured secrets from returned output.

## HTTPS API binding

Use a fixed HTTPS base URL. Header values refer to local environment variables with `env:NAME`; never store a credential literal. Redirects are not followed. Use a narrow service credential, not a general user or infrastructure credential.

## Nested MCP binding

Map each Pack method id to one exact tool exposed by the nested MCP server. Prefer a pinned, reviewed package and a read-only credential. The local runner initializes it, verifies the mapped tool exists, executes one call, then terminates the process.

## Local skill binding

The child receives one JSON line:

```json
{"method":"summarize_issue","arguments":{"title":"...","body":"..."}}
```

It must return one JSON value on stdout. Diagnostics belong on stderr. See `examples/extensions/local-skill/issue-summary.mjs` for a deterministic, read-only example.

## Publishing a new extension

A seller must declare strict object input schemas and behavior evaluations for every method. Write methods require per-call confirmation and safety evaluations. Agent AVCP must pass the client-extension contract gate before the Pack can be published. A local binding cannot bypass this process.
