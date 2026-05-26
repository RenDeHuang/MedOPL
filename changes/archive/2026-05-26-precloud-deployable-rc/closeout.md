# precloud-deployable-rc Closeout

Status: archived

## Commits

- `0bfc857` docs(precloud): open deployable rc package
- `ede2a4a` feat(precloud): make go backend the local deployable rc surface
- `b2d6e39` fix(precloud): close local workspace file transfer route

## Verification

- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`: pass
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`: pass
- `npm --prefix services/portal/frontend run typecheck`: pass
- `npm --prefix services/portal run check`: pass
- `node scripts/v22-verify.mjs current --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`: pass
- `node scripts/v22-verify.mjs review --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`: pass
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/frontend/vite.config.ts services/portal/package.json services/medopl-go-backend`: pass
- independent review after `b2d6e39`: pass, no blocker

## Can Claim

- Portal frontend defaults to Go `/api` and no longer depends on Node Portal backend as typed API / proxy owner.
- `services/medopl-go-backend` exposes the local pre-cloud SaaS backend surface for Portal projections, health/readiness, file transfer, run/artifact/trace projections, billing export/logout and fail-closed cloud connector APIs.
- Node Portal backend deployment scripts and backend dependency set are retired from `services/portal/package.json`; remaining frontend Node tooling is not backend truth.
- Cloud connector status/plan endpoints fail closed and point to the separate `real-cloud-authorization-boundary`.
- The package is ready for landing review; post-merge closeout must record the landed commit and keep the next cursor on real-cloud authorization.

## Cannot Claim

- Real cloud, deploy, kubectl, image build/push, live-test or production release is authorized.
- Provider credentials, cloud resources, billing reconciliation or runtime deployment have been verified.

## Archive Target

- changes/archive/2026-05-26-precloud-deployable-rc

## History Handoff

- docs/history/README.md

## Next Owner

- MedOPL Platform for local pre-cloud deployable RC.
- MedOPL Operations for the separate real-cloud authorization/readiness package.
