# go-handler-split Eval Plan

## Required Commands

```bash
cd services/medopl-go-backend && go test ./internal/server ./internal/server/handlers -count=1
node tests/contract/contract-test-v22-go-backend-service-surface.mjs
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-spec-eval-traceability.mjs
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- services tests changes specs
```

## Evidence Level

- local source structure proof
- local Go package proof
- local contract proof

## Cannot Claim

- Runtime behavior changed.
- Production, billing, deploy, real cloud, kubectl, build/push or live-test readiness is complete.
