# go-control-plane-mvp-takeover Closeout

Status: ready_for_landing_review

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
- pending: local RC parity folded-eval/truth registration commit

## Verification

- `node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`: pass.
- `npm --prefix services/portal/frontend run typecheck`: pass.
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`: pass with folded Go local RC parity checks.
- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`: pass with folded OPL entry provider-key UI checks.
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src services/medopl-go-backend`: pass.

## Can Claim

- The Go control-plane MVP takeover cursor and eval plan are repo-native.
- Go now serves the lab typed API surface under `/api/lab-*` for local MVP proof.
- Portal frontend lab typed API uses the Go control-plane client.
- Node `/portal/api/lab-*` is retired as a fail-closed 410 shell and no longer owns lab package/subscription business truth.
- Local deterministic Go RC parity covers provider/preflight/launch, billing/audit, resource projection and release/stop-billing after the eval bundle passes.

## Cannot Claim

- Production backend replacement is complete.
- Real cloud, deploy, kubectl, build/push, live-test or provider operation is authorized or complete.
- Local proof is production evidence.
- Local deterministic RC parity is live provider, true upstream OPL, real-cloud, production secret storage, production billing or production runtime evidence.

## Archive Target

- changes/archive/YYYY-MM-DD-go-control-plane-mvp-takeover

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Platform for remaining Go local RC parity.
- MedOPL Operations only after a separate real-cloud-readiness package is opened and authorized.
