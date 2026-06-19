# package-d-external-access-boundary-split Eval Plan

## Required Commands

```bash
node --check tests/support/cloud-prework/package-d-external-access-runner.js
node --check tests/support/cloud-prework/package-d-external-access-boundary.js
node tests/contract/contract-test-v22-package-d-external-access-edge-nodeport-local-gate.mjs
node tests/contract/contract-test-v22-package-d-external-access-healthcheck-local-gate.mjs
node tests/contract/contract-test-v22-package-d-external-access-remove-healthcheck-local-gate.mjs
npm run test:cloud-future-authorized
npm run test:contract
npm run verify
npm run repo:bloat
npm run line:budget
git diff --check
```

## Evidence Level

- local syntax proof
- local external access gate proof
- default verify proof
