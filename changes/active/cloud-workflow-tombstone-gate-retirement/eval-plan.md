# cloud-workflow-tombstone-gate-retirement Eval Plan

## Required Commands

```bash
node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs
node tests/contract/contract-test-v22-test-lane-registry.mjs
node tests/contract/contract-test-v22-current-state-index-loop.mjs
node tests/contract/contract-test-v22-real-cloud-readiness-lane.mjs
npm run test:contract
npm run verify
npm run repo:bloat
git diff --check
```

## Evidence Level

- local future-authorized gate proof
- local registry/fixture proof

