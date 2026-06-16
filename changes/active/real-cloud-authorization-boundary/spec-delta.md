# real-cloud-authorization-boundary Spec Delta

Target specs:

- specs/operations/spec.md

## ADDED

- No new durable requirement is accepted by this authoring package yet.

## MODIFIED

- `operations:real-cloud-authorization-boundary` must be represented as an active change package before any secret, provider, deploy, kubectl, build/push, live-test or true cloud mutation work can start.
- The active boundary must point future work at `spec:v22-cloud-onboarding-workflow-boundary`: Gate-A is explicit user/process authorization, Gate-B is runner/allowlist/mode execution control, and missing either gate keeps `realCloudCalls=false`.
- The required authorization record must name operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner. Raw evidence goes to `.runtime` or another approved non-git sink; git may only receive a sanitized summary.
- The required future order remains `mock/snapshot provider -> readonly quote -> dry-run plan -> readonly inventory -> authorized create/release -> Package D deploy readiness planning for platform pool and VPC PostgreSQL -> authorized deploy -> canary / QA / status update`.
- Stable上线 readiness now inserts Package D deploy readiness planning before deploy execution: target TKE cluster `cls-fi097sy4`, platform pool `np-cbk784r8`, VPC PostgreSQL endpoint `10.66.0.21:5432`, deploy/runtime env allowlists, default-disabled deploy execution gate, kubeconfig ref-only boundary, manifest scheduling to platform service pool, rollback plan shape and explicit readiness gaps.
- Package D local shape gate is non-executing: `RUN_TENCENT_DEPLOY_EXECUTION` must remain `0`; the gate rejects raw kubeconfig YAML and tenant pool scheduling, and cannot make `releasePlanReady` or `realExecutionReady` true.
- Package D reviewable release plan shape can now make `releasePlanReady=true` while keeping `realExecutionReady=false`. The shape covers image build plan, tag rule, TCR registry/namespace/region shape, Kubernetes namespace / deployment / service / config / secretRef shape, platform pool scheduling, VPC PostgreSQL runtime env injection, DB connectivity smoke plan, rollback plan and required redacted evidence classes.
- Package D execution boundary / preflight gate splits secret/env input into `package-d-deploy.env` and `portal-runtime.env`: deploy env is limited to TCR credentials, registry / namespace / region, cluster id and kubeconfig ref; Portal runtime env is limited to admin identity/password and PostgreSQL URL/password. The gate can judge allowlisted inputs, fixed cluster / namespace / platform pool / DB endpoint / image targets and redacted evidence, but `realExecutionReady` remains false.
- Package D production deploy apply/live is a repo-native future-authorized entrypoint, not a hand-run kubectl path. `production-deploy-plan` requires `RUN_TENCENT_DEPLOY_EXECUTION=0`; `production-deploy-apply` / `production-deploy-live` fail closed unless a separate cloud authorization supplies `RUN_TENCENT_DEPLOY_EXECUTION=1`, target cluster `cls-fi097sy4`, namespace `medopl-platform`, platform runner pool `np-6l4nkdto`, fixed image refs and SecretRefs.
- The Package D apply/live command plan is limited to server-side dry-run before apply, allowlisted Package D ConfigMap/Deployment/Service apply in `medopl-platform`, rollout observe for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`, namespace-scoped deployment/service/pod smoke shape checks, and rollback plan commands using `kubectl rollout undo` for those deployments.
- Package C PostgreSQL ledger canary no longer treats local-machine access to the VPC private endpoint as the goal; successful real DB canary waits until the MedOPL service runs inside the VPC.

## REMOVED

- No requirement is removed by this authoring package.

## CANNOT-CLAIM

- This package does not authorize real cloud, deploy, kubectl, build/push, live-test or production release evidence.
- This package does not prove provider credentials, cloud resource lifecycle, billing reconciliation or runtime deployment.
- `releasePlanReady=true` does not mean image build, TCR push, Kubernetes dry-run/apply, DB smoke, rollback evidence or Package D execution has happened.
- `executionPreflightGateReady=true` does not mean real deploy execution is authorized or ready.
- Package D production-deploy-apply/live entrypoint existence does not mean deploy execution, rollout success, post-deploy smoke or rollback execution has happened.

## EVALS

- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json`
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`
- `node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
