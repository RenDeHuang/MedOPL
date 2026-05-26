# precloud-deployable-rc Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-precloud-deployable-rc.mjs
node tests/contract/contract-test-v22-go-backend-service-surface.mjs
bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."
npm --prefix services/portal/frontend run typecheck
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json
git diff --check -- docs specs changes tests scripts package.json services/portal services/medopl-go-backend
```

## Evidence Level

- local contract proof
- local integration proof
- pre-cloud local RC evidence

## Can Claim

- Go backend is the pre-cloud MedOPL SaaS backend deployment surface for local deterministic RC.
- Portal frontend defaults to Go `/api` and does not require Node Portal backend for typed API projections.
- Cloud connector remains fail-closed before real-cloud authorization.

## Cannot Claim

- External deployment has been completed.
- Real cloud, real billing, kubectl, image build/push or live-test was authorized or executed.
- Live provider, hosted OPL, hosted Runtime Agent or hosted billing evidence exists.
