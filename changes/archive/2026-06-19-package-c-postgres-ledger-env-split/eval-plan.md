# package-c-postgres-ledger-env-split Eval Plan

## Required Commands

```bash
node --check tests/support/cloud-prework/package-c-postgres-ledger-sink.js
node --check tests/support/cloud-prework/package-c-postgres-ledger-env.js
node tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs
npm run test:cloud-future-authorized
npm run test:contract
npm run verify
npm run repo:bloat
npm run line:budget
git diff --check
```

## Evidence Level

- local syntax proof
- local future-authorized gate proof
- default verify proof
