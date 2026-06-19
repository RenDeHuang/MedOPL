# No Redis Cloud Topology Contract Eval Plan

Owner: `MedOPL`
Purpose: `eval_plan`
State: `active`
Machine boundary: Commands below are repo-local evals; they do not authorize secret, cloud, deploy, kubectl, build/push or live-test.

## Target Evals

- `node tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs`
- `node tests/contract/contract-test-v22-current-development-lines.mjs`
- `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`
- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`

## Standard Evals

- `npm run test:health`
- `npm run test:smoke`
- `npm run test:contract`
- `npm run test:real-cloud-readiness`
- `npm run test:regression`
- `npm run gate:review`
- `npm run verify`
- `git diff --check -- docs specs changes tests scripts package.json compose.product.yaml`
