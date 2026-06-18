# agent-verify-manifest-compaction Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
node scripts/v22-verify.mjs list --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local fixture contract proof

## Can Claim

- `agent-verify-manifest.json` no longer stores closed historical leaves.
- The current-state index loop prevents historical leaves from returning to the active manifest.

## Cannot Claim

- Suite/package command duplication has been fully removed.
- Docs/specs, docs/history, Go handlers, workflow gate, runtime behavior or production readiness are complete.
