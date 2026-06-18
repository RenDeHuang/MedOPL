# active-package-foldout Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs
node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run test:contract
npm run repo:bloat
git diff --check
```

## Evidence Level

- local lifecycle contract proof
- local workflow gate proof

## Can Claim

- completed active packages are folded into archive provenance.

## Cannot Claim

- runtime, production, deploy, billing, live cloud or public access readiness.
