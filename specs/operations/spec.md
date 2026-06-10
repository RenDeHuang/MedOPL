# Operations Spec

Owner: `MedOPL Operations`
Purpose: `operations_behavior_spec`
State: `active`
Human index: `docs/delivery/README.md`, `docs/policies/README.md`, `docs/specs/README.md`

## Scope

Operations specs define cloud authorization, billing freeze, release, admin ops, deployment and audit boundaries.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `operations:real-cloud-authorization-boundary` | Operations | `docs/active/README.md`, `docs/delivery/README.md` | `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json` | future-authorized boundary | Real cloud, deploy, kubectl, live-test or build/push is authorized. |
| `operations:tke-bootstrap-preflight` | Operations | `scripts/v22-tke-bootstrap-preflight-plan.mjs`, `docs/specs/README.md`, `changes/archive/2026-06-10-tke-bootstrap-preflight` | `node tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs`; `npm run test:cloud-future-authorized` | local dry-run preflight proof | TKE, NAT, CBS, COS, PostgreSQL, namespaces, workloads or node pools are created; Package C live mutation is authorized; production cloud is ready. |
| `operations:package-c-dry-run-create-release-plan` | Operations | `scripts/v22-tencent-create-release-dry-run-plan.mjs`, `docs/specs/README.md`, `changes/active/package-c-dry-run-create-release-plan` | `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`; `npm run test:cloud-future-authorized` | local dry-run plan proof | Real Tencent Cloud resource mutation, mutation secret reads, Portal ledger writes, billing charges, deploy, kubectl, build/push or production readiness is complete. |
| `operations:release-stop-billing-audit` | Operations | `services/portal`, `docs/specs/README.md` | `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs` | local smoke evidence | Real billing reconciliation or production audit is complete. |
| `operations:refund-signed-ledger` | Operations | `services/medopl-go-backend/internal/server/handlers/portal_projection.go`, `changes/archive/2026-05-28-portal-opl-refund-api-fix` | `go test ./internal/server -run TestGoPortalProjectionAdminActionsPersistLocalState -count=1`; `node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs` | local regression proof | Local refund ledger proof is production billing reconciliation, real payment refund, real cloud billing or production audit readiness. |
| `operations:cloud-connector-fail-closed-precloud` | Operations | `services/medopl-go-backend/internal/server/handlers/cloud_connector.go`, `docs/delivery/README.md` | `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend` | local pre-cloud boundary proof | Cloud connector local status or plan endpoints authorize secret reads, provider calls, resource creation, deploy, kubectl, build/push or live-test. |
| `operations:local-release-orchestration` | Operations | `scripts/v22-local-services.mjs`, `changes/archive/2026-05-27-local-portal-opl-delivery-rc` | `node scripts/v22-local-services.mjs verify --dry-run --json`; `npm run verify:local-release-candidate -- --json` | local release-candidate proof | Local orchestration authorizes secrets, real provider calls, real cloud mutation, deploy, kubectl, build/push or live-test. |
