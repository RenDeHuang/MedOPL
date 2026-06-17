# real-cloud-authorization-boundary Design

## Architecture

The package is a control-plane artifact for the Operations plane. It does not add runtime code. It connects the active cursor to `specs/operations/spec.md`, `docs/policies/README.md`, `docs/evidence/README.md` and local deterministic evals.

## Data Flow

1. `docs/active/README.md` points to this open change package.
2. `spec-delta.md` names the durable operations requirement and any future spec delta.
3. `eval-plan.md` defines local-only verification and the future-authorized dry-run entry.
4. Authorized live evidence, if later approved, must go to an approved evidence sink and only leave a sanitized summary in git.

## Cloud Gate Sequence

The package does not execute cloud work. It locks the order that must happen after separate authorization:

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> readonly inventory
-> authorized create/release
-> Package D deploy readiness planning for platform pool and VPC PostgreSQL
-> authorized deploy
-> canary / QA / status update
```

Readonly quote/inventory, create/release mutation, deploy/kubectl and canary/live-test each require their own operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner. Passing one class never authorizes the next class.

## Failure Modes

- Missing explicit authorization fails closed.
- Secret-like content in the package fails closed.
- A live or production claim without matching evidence fails closed.
- Real-cloud commands remain out of scope for default verification.

## Surface Impact

- source: Go backend contract-only bootstrap and production operation routes plus Portal typed API traces for Production Launch Gap 01 and Gap 02
- docs: `docs/active/README.md`
- specs: `specs/operations/spec.md`
- tests: existing change lifecycle, workflow and future-authorized gates plus the production topology local gate

## Production Launch Gap 01

The bootstrap contract stays repo-native and local-only:

1. `tests/support/cloud-prework/production-launch-bootstrap-runner.js` materializes the redacted contract evidence shape.
2. `services/medopl-go-backend/internal/server/handlers/controlplane.go` exposes fail-closed `/api/v22/production/bootstrap/plan` and `/api/v22/production/bootstrap/commit` routes.
3. `services/portal/frontend/src/api/portal/production-bootstrap.ts` defines the typed Portal API surface for later wiring.
4. The future-authorized production topology gate verifies the runner shape, authorization failure path, providerKeyRef-only boundary and redacted evidence.

The design intentionally stops before live identity provider writes, tenant/workspace creation, Package C execution and external access.

## Production Launch Gap 02

The Package C operation contract stays repo-native and local-only:

1. `tests/support/cloud-prework/production-launch-operation-runner.js` materializes the redacted contract evidence shape.
2. `services/medopl-go-backend/internal/server/handlers/controlplane.go` exposes fail-closed `/api/v22/production/package-c-operation/plan` and `/api/v22/production/package-c-operation/commit` routes.
3. `services/portal/frontend/src/api/portal/production-operation.ts` defines the typed Portal API surface for later wiring.
4. The future-authorized production topology gate verifies the runner shape, authorization failure path, Portal -> Go backend -> Package C trace, ResourceBinding `requested` / `creating` / `ready` state contract, providerKeyRef-only boundary, idempotency and redacted evidence.

The design intentionally stops before Package C live execution, Tencent mutation, production PostgreSQL ledger write/read, billing/quota lifecycle and external access.
