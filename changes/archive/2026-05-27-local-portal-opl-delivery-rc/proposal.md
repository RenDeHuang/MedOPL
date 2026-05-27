# local-portal-opl-delivery-rc Proposal

Status: authoring
Branch: feat/v22-local-portal-opl-delivery-rc
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product | Integration | Runtime | Operations

## Why

The repository has local RC proof for service orchestration, Gateway, Runtime Bridge and aggregate SaaS backend guards, but it is still proof-driven rather than delivery-ready. Portal and OPL must be separated into two local delivery modules before any cloud package: Portal must be a local SaaS backend/front-end RC, OPL must remain clean upstream and be reached only through Gateway / Runtime Bridge. Cloud is a separate future module and stays fail-closed.

## Goals

- Define Portal local delivery as a first-class non-cloud package.
- Define OPL local delivery as a clean upstream integration package, without copying or modifying upstream.
- Add repo-native local release candidate verification for cold start, health, product golden path shape, Portal state persistence, OPL/Gateway/Runtime Bridge integration boundary and cloud fail-closed behavior.
- Keep the cloud module blocked behind `real-cloud-authorization-boundary`.
- Reduce local-rc static projection as implementation progresses, without adding a second control plane.

## Non-Goals

- Do not read secrets, provider keys, kubeconfig, tokens or SSH private keys.
- Do not call real cloud, real provider, COS, Langfuse or production APIs.
- Do not run deploy, kubectl, build/push or live-test.
- Do not modify one-person-lab upstream, `deploy/*`, `.sentrux/*`, `adapters/*` or `infra/*`.
- Do not copy one-person-lab into MedOPL source or import upstream internals.
- Do not turn local RC proof into production/cloud truth.

## Golden Path Impact

- improves: moves the non-cloud golden path from local proof into a local delivery RC package.
- affected steps: login / credit / provider key -> open managed environment -> launch local OPL -> upload / task -> run / artifact -> billing / trace / audit -> release / stop billing.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- Local clean OPL evidence may only use an explicitly configured local URL; it cannot prove upstream production readiness.
- Provider key handling remains backend-only; public surfaces may expose only `providerKeyRef` and bound status.

## Subscribed Truth

- docs/active/README.md
- docs/product/README.md
- docs/runtime/README.md
- docs/source/README.md
- docs/delivery/README.md
- docs/evidence/README.md
- docs/policies/README.md
- docs/specs/README.md
- specs/product/spec.md
- specs/runtime/spec.md
- specs/operations/spec.md
- changes/README.md
