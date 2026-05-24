# go-control-plane-mvp-takeover Closeout

Status: archived

## Commits

- `504dcdd` docs(go): promote go control plane mvp takeover cursor
- `de81bba` feat(go): add lab typed control plane api
- `f814787` feat(portal): route lab typed api to go control plane
- `1234c93` test(portal): guard lab api go ownership
- `53fdc53` test(go): align current eval lane with takeover cursor
- `dc21193` test(go): make current go eval repo native
- `4dca989` fix(portal): retire node lab api business routes
- `a6f55ab` feat(go): add local rc control plane parity slice
- `39d5242` feat(portal): add go local rc provider key entry
- `156e2d4` test(go): fold local rc parity into current gates
- `2716e95` fix(go): scope local rc resource lifecycle
- `cdcff8e` fix(go): retire node provider open route from local rc truth
- `338ee38` fix(go): physically retire node v22 control plane code
- `20e97a9` docs(go): sync node control plane code retirement truth
- `104d12c` fix(go): route local rc provider boundary through go control plane
- `2ca3526` fix(runtime): keep provider reply projection within line budget
- `0112813` test(go): retire node opl work regression onto go control plane

## Verification

- `node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`: pass.
- `npm --prefix services/portal/frontend run typecheck`: pass.
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`: pass with folded Go local RC parity checks.
- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`: pass with folded OPL entry provider-key UI checks.
- `node tests/contract/contract-test-v22-golden-smoke-suite.mjs`: pass with Go-owned provider/open/file/run/billing/release smoke wrappers.
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass with golden smoke plus Node route retirement guard.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass with Go local RC parity guards registered in health.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass with `golden-path` guard command registered.
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`: pass with malformed JSON ignored by the retired Node provider/open shell.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/service/controlplane -run \"TestService(ResourcesAreWorkspaceScopedAndReleaseFailsClosedWhenMissing|RecordsFileRunArtifactBillingAuditAndRelease)\" -count=1"`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/server/handlers -run \"TestControlPlaneHandlers(ExposeProviderLaunchBillingResourceLocalRC|ScopeResourcesAndFailClosedOnMissingRelease)\" -count=1"`: pass.
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src services/medopl-go-backend`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass after post-merge closeout sync.
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass after post-merge closeout sync.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass after post-merge closeout sync.

## Can Claim

- The Go control-plane MVP takeover cursor and eval plan are repo-native.
- Go now serves the lab typed API surface under `/api/lab-*` for local MVP proof.
- Portal frontend lab typed API uses the Go control-plane client.
- Node `/portal/api/lab-*` is retired as a fail-closed 410 shell and no longer owns lab package/subscription business truth.
- Local deterministic Go RC parity covers provider/preflight/launch, billing/audit, resource projection and release/stop-billing after the eval bundle passes.
- Go resource projection is workspace-scoped, and release fails closed for missing or wrong-workspace resources in local RC.
- Node `/portal/api/v22/users/*`, `/portal/api/v22/provider-key`, `/portal/api/v22/managed-environment/readiness`, `/portal/api/v22/managed-environment/open`, `/portal/api/v22/managed-environment/release` and `/portal/api/v22/opl-work/*` routes and business domains are physically retired from active code; current local control-plane API owner is Go `/api/v22/*` and `/api/opl/*`.

## Cannot Claim

- Production backend replacement is complete.
- Real cloud, deploy, kubectl, build/push, live-test or provider operation is authorized or complete.
- Local proof is production evidence.
- Local deterministic RC parity is live provider, true upstream OPL, real-cloud, production secret storage, production billing or production runtime evidence.

## Archive Target

- changes/archive/2026-05-24-go-control-plane-mvp-takeover

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Operations owns `real-cloud-authorization-boundary` as the next blocked cursor.
- Real-cloud readiness still requires a separate explicit authorization package before any secret, provider, cloud, deploy, kubectl, build/push or live-test operation.
