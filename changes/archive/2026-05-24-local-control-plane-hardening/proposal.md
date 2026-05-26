# local-control-plane-hardening Proposal

Status: authoring
Branch: feat/v22-local-control-plane-hardening
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Integration | Runtime | Operations

## Why

Real cloud work is intentionally blocked at the authorization boundary. Before opening that lane, the local control plane must stop carrying known implementation debt: Go is registered as the control-plane target but has not taken over, Portal still keeps a broad runtime assembly, a legacy PowerShell MinIO sync helper is still referenced, and local service ports can be confused with old worktree processes.

## Goals

- Make the current local service surface self-checking so Portal, Gateway, Runtime Bridge, OPL upstream and Portal frontend cannot be mistaken for old worktree processes.
- Remove the `scripts/sync-workspace-file-to-minio.ps1` dependency from current Portal runtime code and retire it through a gate.
- Reduce the then-active Portal runtime fan-out by moving cohesive runtime assembly into narrower files. Current trunk later supersedes this narrowed Node runtime state through Node backend physical removal.
- Advance Go control-plane takeover readiness through repo-native API / facade gates without claiming production replacement.
- Keep all work under the three loops: documentation cleanup, code cleanup and software engineering verification.

## Non-Goals

- No secret read, `.env` read, provider operation or live provider canary.
- No real cloud mutation, deploy, kubectl, build/push or live-test.
- No one-person-lab upstream modification.
- No claim that Go has replaced the active Node Portal backend.
- No broad documentation expansion; accepted deltas must sync into existing README/spec/change package surfaces.

## Golden Path Impact

- improves: makes the local golden path easier to verify before cloud authorization.
- affected steps: local service startup, provider-key reuse projection, OPL launch, workspace file projection, run/artifact projection, billing/audit release shape.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- This package is local deterministic evidence only.
- Real cloud remains blocked by `real-cloud-authorization-boundary`.
- Go toolchain evidence is required before any Go production replacement claim; current environment may lack `go`, which must be recorded as an eval limitation rather than hidden.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `changes/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
