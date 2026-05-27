# local-portal-opl-delivery-rc Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs
node scripts/v22-local-services.mjs check --dry-run --json
npm run verify:golden-path -- --json
npm run verify:current -- --json
npm run verify:contract -- --json
npm run verify:review -- --json
npm run test:regression -- --json
npm --prefix services/portal run check
bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."
git diff --check -- changes docs specs tests scripts package.json services/portal/frontend/src services/medopl-go-backend services/opl-web-gateway services/opl-runtime-bridge
```

## Evidence Level

- local contract proof
- local integration proof
- local release-candidate proof below cloud authorization

## Can Claim

- Portal and OPL local delivery boundaries are repo-native and explicitly separated from cloud delivery.
- Local orchestration and RC verification can prove non-cloud readiness for the bounded local environment.
- Gateway and Runtime Bridge can be verified as local integration/runtime boundaries without upstream ownership.

## Cannot Claim

- real cloud, deploy, kubectl, build/push, live-test, production billing or production runtime.
- real provider readiness or upstream production OPL readiness.
- raw secret handling outside the backend secret boundary.
```
