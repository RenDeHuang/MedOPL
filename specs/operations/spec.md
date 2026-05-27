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
| `operations:release-stop-billing-audit` | Operations | `services/portal`, `docs/specs/README.md` | `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs` | local smoke evidence | Real billing reconciliation or production audit is complete. |
| `operations:cloud-connector-fail-closed-precloud` | Operations | `services/medopl-go-backend/internal/server/handlers/cloud_connector.go`, `docs/delivery/README.md` | `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend` | local pre-cloud boundary proof | Cloud connector local status or plan endpoints authorize secret reads, provider calls, resource creation, deploy, kubectl, build/push or live-test. |
| `operations:local-release-orchestration` | Operations | `scripts/v22-local-services.mjs`, `changes/archive/2026-05-27-local-portal-opl-delivery-rc` | `node scripts/v22-local-services.mjs verify --dry-run --json`; `npm run verify:local-release-candidate -- --json` | local release-candidate proof | Local orchestration authorizes secrets, real provider calls, real cloud mutation, deploy, kubectl, build/push or live-test. |
