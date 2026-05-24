# local-control-plane-hardening Closeout

Status: archived

## Commits

- `5d2860f` docs(change): open local control plane hardening package
- `c00c480` test(hygiene): guard current truth localhost claims
- `4318782` refactor(portal): retire powershell minio sync helper
- `0886c23` refactor(portal): reduce runtime assembly fanout
- `85ccb23` test(go): tighten control plane takeover readiness
- `54e6dad` fix(portal): close local hardening review gaps

## Verification

- `node tests/regression/portal/regression-test-v22-workspace-storage-public-response.mjs`: pass after RED on unencoded MinIO read prefix.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass.
- `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`: pass.
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`: pass.
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`: pass.
- `npm run verify:repo-hygiene`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify:review`: pass.
- `npm --prefix services/portal run check`: pass.
- `go version`: unavailable; `go test ./...` was not run.

## Can Claim

- Active runtime code no longer depends on `scripts/sync-workspace-file-to-minio.ps1`; the script is removed from the active scripts surface.
- Portal MinIO sync now uses `mc` directly through Node runtime code and shares encoded object-prefix construction for write and read paths.
- `services/portal/src/app/portal-runtime.mjs` fan-out was reduced from 18 to 16, and the redundant `portal-runtime-http.mjs` re-export layer was removed.
- Repo hygiene now prevents fixed local service endpoint / port claims from becoming current truth.
- Go control-plane takeover readiness gates now enforce future-target semantics and the Node Portal current-backend boundary.

## Cannot Claim

- Cannot claim production evidence, real cloud authorization, live provider evidence, deploy, kubectl, build/push, live-test or production billing readiness.
- Cannot claim Go backend production replacement; current Node Portal backend remains active.
- Cannot claim `go test ./...` evidence because Go is unavailable in this environment.
- Cannot claim all Portal structure debt is gone; this package only reduced the current assembly fan-out and retired one sync helper.

## Archive Target

- changes/archive/2026-05-24-local-control-plane-hardening

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Platform for Go control-plane takeover.
- MedOPL Operations for real-cloud authorization boundary.
