# workflow-gate-module-split Eval Plan

## Required Commands

```bash
node tests/health/health-check-v22-workflow-gate.mjs
node tests/health/health-check-v22-workflow-command-reference-gate.mjs
node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs
node tests/contract/contract-test-v22-diff-scoped-sensitive-hygiene.mjs
npm run test:health
npm run test:contract
npm run repo:bloat
git diff --check
```

## Evidence Level

- local governance proof
- local command reference proof
- local contract proof

## Cannot Claim

- repo bloat policy already accepts the new helper-module layout.
- deploy, kubectl, build/push, live-test, secret access or real cloud readiness.
