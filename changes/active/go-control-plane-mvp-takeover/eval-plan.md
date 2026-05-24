# go-control-plane-mvp-takeover Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-backend-go-convergence-program.mjs
node tests/contract/contract-test-v22-go-backend-service-surface.mjs
node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-current-state-index-loop.mjs
go test ./...
npm --prefix services/portal/frontend run typecheck
node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src services/medopl-go-backend
```

## Evidence Level

- local contract proof
- local service proof
- local golden path proof

## Can Claim

- Go control-plane MVP takeover is represented as the current local package.
- The default path to real-cloud readiness is blocked until Go local RC passes.
- Node Portal backend business truth is a retirement target, not the long-term backend.

## Cannot Claim

- Real cloud, deploy, kubectl, build/push, live-test or production backend replacement is complete.
- Secrets, provider credentials, cloud resources or production billing have been validated.
- Local Go proof equals production evidence.
