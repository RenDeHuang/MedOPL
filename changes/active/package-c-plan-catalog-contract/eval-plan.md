# package-c-plan-catalog-contract Eval Plan

## Required Commands

```bash
node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs
node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs
node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs
node tests/smoke/smoke-test-v22-resource-plan-contract.mjs
node tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs
bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/domain/lab ./internal/service/lab ./internal/repository/memory ./internal/server/handlers"
node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk
npm run verify
```

## Evidence Level

- local contract proof
- future-authorized prepare-only boundary

## Can Claim

- Package C prepare-only canary validates Starter through plan catalog allowlist.
- Starter current product storage is 100GB workspace storage.
- TKE node system disk remains a separate node parameter.

## Cannot Claim

- Real Tencent mutation has run or is authorized.
- Production cloud, production billing, deploy, kubectl, build/push, Package D or live-test is ready.
