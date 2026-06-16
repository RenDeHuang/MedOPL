# real-cloud-authorization-boundary Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs
node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs
node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm run verify
npm run closeout:check -- --json
git diff --check -- docs changes specs tests scripts
```

## Evidence Level

- future-authorized boundary
- local contract proof

## Can Claim

- The real-cloud authorization cursor has a repo-native change package.
- Default verification remains local-only and dry-run for future-authorized cloud boundaries.
- Explicit authorization is required before sensitive operations.
- The post-boundary cloud sequence is repo-native and remains `mock/snapshot provider -> readonly quote -> dry-run plan -> readonly inventory -> authorized create/release -> Package D deploy readiness planning for platform pool and VPC PostgreSQL -> authorized deploy -> canary / QA / status update`.
- Future authorization must name operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner before any sensitive operation runs.
- Package D deploy readiness planning has a non-executing local shape gate for cluster `cls-fi097sy4`, platform pool `np-cbk784r8`, VPC PostgreSQL `10.66.0.21:5432`, deploy/runtime env allowlists, kubeconfig ref-only handling, manifest scheduling to platform service pool, rollback plan shape and readiness gaps.
- Package D release plan shape is reviewable: image targets, tag rule, TCR shape, Kubernetes manifest shape, runtime env secretRef boundary, DB connectivity smoke plan, rollback plan and redacted evidence classes are explicit, with `releasePlanReady=true` and `realExecutionReady=false`.
- Package D execution preflight gate can judge the split `package-d-deploy.env` and `portal-runtime.env` allowlists, fixed cluster / namespace / platform pool / DB endpoint / image targets and redaction audit while keeping `RUN_TENCENT_DEPLOY_EXECUTION=0` and `realExecutionReady=false`.
- Package D now has a repo-native production deploy apply/live entrypoint and local/future-authorized gate. Plan-only keeps `RUN_TENCENT_DEPLOY_EXECUTION=0`; apply/live requires a separately authorized `RUN_TENCENT_DEPLOY_EXECUTION=1` cloud execution.
- The apply/live command plan is limited to server-side dry-run, allowlisted `kubectl apply` for Package D ConfigMap/Deployment/Service resources in `medopl-platform`, rollout observation, namespace-scoped smoke shape checks and rollback plan commands for allowlisted deployments.

## Cannot Claim

- Real cloud, deploy, kubectl, build/push, live-test or production release is authorized.
- Provider credentials, cloud resources, billing reconciliation or runtime deployment have been verified.
- Local dry-run evidence proves live behavior.
- Package D local shape gate must keep `RUN_TENCENT_DEPLOY_EXECUTION=0`; it does not authorize deploy execution, kubeconfig read, kubectl, build/push or DB writes.
- Package D release plan readiness does not authorize image build, TCR push, Kubernetes dry-run/apply, DB smoke, rollback execution or Package D execution.
- Package D execution preflight readiness does not authorize reading kubeconfig contents, build/push, kubectl, deploy, Tencent mutation or Package D execution.
- Package D production deploy apply/live local gate does not prove live deployment, rollout, post-deploy smoke or rollback execution; those require a separate cloud authorization and redacted `.runtime` evidence.

## Required Future Sequence

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
