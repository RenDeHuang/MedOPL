# opl-discipline-post-merge-closeout-sync Eval Plan

## Required Commands

```bash
node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local governance closeout proof

## Can Claim

- The landed OPL-style discipline package is represented in history, active, delivery and machine cursor state.

## Cannot Claim

- Cleanup packages, runtime behavior, deployment, live cloud behavior, billing or production readiness are complete.
