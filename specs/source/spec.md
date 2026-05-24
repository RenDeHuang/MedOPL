# Source Spec

Owner: `MedOPL Platform`
Purpose: `source_surface_spec`
State: `active`
Human index: `docs/source/README.md`

## Scope

Source specs define active source surfaces and retired source boundaries.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `source:active-services` | Framework | `docs/source/README.md`, `services/portal`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs` | local contract proof | Retired user_owned, resource-order or old runner/provisioner paths are active. |
| `source:no-upstream-write` | Integration | `docs/source/README.md`, `docs/runtime/README.md` | `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs` | local contract proof | MedOPL writes Portal/Gateway/Runtime code into upstream. |
| `source:portal-runtime-fanout-debt` | Product | `services/portal/src/app/portal-runtime.mjs`, adjacent Portal app modules | `npm --prefix services/portal run check`; `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all` | local source structure proof | A first helper extraction completes all Portal structure debt or replaces service-level architecture review. |
| `source:portal-minio-sync-helper-retired` | Product + Runtime | `services/portal/src/integrations/minio-storage-client.mjs`, `scripts/` | `node tests/regression/portal/regression-test-v22-workspace-storage-public-response.mjs`; `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs` | local source cleanup proof | A shell helper path, PowerShell script or script-level MinIO sync wrapper remains active runtime truth. |
| `source:figma-ui-repo-native-absorption` | Product | `services/portal/frontend/src/app/**`, `services/portal/frontend/src/api/**`, `docs/source/README.md` | `npm --prefix services/portal/frontend run typecheck`; `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group surface` | local frontend proof | Figma Make prototype is production frontend truth before repo absorption and typed API wiring. |
| `source:portal-typed-api-contract` | Product + Runtime | `services/portal/frontend/src/api/portal/**`, `services/portal/frontend/src/app/data/**`, `services/portal/src/routes/**`, `docs/source/README.md` | `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`; `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`; `npm --prefix services/portal/frontend run typecheck` | local frontend contract proof | Page-local mock readiness, billing, resource or OPL launch truth is the implementation source. |
| `source:opl-entry-real-preflight-launch` | Product + Runtime | `services/portal/frontend/src/api/portal/**`, `services/portal/frontend/src/app/pages/**`, `services/portal/frontend/src/app/data/**`, `services/portal/src/routes/**` | `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`; `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`; `npm --prefix services/portal/frontend run typecheck` | local frontend/runtime contract proof | OPLEntry page-local readiness, hardcoded provider state or internal launch-status payload is the implementation source. |
| `source:go-control-plane-takeover-order` | Product + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `services/portal/src`, `docs/source/README.md` | `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | A roadmap order proves Go production takeover or real-cloud readiness. |
| `source:go-control-plane-mvp-takeover` | Product + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `services/portal/src`, `docs/source/README.md` | `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | Real-cloud readiness can start before Go local RC, or Node Portal backend can remain a long-term compatibility control plane. |
