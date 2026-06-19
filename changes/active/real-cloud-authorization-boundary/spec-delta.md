# real-cloud-authorization-boundary Spec Delta

Target specs:

- specs/operations/spec.md
- specs/framework/spec.md
- specs/runtime/spec.md
- specs/product/spec.md

## ADDED

- No new durable product/runtime behavior is added by this cleanup package.

## MODIFIED

- `operations:real-cloud-authorization-boundary` is the active gate before any secret, provider, deploy, kubectl, build/push, live-test, production ledger write or true cloud mutation work can start.
- The active boundary points future work at `spec:v22-cloud-onboarding-workflow-boundary`: Gate-A is explicit user/process authorization, Gate-B is runner/allowlist/mode execution control, and missing either gate keeps `realCloudCalls=false`.
- The required authorization record must name operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner. Raw evidence goes to `.runtime` or another approved non-git sink; git may only receive a sanitized summary.
- The required future order is `readonly inventory -> TKE bootstrap preflight -> dry-run plan -> explicit authorization packet -> authorized tenant runtime provisioning -> ledger / billing / audit writeback -> canary / QA / status update`.
- `tests/cloud/` now holds only small active cloud boundary tests: readonly inventory, Package C dry-run plan and TKE bootstrap preflight.
- `tests/contracts/` holds true machine/API/schema/runtime contract evals; `tests/governance/` holds lifecycle/workflow/taxonomy evals; `tests/suites/` holds suite wrappers.

## REMOVED

- Package D deploy/external access/service reachability runners are removed from active tests/support.
- Production-launch runner contracts are removed from active tests/support.
- Tencent CLB diagnostics and real OPL WebUI future-authorized tests are removed from active cloud tests.
- Package C live canary runner and PostgreSQL live ledger sink support are removed from active tests/support.

## CANNOT-CLAIM

- This package does not authorize real cloud, deploy, kubectl, build/push, live-test or production release evidence.
- This package does not prove provider credentials, cloud resource lifecycle, billing reconciliation or runtime deployment.
- Deleted active runner paths cannot be retained as compatibility aliases.

## EVALS

- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json`
- `node tests/contracts/contract-test-v22-real-cloud-readiness-lane.mjs`
- `node tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`
- `node tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`
- `node tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs`
- `node tests/governance/governance-test-v22-real-cloud-authorization-boundary.mjs`
- `node tests/governance/governance-test-v22-change-package-lifecycle.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
