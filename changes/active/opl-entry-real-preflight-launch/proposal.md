# opl-entry-real-preflight-launch Proposal

Status: authoring
Branch: opl-entry-real-preflight-launch
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Runtime | Integration

## Why

Portal typed API contract is archived. The next local productization gap is the OPL entry surface: the Portal OPL entry UI must render backend preflight, launch, providerKeyRef, Gateway readiness and fail-closed reasons instead of page-local temporary readiness truth.

## Goals

- Make OPL entry UI read the real local preflight / launch / launch-status projections.
- Keep provider key reuse inside backend secret boundary; frontend sees only `providerKeyRef`, bound status and user-visible blocking reason.
- Keep Gateway and Runtime Bridge readiness evidence local and deterministic.
- Preserve fail-closed behavior when provider key, runtime, workspace, balance, Gateway or upstream URL is unavailable.

## Non-Goals

- No secret read, raw provider credential read or production provider call.
- No real cloud execution, deploy, kubectl, build/push or live-test.
- No one-person-lab upstream modification.
- No claim that Go has replaced the current Node Portal backend.
- No visual redesign beyond state-binding corrections required for OPL entry.

## Golden Path Impact

- improves: this package moves the launch OPL step from partially synthesized UI state toward backend-owned preflight / launch truth.
- affected steps: provider key, managed environment open, launch OPL, Gateway bootstrap and runtime session projection.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- This package is local deterministic evidence only.
- Raw provider keys may only enter backend secret boundary through explicit local test fixtures or user-authorized runtime environment, never frontend state, logs, git or evidence.
- Real provider, real cloud, deploy, kubectl, build/push and live-test remain outside this package.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `specs/runtime/spec.md`
- `specs/source/spec.md`
- `changes/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
