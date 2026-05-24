# local-control-plane-hardening Spec Delta

Target specs:

- `specs/source/spec.md`
- `specs/runtime/spec.md`
- `specs/framework/spec.md`

## ADDED

- Local service readiness must identify the current repo root for Portal, Gateway, Runtime Bridge, OPL upstream and Portal frontend checks before a local RC is treated as inspectable.
- Portal storage sync must not require a PowerShell helper script in active runtime code.
- Portal runtime assembly must keep broad dependency wiring out of `portal-runtime.mjs`; structural checks must fail when fan-out regresses.

## MODIFIED

- Go backend takeover remains a repo-native convergence program. This package may add readiness gates and Node-to-Go handoff checks, but it cannot promote Go to active production backend.
- Default verification remains golden-path first, followed by governance and structure gates.

## REMOVED

- Current Portal runtime code must stop depending on `scripts/sync-workspace-file-to-minio.ps1`.

## CANNOT-CLAIM

- Cannot claim real cloud authorization, deploy, kubectl, build/push, live-test or production evidence.
- Cannot claim Go backend production replacement.
- Cannot claim Go test evidence if `go test ./...` cannot run in the local environment.
- Cannot claim old worktree frontend or stale localhost ports are current trunk evidence.

## EVALS

- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal/frontend run typecheck`
- `go test ./...` when the Go toolchain is available
