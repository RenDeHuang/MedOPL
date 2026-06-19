# managed-user-loop-smoke-rename Eval Plan

## Required Commands

```bash
node tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
npm run test:smoke
npm run test:contract
npm run verify
npm run repo:bloat
git diff --check
```

## Evidence Level

- local smoke-golden proof
- local registry proof

