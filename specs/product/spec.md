# Product Spec

Owner: `MedOPL Portal`
Purpose: `product_behavior_spec`
State: `active`
Human index: `docs/product/README.md`, `docs/specs/README.md`

## Scope

Product specs define what users buy and what Portal may claim about accounts, workspaces, packages, file space, managed compute, billing, audit and OPL entry.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `product:golden-path-default-spine` | Product | `docs/product/README.md`, `tests/fixtures/v22/agent-verify-manifest.json` | `node tests/contract/contract-test-v22-golden-smoke-suite.mjs`; `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json` | local smoke evidence | Local golden smoke proves production runtime, real cloud, real billing or live provider. |
| `product:golden-path-productization-roadmap` | Product | `docs/product/README.md`, `docs/delivery/README.md`, `changes/archive/2026-05-23-golden-path-productization-roadmap` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json` | local contract proof | Figma UI absorption, typed API, provider reuse, Go takeover or real cloud authorization has landed. |
| `product:managed-opl-service` | Product | `docs/product/README.md`, `services/portal` | `node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs` | local smoke evidence | Real cloud resources, production billing or deploy are complete. |
| `product:no-cloud-console-language` | Product | `docs/product/README.md`, Portal user routes | `node tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs` | local regression proof | Users self-manage CVM/COS/K8s through MedOPL. |
| `product:local-portal-delivery-rc` | Product | `services/portal/frontend`, `services/medopl-go-backend`, `changes/archive/2026-05-27-local-portal-opl-delivery-rc` | `node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs`; `npm run verify:local-release-candidate -- --json` | local release-candidate proof | Local Portal delivery RC is production backend, real cloud, live provider, production billing or deploy readiness. |
