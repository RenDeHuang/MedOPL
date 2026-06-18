# machine-cursor-manifest-compaction Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs
node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local fixture contract proof

## Can Claim

- `release_readiness_state` no longer duplicates the large Package D deploy readiness plan or production launch gap map.
- The no-duplicate rule is enforced by the existing current-state index loop gate in default local verification lanes.

## Cannot Claim

- All machine cursor bloat has been removed.
- The verify manifest is fully compact.
- Docs, Go handlers, workflow gate, runtime behavior, production readiness or cloud execution are complete.
