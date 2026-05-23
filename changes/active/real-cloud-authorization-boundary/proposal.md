# real-cloud-authorization-boundary Proposal

Status: authoring
Branch: real-cloud-authorization-boundary
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Operations
Affected plane: Operations

## Why

The current cursor is the real-cloud authorization boundary. Pre-cloud local proof is closed, but any secret access, provider operation, deploy, kubectl, build/push, live-test or true cloud mutation remains outside default authorization. This change package makes that boundary repo-native so future agents do not rely on chat memory.

## Goals

- Record the current authorization cursor as a repo-native change package.
- Define the subscribed truth, spec delta target and eval plan before any real-cloud work.
- Keep active truth limited to the current phase, cursor, blockers, next owner, cannot-claim and verification entry.
- Fail closed until explicit user authorization is provided for each sensitive operation class.

## Non-Goals

- Do not read secrets, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real OPL, provider APIs, Langfuse, COS or production APIs.
- Do not run build/push, kubectl, deploy or live-test.
- Do not change Portal, Gateway, Runtime Bridge or cloud runtime behavior.

## Golden Path Impact

- defers: this package does not change the local golden path implementation.
- affected steps: real cloud authorization remains the blocker after local golden path health.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- Future authorization must name the operation class, target environment, evidence sink and rollback owner.
- Local dry-run or future-authorized eval evidence cannot be upgraded into live or production evidence.

## Subscribed Truth

- docs/active/README.md
- docs/policies/README.md
- docs/delivery/README.md
- docs/evidence/README.md
- docs/specs/README.md
- specs/operations/spec.md
- changes/README.md
