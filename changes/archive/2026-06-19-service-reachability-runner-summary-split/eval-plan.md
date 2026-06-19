# service-reachability-runner-summary-split Eval Plan

## Required Commands

```bash
node --check tests/support/cloud-prework/package-d-service-reachability-runner.js
node --check tests/support/cloud-prework/package-d-service-reachability-summary.js
node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs
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

