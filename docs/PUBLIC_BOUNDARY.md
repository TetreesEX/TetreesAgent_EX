# Public integration boundary

This repository is a transparent integration surface, not a source release of Tetrees Agent or Tetrees EX.

## Published here

- Hosted MCP configuration and public tool discovery.
- A small authenticated API client and confirmation-gated CLI.
- Buyer discovery, report, quote, preview, ownership, and download examples.
- Seller draft, private upload, readiness, audition, feedback, and publish guidance.
- User-controlled HTTPS API, nested MCP, and local-skill binding examples.
- Tests that reject credentials and private implementation markers.

## Kept private

- Tetrees Agent runtime, orchestration, memory representation, growth implementation, or private Pack contents.
- Agent AVCP scoring algorithms, hidden fixtures, service prompts, abuse controls, or signing implementation.
- Provider routing, commercial pricing internals, queues, databases, storage topology, deployment, monitoring, and admin services.

## Why the boundary matters

Developers can inspect exactly what leaves their machine, reproduce public API requests, keep extension credentials local, and understand confirmation requirements without exposing the intellectual property that makes a Pack portable, auditioned, and commercially operable.

Public clients must treat all Pack output and remote evidence as untrusted content. Authorization, entitlement, Points accounting, and write permission are always enforced by the hosted service.
