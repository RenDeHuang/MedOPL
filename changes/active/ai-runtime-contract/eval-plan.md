# ai-runtime-contract Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs
node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-spec-eval-traceability.mjs
node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs
npm --prefix services/portal/frontend run typecheck
sentrux gate .
sentrux check .
```

## Evidence Level

- local contract proof
- local smoke evidence
- structural gate evidence

## Can Claim

- AI Runtime Contract is represented as a durable Runtime spec boundary.
- Runtime Bridge remains the Runtime Bridge AI runtime adapter layer.
- MCP-compatible boundary has a Runtime Bridge-owned local shape-only projection in `runtime-bridge-mcp-compatible-shapes.mjs` for tools / resources / prompts / artifacts / approval compatibility.
- AI MVP readiness can be audited as local contract evidence across MVP suite, pre-cloud RC, local Portal/OPL delivery RC, AI Runtime Contract, Runtime Bridge local E2E proofs, real-cloud authorization blocker and Sentrux structure gate status.
- six-step AI MVP readiness can claim `local_ai_mvp_readiness_only` after current fix branch closeout, Portal structure quality recovery, E2E MVP verification, AI Runtime Contract, Runtime Bridge AI runtime layer and MCP-compatible boundary design are locally verified.

## Cannot Claim

- Production MCP server, external MCP client access, real cloud, deploy, kubectl, build/push, live-test or production runtime readiness is authorized or verified.
- Raw provider key, bearer token, launchToken, runtimeToken, objectKey, localPath, signedUrl or presignedUrl may cross public projection.
- Local relay proof is live provider or production cloud evidence.
- Production, real-cloud or deploy readiness is implied by local Sentrux structural readiness.
- Six-step AI MVP readiness is not real_cloud_ready, production_online, deploy_ready, secret_authorized or live_test_authorized; post-six-step cloud gate still requires real-cloud authorization boundary, mock/snapshot provider, readonly quote, dry-run plan, readonly inventory, authorized create/release, authorized deploy and canary / QA / status update.
