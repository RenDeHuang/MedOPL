# current-leaf-owner-compaction-closeout-sync Eval Plan

## Required Commands

```bash
node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json
node scripts/v22-landing-closeout.mjs check --trunk-ref HEAD --json
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/contract/contract-test-v22-landing-closeout-automation.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local governance closeout proof

## Can Claim

- The landed current leaf compaction package is represented in history, active, delivery and machine cursor state.
- Cleanup closeout commits are allowed after a landed cleanup commit when every intervening commit is closeout-only.

## Cannot Claim

- Additional cleanup, runtime behavior, deployment, live cloud behavior, billing or production readiness are complete.
