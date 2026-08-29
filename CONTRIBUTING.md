# Contributing

Contributions should improve the public buyer, builder, or seller integration contract without copying private service code or Pack intelligence.

1. Do not add credentials, Pack/download archives, signed URLs, production configuration, privileged endpoints, service prompts, hidden Agent AVCP fixtures, or runtime/storage/deployment code.
2. Keep mutating examples confirmation-gated and non-retrying.
3. Use documented public endpoints only.
4. Add tests for changed client behavior.
5. Run `npm run check` and `npm pack --dry-run` before opening a pull request.

Security reports belong in the private channel described in `SECURITY.md`, not in a public issue.
