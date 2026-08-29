# Seller and publisher guide

This guide covers the public lifecycle; it does not describe Pack intelligence or Agent AVCP internals.

## 1. Prepare a buyer-readable listing

The listing must state the problem, target users, inputs, workflow, outputs, at least two concrete examples, success criteria, and limitations. Avoid model hype and undocumented capabilities. Start with `examples/seller/pack-listing.example.json`.

Create a free draft without Stripe Connect:

```bash
node examples/seller/create-draft.mjs ./examples/seller/pack-listing.example.json --confirm-create
```

Stripe Connect is required only before publishing a paid price.

## 2. Package one immutable version

Use a strict higher SemVer and produce one `.taip` release. Do not include credentials, local history, temporary files, unrelated source, or service-private data.

The upload script requests a product/version-bound private storage contract, uploads the file, and commits only the returned storage key. It does not expose storage credentials:

```bash
node examples/seller/upload-pack.mjs <pack-id> 1.1.0 ./release.taip --confirm-upload
```

Uploaded versions are immutable. Fixes use a higher version; version downgrade and overwrite are rejected.

## 3. Add catalogue imagery

Use the hosted MCP `upload_ai_pack_image` tool or documented multipart API. JPEG, PNG, WebP, and AVIF are sanitized. The image must describe the Pack; do not include credentials, unverifiable scores, misleading logos, or copyrighted material you cannot license.

```bash
node examples/seller/upload-image.mjs <pack-id> ./cover.webp --confirm-upload
```

## 4. Check readiness before audition

```bash
node examples/seller/check-readiness.mjs <pack-id>
```

Resolve every missing listing, manifest, version, and image item. Then:

1. `submit_ai_pack_for_audition`
2. `quote_ai_pack_audition`
3. verify exact version, digest, Point cost, and balance
4. `run_ai_pack_audition` with the exact confirmation
5. `get_ai_pack_private_report`
6. fix a failure in a higher immutable version and rerun
7. `publish_ai_pack` only after every mandatory gate passes

A failed report remains private and actionable. Publication cannot convert a failed digest into a pass.

## 5. Updates and retirement

Listing metadata can be updated without overwriting a release. Intelligence or executable capability changes require a higher Pack version and fresh Agent AVCP. Use the Tetrees seller console for commercial status and retirement controls.

## API references

- https://ex.tetrees.ai/en/api-docs
- https://ex.tetrees.ai/docs/tetrees-ai-pack.openapi.yaml
- https://ex.tetrees.ai/docs/tetrees-ai-pack.postman.json
