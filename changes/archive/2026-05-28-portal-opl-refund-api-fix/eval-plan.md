# portal-opl-refund-api-fix Eval Plan

## Required Commands

```bash
GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/server -run TestGoPortalProjectionAdminActionsPersistLocalState -count=1
node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs
GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...
npm --prefix services/portal/frontend run typecheck
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```

## Evidence Level

- local regression proof
- local contract proof

## Can Claim

- Local Portal refund action decreases balance and records a negative refund ledger row.
- Local `/portal/opl` route no longer renders React Router default 404.
- Local OPL entry checks provider preflight before launch creation.

## Cannot Claim

- production billing correctness
- real cloud readiness
- live provider readiness
- production OPL runtime behavior
