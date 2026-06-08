# real-cloud-authorization-boundary Spec Delta

Target specs:

- specs/operations/spec.md

## ADDED

- No new durable requirement is accepted by this authoring package yet.

## MODIFIED

- `operations:real-cloud-authorization-boundary` must be represented as an active change package before any secret, provider, deploy, kubectl, build/push, live-test or true cloud mutation work can start.
- The active boundary must point future work at `spec:v22-cloud-onboarding-workflow-boundary`: Gate-A is explicit user/process authorization, Gate-B is runner/allowlist/mode execution control, and missing either gate keeps `realCloudCalls=false`.
- The required authorization record must name operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner. Raw evidence goes to `.runtime` or another approved non-git sink; git may only receive a sanitized summary.
- The required future order remains `mock/snapshot provider -> readonly quote -> dry-run plan -> readonly inventory -> authorized create/release -> authorized deploy -> canary / QA / status update`.

## REMOVED

- No requirement is removed by this authoring package.

## CANNOT-CLAIM

- This package does not authorize real cloud, deploy, kubectl, build/push, live-test or production release evidence.
- This package does not prove provider credentials, cloud resource lifecycle, billing reconciliation or runtime deployment.

## EVALS

- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json`
- `node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
