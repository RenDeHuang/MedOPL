# gateway-launch-bridge-split Proposal

Status: authoring
Branch: cleanup/v22-gateway-launch-bridge-split
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL gateway source governance
Affected plane: Framework / Source

## Why

`services/opl-web-gateway/src/launch-client-script.mjs` had grown into a 1000+ line browser script template. That blurred owner boundaries inside the gateway launch bridge carrier and forced line-budget baseline debt to remain active.

## Goals

- Keep `portalLaunchClientScript()` as the only public source entrypoint.
- Split the browser script generator into owner-scoped carrier modules under `services/opl-web-gateway/src/launch-client-script/**`.
- Preserve generated script behavior and public browser API shape.
- Retire the line-budget baseline entry for `launch-client-script.mjs`.

## Non-Goals

- No commercial/productization expansion.
- No runtime bridge protocol change, no browser API rename, no new launch flow behavior.
- No secret read, kubeconfig read, deploy, kubectl, build/push, live-test or real cloud operation.
- No upstream one-person-lab modification.

## Golden Path Impact

- no-impact: gateway launch bridge behavior stays the same while source ownership becomes explicit.
- affected steps: source reviewability, line-budget hygiene, gateway launch-client maintenance.
- required golden path eval: local gateway launch regressions and line-budget gate only; no golden path runtime claim.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- No changes under `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or upstream one-person-lab.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- docs/source/README.md
- specs/source/spec.md
- services/opl-web-gateway/src/launch-client-script.mjs
- services/opl-web-gateway/src/launch-client-script/**
- tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs
- tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs
