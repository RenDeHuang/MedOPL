# precloud-deployable-rc Proposal

Status: authoring
Branch: feat/v22-precloud-deployable-rc
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product + Runtime + Operations

## Why

Go local RC and Node control-plane business-route retirement are closed locally, but the repo still needs a pre-cloud deployable shape where OPL workbench, MedOPL SaaS frontend and MedOPL Go backend can run without Node Portal backend as the control-plane deployment surface. Real-cloud remains a separate authorization package.

## Goals

- Make Go backend the pre-cloud SaaS backend deployment surface for Portal typed API and golden path projections.
- Keep OPL Web Gateway and Runtime Bridge as API-connected local/runtime boundaries.
- Retire Node Portal backend from deployment scripts, frontend proxy defaults and current verification narrative.
- Add deterministic local gates for pre-cloud deployability, Node backend retirement and cloud connector fail-closed behavior.
- Preserve evidence-after-contract: local deployable RC does not become production cloud truth.

## Non-Goals

- Do not read secrets, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real provider APIs, Langfuse, COS or production APIs.
- Do not run deploy, kubectl, image build/push or live-test.
- Do not modify one-person-lab upstream, `deploy/*`, `.sentrux/*`, `adapters/*` or `infra/*`.
- Do not claim real-cloud readiness, production billing, production runtime or production OPL evidence.

## Golden Path Impact

- improves: makes the default pre-cloud golden path deployable through Go backend and API boundaries instead of Node Portal backend.
- affected steps: login / credit / provider key -> open managed environment -> launch OPL -> upload file / task -> run / artifact -> billing / trace / audit -> release / stop billing.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, image build/push or live-test unless explicitly authorized.
- Cloud connector endpoints must fail closed until a separate real-cloud authorization package names operation class, target environment, evidence sink and rollback owner.

## Subscribed Truth

- docs/active/README.md
- docs/product/README.md
- docs/runtime/README.md
- docs/source/README.md
- docs/delivery/README.md
- docs/evidence/README.md
- docs/policies/README.md
- docs/specs/README.md
- specs/runtime/spec.md
- specs/source/spec.md
- specs/operations/spec.md
