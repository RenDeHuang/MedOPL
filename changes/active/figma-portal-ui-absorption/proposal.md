# figma-portal-ui-absorption Proposal

Status: authoring
Branch: figma-portal-ui-absorption
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Framework | Source

## Why

The golden path productization roadmap is now landed. The next user-experience package must absorb the Figma Make Portal UI design into repo-native frontend source instead of leaving the product experience as an external prototype or chat-memory instruction.

## Goals

- Convert the Figma Make visual and information architecture into `services/portal/frontend` source.
- Keep Portal frontend connected to typed API boundaries and current backend projections.
- Preserve the golden path: login / credit / provider key -> environment -> OPL launch -> file/task -> run/artifact -> billing/trace/audit -> release/stop billing.
- Add or reuse local checks that prove the repo-native UI surface compiles and preserves route/product boundaries.

## Non-Goals

- No real cloud execution, deploy, kubectl, build/push or live-test.
- No secret read, provider credential read or production API call.
- No upstream OPL modification.
- No claim that the Figma prototype is production frontend truth before repo absorption and evals pass.
- No Go backend takeover or provider key reuse implementation in this package.

## Golden Path Impact

- improves: this package makes the first customer-visible Portal surface serve the golden path before cloud authorization work starts.
- affected steps: login / credit / provider key, managed environment open, launch OPL, upload file / task, run / artifact, billing / trace / audit, release / stop billing.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- Figma Make is design input only; implementation truth must live in repo source and tests.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `specs/product/spec.md`
- `specs/source/spec.md`
- `changes/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
