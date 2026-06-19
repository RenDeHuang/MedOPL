# package-c-postgres-ledger-env-split Spec Delta

## ADDED

- `framework:package-c-postgres-ledger-env-split` in `specs/framework/spec.md` to bind the sink split.
- `tests/support/cloud-prework/package-c-postgres-ledger-env.js` as the env/redaction helper owner.

## MODIFIED

- `tests/support/cloud-prework/package-c-postgres-ledger-sink.js` imports and re-exports env helpers instead of owning them inline.

## REMOVED

- Inline env parsing, allowlist validation and redaction helper block from the PostgreSQL ledger sink.

## CANNOT-CLAIM

This cleanup does not prove production PostgreSQL readiness, real DB execution, billing ledger completion, Tencent mutation, runtime behavior, production readiness, deploy, kubectl, build/push or live-test.

## EVALS

- `node --check tests/support/cloud-prework/package-c-postgres-ledger-sink.js`
- `node --check tests/support/cloud-prework/package-c-postgres-ledger-env.js`
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs`
- `npm run test:cloud-future-authorized`
- `npm run verify`
