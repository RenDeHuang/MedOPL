# go-control-plane-mvp-takeover Spec Delta

Target specs:

- specs/source/spec.md
- specs/runtime/spec.md

## ADDED

- `source:go-control-plane-mvp-takeover` defines `services/medopl-go-backend` as the local MVP takeover target before any real-cloud readiness package.
- `runtime:go-control-plane-mvp-api` requires Portal typed API to be served by the Go control-plane backend during local RC.
- `runtime:go-local-rc-parity` requires provider/preflight/launch, billing/audit, resource projection and release/stop-billing local RC evals to be registered before real-cloud readiness.

## MODIFIED

- `spec:v22-go-control-plane-mvp-takeover-boundary` supersedes the previous backend Go convergence wording for the current cursor.
- Node Portal backend business truth must be migrated or retired; it must not remain a long-term active backend, compatibility layer or second control plane.
- The frontend/backend split must be explicit: `services/portal/frontend` is the UI package; `services/medopl-go-backend` owns control-plane API truth.
- `services/portal/src/routes/lab-package.routes.mjs` is demoted to a retirement shell/local eval dependency for workflow-facade boundary checks. It cannot be frontend lab typed API truth, current backend truth or real-cloud readiness evidence.

## REMOVED

- No source file is removed by the authoring package itself.
- Node-as-current-backend documentation truth is removed from active source and delivery truth.

## CANNOT-CLAIM

- This package does not claim real cloud readiness, production backend replacement, deploy, kubectl, build/push, live-test or live provider evidence.
- This package does not authorize secret reads or provider/cloud mutation.
- Local Go API proof does not prove production persistence, real billing reconciliation or real cloud lifecycle.
- Local deterministic RC parity does not prove live provider, real OPL upstream, production secret storage, deploy, kubectl or production runtime evidence.

## EVALS

- `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`
- `npm --prefix services/portal/frontend run typecheck`
- `node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --dry-run --json`
