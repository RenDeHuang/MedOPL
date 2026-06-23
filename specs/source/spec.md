# Source Spec

Owner: `MedOPL Platform`
Purpose: `source_surface_spec`
State: `active`
Human index: `docs/source/README.md`

## Scope

Source specs define active source surfaces and retired source boundaries.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `source:active-services` | Framework | `docs/source/README.md`, `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs` | local contract proof | Retired user_owned, resource-order, Node Portal backend or old runner/provisioner paths are active. |
| `source:no-upstream-write` | Integration | `docs/source/README.md`, `docs/runtime/README.md` | `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs`; `node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs`; `node tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs` | local contract proof | MedOPL writes Portal/Gateway/Runtime code into upstream. |
| `source:node-portal-backend-physical-removal` | Product + Operations | `services/portal/package.json`, `services/portal/frontend`, `services/medopl-go-backend`, `docs/source/README.md` | `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs` | local cleanup proof | Node Portal backend remains as shell, facade, compatibility control plane or active verification owner. |
| `source:figma-ui-repo-native-absorption` | Product | `services/portal/frontend/src/app/**`, `services/portal/frontend/src/api/**`, `docs/source/README.md` | `npm --prefix services/portal/frontend run typecheck`; `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs` | local frontend proof | Figma Make prototype is production frontend truth before repo absorption and typed API wiring. |
| `source:portal-typed-api-contract` | Product + Runtime | `services/portal/frontend/src/api/portal/**`, `services/portal/frontend/src/app/data/**`, `services/medopl-go-backend`, `docs/source/README.md` | `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `npm --prefix services/portal/frontend run typecheck` | local frontend contract proof | Page-local mock readiness, billing, resource or OPL launch truth is the implementation source. |
| `source:opl-entry-real-preflight-launch` | Product + Runtime | `services/portal/frontend/src/api/portal/**`, `services/portal/frontend/src/app/pages/**`, `services/portal/frontend/src/app/data/**`, `services/medopl-go-backend` | `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`; `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `npm --prefix services/portal/frontend run typecheck` | local frontend/runtime contract proof | OPLEntry page-local readiness, hardcoded provider state or internal launch-status payload is the implementation source. |
| `source:go-control-plane-takeover-order` | Product + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `docs/source/README.md` | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | A roadmap order proves Go production takeover or real-cloud readiness. |
| `source:go-control-plane-mvp-takeover` | Product + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `docs/source/README.md` | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | Real-cloud readiness can start before Go local RC, or Node Portal backend can remain a long-term compatibility control plane. |
| `source:node-portal-backend-deployment-retirement` | Product + Operations | `services/portal/package.json`, `services/portal/frontend/vite.config.ts`, `services/portal/frontend/src/api/**`, `services/medopl-go-backend` | `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `npm --prefix services/portal/frontend run typecheck` | local pre-cloud source proof | Node Portal backend remains a deployable backend, frontend proxy target, typed API owner or current verification owner. |
| `source:sentrux-v22-rules-alignment` | Framework | `.sentrux/rules.toml`, `docs/source/README.md`, `docs/history/README.md` | `node tests/health/health-check-v22-workflow-gate.mjs` | archived structural provenance | Do not claim archived Sentrux alignment proves current active truth, current verification ownership, production readiness, real-cloud readiness, deploy authorization, kubectl authorization, build/push authorization or live-test authorization. |
| `source:sentrux-health-signal` | Framework | `.sentrux/rules.toml`, `scripts/workflow-gate/policy.mjs`, `tests/health/health-check-v22-workflow-gate.mjs` | `node tests/health/health-check-v22-workflow-gate.mjs`; `node tests/contracts/contract-test-v22-validate-active-platform.mjs` | local health signal | Do not claim local Sentrux or repo-health signals prove production readiness, real cloud readiness, OPL runtime readiness, billing readiness, deploy authorization, kubectl authorization, build/push authorization or live-test authorization. |
| `source:gateway-launch-bridge-carrier-split` | Framework + Source | `services/opl-web-gateway/src/launch-client-script.mjs`, `services/opl-web-gateway/src/launch-client-script/**`, `tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs`, `tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs` | `node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs`; `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`; `node scripts/v22-line-budget.mjs` | local gateway/source proof | Gateway launch bridge cleanup proves runtime protocol change, commercial readiness, deploy, billing, real cloud, kubectl, build/push or live-test readiness. |
| `source:portal-resource-control-ui-composition` | Product + Source | `services/portal/frontend/src/app/**`, `services/portal/frontend/src/api/portal/**`, `services/medopl-go-backend`, `tests/regression/portal/**` | `node tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs`; `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs` | local frontend regression proof | UI composition proof authorizes restoring retired routes, old Vue/Pinia surfaces, page-local static mock truth, aggregate admin model imports, direct non-core UI imports, cloud-console user language or Figma prototype truth before repo absorption. |

## Portal Resource Control UI Composition

The active Portal resource-control UI truth is the repo-native React/Vite/TypeScript frontend under `services/portal/frontend/src/app/**` and the typed API adapters under `services/portal/frontend/src/api/portal/**`. Retired route, stack and UI-package checks are source-owned regression checks, not `docs/specs/README.md` prose.

Retired frontend routes:

- `/advanced/servers`
- `/runtime`
- `/tasks`
- `/trace`
- `/resources`
- `/workspace`
- `/billing`
- `/opl-launch`
- `/portal/opl`

Retired frontend stack:

- Vue
- Pinia

Required user routes:

- `/overview`
- `/packages`
- `/compute`
- `/storage`
- `/usage`
- `/opl`

Required admin routes:

- `/admin/dashboard`
- `/admin/users`
- `/admin/alerts`
- `/admin/billing-ops`
- `/admin/audit`
- `/admin/system`
- `/admin/ops`
