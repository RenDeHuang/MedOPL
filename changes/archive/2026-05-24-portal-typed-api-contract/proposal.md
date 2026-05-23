# portal-typed-api-contract Proposal

Status: authoring
Branch: portal-typed-api-contract
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Runtime | Source

## Why

Figma Portal UI absorption is archived. The next local productization gap is the boundary between Portal frontend pages and backend control-plane projections: pages must read typed API modules and normalized adapters instead of copying temporary readiness, billing, resource or OPL launch truth.

## Goals

- Make the Portal frontend API modules the default contract surface for Portal UI data.
- Keep backend response shapes and frontend adapters aligned for the golden path.
- Preserve fail-closed behavior for unavailable backend projections.
- Keep OPL entry, provider key reuse and Go backend takeover as separate follow-up packages unless their contract surface is directly touched.

## Non-Goals

- No real cloud execution, deploy, kubectl, build/push or live-test.
- No secret read, provider credential read or production API call.
- No upstream OPL modification.
- No visual redesign or external Figma runtime dependency.
- No claim that Go has already replaced the current Node Portal backend.

## Golden Path Impact

- narrows: this package makes golden path UI state depend on typed local API projections instead of page-local temporary truth.
- affected steps: login / credit / provider key, managed environment open, launch OPL, upload file / task, run / artifact, billing / trace / audit, release / stop billing.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- API contract evidence is local deterministic evidence only; it cannot become production evidence without authorized live proof.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `specs/source/spec.md`
- `changes/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
