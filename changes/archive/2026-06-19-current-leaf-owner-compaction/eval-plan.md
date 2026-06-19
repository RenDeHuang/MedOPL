# current-leaf-owner-compaction Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/cloud/cloud-test-v22-tencent-deploy-execution-config-local-gate.mjs
node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs
node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local contract proof

## Can Claim

- `current_leaf` no longer duplicates Package D readiness or production launch owner payloads.

## Cannot Claim

- `goal-current.json` is fully compact.
- `agent-verify-manifest.json`, docs/specs, docs/history, Go handlers or workflow gate source are compacted.
- Runtime behavior, deployment, live cloud behavior, billing or production readiness is complete.
