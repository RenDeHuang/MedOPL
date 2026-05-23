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

