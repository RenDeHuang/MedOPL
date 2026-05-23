# golden-path-productization-roadmap Proposal

Status: authoring
Branch: feat/golden-path-productization-roadmap
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Integration | Runtime | Operations | Framework

## Why

MedOPL now has repo-native truth layering, change packages, durable specs and local gates. The remaining risk is execution order: governance is available, but user experience productization still needs an explicit delivery roadmap that every later branch can subscribe to without relying on chat memory.

This package fixes the next productization order around the golden path:

```text
Figma UI repo-native absorption
-> typed Portal API contract
-> provider key reuse
-> OPL entry real preflight / launch state
-> Go control-plane takeover
-> real-cloud authorization
```

The roadmap keeps the golden path as the default product spine while preserving local-only verification before cloud authorization.

## Goals

- Make the six package sequence the canonical delivery order after local RC.
- Treat Figma Make as visual and information-architecture input, not production truth by itself.
- Define typed API contract as the boundary between modern frontend and backend control plane.
- Make provider key reuse a first-class product gap before repeating provider entry in launch flows.
- Require OPL entry UI to read real preflight / launch / providerKeyRef state before claiming the entry is ready.
- Clarify that Go is the canonical MedOPL control-plane backend target, while Gateway / Runtime Bridge may remain thin Node integration boundaries during migration.
- Keep real cloud authorization as the final separately authorized boundary.

## Non-Goals

- No source implementation in this roadmap package.
- No Figma import, UI rewrite, backend migration or provider key implementation in this package.
- No secret read, provider credential read, real OPL call, real cloud call, deploy, kubectl, build/push or live-test.
- No change to `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or one-person-lab upstream.
- No claim that local smoke, local RC or Figma prototype proves production runtime, production billing or production cloud readiness.

## Golden Path Impact

- improves: this package makes the next productization work serve the golden path in a fixed order.
- affected steps: login / credit / provider key, managed environment open, launch OPL, upload file / task, run / artifact, billing / trace / audit, release / stop billing.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- No provider, Langfuse, COS, production API or upstream mutation.
- This package can update docs/specs/change lifecycle only.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `specs/product/spec.md`
- `specs/runtime/spec.md`
- `specs/framework/spec.md`
- `specs/source/spec.md`
- `changes/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
