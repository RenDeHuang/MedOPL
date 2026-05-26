# precloud-deployable-rc Spec Delta

Target specs:

- specs/runtime/spec.md
- specs/source/spec.md
- specs/operations/spec.md

## ADDED

- `runtime:precloud-deployable-rc` defines the pre-cloud deployable shape: Portal frontend talks to Go backend through `/api`, Go backend serves health/readiness and Portal projection APIs, OPL Gateway / Runtime Bridge remain API boundaries, and cloud connector remains fail-closed.
- `source:node-portal-backend-deployment-retirement` requires Node Portal backend to be absent from deployment scripts, frontend proxy defaults and current verification entrypoints. Frontend Node tooling may remain.
- `operations:cloud-connector-fail-closed-precloud` requires any cloud connector API in this package to return authorization-required / fail-closed local evidence only.

## MODIFIED

- `runtime:go-local-rc-parity` is narrowed into pre-cloud deployable evidence only; it does not claim production backend replacement, real-cloud readiness or live provider evidence.
- `source:go-control-plane-mvp-api` is extended from local proof to pre-cloud deployable RC surface, still below production truth.

## REMOVED

- Node Portal backend may no longer be represented as a pre-cloud deployment command or frontend proxy target.

## CANNOT-CLAIM

- This package does not authorize real cloud, deploy, kubectl, image build/push, live-test or production release evidence.
- This package does not prove production provider readiness, real OPL production run, production billing reconciliation or production runtime.
- Frontend Node tooling is not backend truth; retaining Vite/TypeScript does not retain Node Portal backend.

## EVALS

- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`
- `npm --prefix services/portal/frontend run typecheck`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`
