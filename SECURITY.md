# Security policy

## Report a vulnerability

Do not open a public issue for a vulnerability, exposed token, entitlement bypass, Pack extraction issue, or write-confirmation bypass. Report it privately to **business@insightvessel.io** with reproduction steps and the affected public endpoint or client version. Do not include unrelated personal data or third-party credentials.

## Credential rules

- Use a revocable Tetrees API token and keep it in the local process environment.
- Keep model-provider keys and extension credentials in the local MCP environment only.
- Never commit `.env`, Pack files, downloaded artifacts, provider keys, API tokens, cookies, signed download URLs, or client-extension secrets.
- Revoke a token immediately if it is exposed.

## Execution boundary

The code here is a public client. Hosted execution, entitlement, Pack validation, Agent AVCP, signing, storage, and Points accounting remain server-side. Client checks improve usability but never replace server authorization.

Mutating examples require explicit flags. They do not automatically retry a timeout because a server-side mutation may already have completed. Inspect the resulting run, version, report, or entitlement before retrying.

## Supported versions

The examples follow the current public Tetrees MCP and API contract linked from the README. Security fixes are applied to the default branch.
