# goal-current-contract-extraction Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs
npm run test:health
npm run test:contract
git diff --check
```

## Evidence Level

- local contract proof

## Can Claim

- `goal-current.json` no longer embeds the Package D or production launch owner payloads.
- Direct test consumers now read the extracted contracts through stable `contracts/**` paths.

## Cannot Claim

- Runtime behavior, deploy behavior, cloud readiness, billing closure or external access completion.
- Full compaction of every remaining owner payload in `goal-current.json`.
