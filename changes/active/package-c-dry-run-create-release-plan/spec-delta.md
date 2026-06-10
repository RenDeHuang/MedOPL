Owner: `MedOPL`
Purpose: `spec_delta`
State: `active_change`
Machine boundary: `cloud-future-authorized` manifest membership and the Package C dry-run runner behavior are machine-readable.

# Package C Dry-Run Create Release Plan Spec Delta

Target specs:

- `specs/operations/spec.md`
- `specs/runtime/spec.md`

## ADDED

- `spec:v22-tencent-dry-run-resource-plan-provider-boundary` gains `scripts/v22-tencent-create-release-dry-run-plan.mjs` as the Package C dry-run create/release plan runner.
- `spec:v22-tencent-dry-run-resource-plan-provider-boundary` gains `tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs` as the local gate for the runner.
- Package C dry-run plans must describe workspace file space, workspace compute allocation, freeze-only billing and Kubernetes isolation controls.
- Package C dry-run plans must keep `realCloudCalls=false`, `mutationExecuted=false`, `readsMutationSecret=false`, `writesLedger=false`, `callsKubectl=false`, `buildsOrPushesImage=false` and `chargeApplied=false`.

## MODIFIED

- The cloud onboarding sequence now separates Package B readonly inventory from Package C dry-run create/release planning.
- The `cloud-future-authorized` lane includes the Package C local dry-run gate.
- The required Package C smoke for step 9 points to the new dry-run lifecycle gate instead of duplicating the create/release contract entry.

## REMOVED

- No production path is removed in this package.
- TC3 remains retired from the active/default readonly path and is not restored by this package.

## CANNOT-CLAIM

- No real Tencent Cloud resource create, resize, bind or release has happened.
- No mutation secret has been read.
- No Portal ledger, billing charge or stop-billing mutation has been executed.
- No kubectl, deploy, build/push or live-test has been executed.
- No production readiness claim is created by the dry-run report.

## EVALS

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`
- `npm run test:cloud-future-authorized`
- `npm run gate:review`
- `git diff --check -- docs tests scripts changes package.json package-lock.json`
