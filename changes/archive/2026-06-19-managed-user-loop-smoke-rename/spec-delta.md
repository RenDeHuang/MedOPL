# managed-user-loop-smoke-rename Spec Delta

## ADDED

- `framework:managed-user-loop-smoke-rename` in `specs/framework/spec.md` to bind active smoke rename cleanup.

## MODIFIED

- `tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs` is renamed to `tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs`.
- `scripts/v22-test-classification.mjs` points the smoke lane to the managed user loop file.
- `framework:managed-user-loop-smoke-rename` records the managed user loop test/product group and its smoke-lane eval.

## REMOVED

- Active `mvp-user-loop` test filename and assertion identifiers from the smoke lane surface.

## CANNOT-CLAIM

This cleanup does not prove runtime behavior, production readiness, deploy, billing, real cloud, kubectl, build/push, live-test, public access, Tencent mutation or secret access.

## EVALS

- `node tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `npm run test:smoke`
- `npm run test:contract`
- `npm run verify`
