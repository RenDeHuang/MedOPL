# local-control-plane-hardening Spec Delta

Target specs:

- specs/source/spec.md
- specs/framework/spec.md

## ADDED

- `framework:current-truth-localhost-claim-hygiene` requires active/change truth surfaces to avoid treating fixed localhost ports or stale local processes as current trunk evidence.
- `source:node-portal-backend-physical-removal` supersedes the historical Portal MinIO helper retirement and Portal runtime fan-out cleanup rows. The current durable source requirement is physical removal of the Node Portal backend, not retention of a narrowed Node runtime.

## MODIFIED

- `source:go-control-plane-takeover-order` remains a repo-native convergence program: this package tightens readiness gates and Node-to-Go handoff checks, but it cannot promote Go to active production backend.
- `framework:golden-path-impact-required` remains golden-path first; governance and structure gates are guardrails after product health.

## REMOVED

- `source:node-portal-backend-physical-removal` removes the active `services/portal/src` backend surface after this package's narrower historical cleanup was superseded.

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
