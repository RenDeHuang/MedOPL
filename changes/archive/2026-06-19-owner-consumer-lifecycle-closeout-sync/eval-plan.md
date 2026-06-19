# owner-consumer-lifecycle-closeout-sync Eval Plan

## Required Commands

```bash
node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json
node tests/governance/governance-test-v22-landing-closeout-automation.mjs
node tests/governance/governance-test-v22-current-state-index-loop.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local governance closeout proof

## Can Claim

- The landed owner-consumer lifecycle cleanup branch is represented in active, delivery, history and machine cursor state.
- Landing closeout automation no longer requires retired landed branch refs to remain locally available.

## Cannot Claim

- Runtime behavior, deployment, live cloud behavior, billing, production readiness or real-cloud authorization is complete.
