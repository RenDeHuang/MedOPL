# package-d-external-access-boundary-split Spec Delta

## ADDED

- `framework:package-d-external-access-boundary-split` in `specs/framework/spec.md` to bind the runner split.
- `tests/support/cloud-prework/package-d-external-access-boundary.js` as the argv/mode/env/run-gate boundary helper owner.

## MODIFIED

- `tests/support/cloud-prework/package-d-external-access-runner.js` imports boundary helpers instead of owning them inline.

## REMOVED

- Inline argv, mode, env allowlist and run-gate helper block from the external access runner.

## CANNOT-CLAIM

This cleanup does not prove runtime behavior, production readiness, deploy, billing, real cloud, kubectl, build/push, DNS mutation, live-test, public access, Tencent mutation or secret access.

## EVALS

- `node --check tests/support/cloud-prework/package-d-external-access-runner.js`
- `node --check tests/support/cloud-prework/package-d-external-access-boundary.js`
- `node tests/contract/contract-test-v22-package-d-external-access-edge-nodeport-local-gate.mjs`
- `node tests/contract/contract-test-v22-package-d-external-access-healthcheck-local-gate.mjs`
- `node tests/contract/contract-test-v22-package-d-external-access-remove-healthcheck-local-gate.mjs`
- `npm run test:cloud-future-authorized`
- `npm run verify`
