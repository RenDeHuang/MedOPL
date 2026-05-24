# local-control-plane-hardening Eval Plan

## Required Commands

```bash
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
npm --prefix services/portal run check
npm --prefix services/portal/frontend run typecheck
git diff --check -- changes docs tests scripts services/portal/src services/portal/frontend/src services/medopl-go-backend
```

When `go` is available:

```bash
go test ./...
```

## Evidence Level

- local smoke evidence
- local contract proof
- local structure proof

## Can Claim

- This package can claim local control-plane hardening only after the required repo-local evals pass.

## Cannot Claim

- No production evidence, real cloud authorization, live provider proof, deploy, kubectl, build/push or live-test.
- No Go production backend replacement.
- No Go unit test evidence unless `go test ./...` runs successfully in `services/medopl-go-backend`.
