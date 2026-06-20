# Runtime Spec

Owner: `MedOPL Gateway / Runtime Bridge`
Purpose: `runtime_behavior_spec`
State: `active`
Human index: `docs/runtime/README.md`, `docs/specs/README.md`

## Scope

Runtime specs define Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent boundaries, including session, message, fileRef, run, artifact projection and internal audit correlation.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `runtime:clean-upstream-boundary` | Integration | `services/opl-web-gateway`, `docs/runtime/README.md` | `node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs` | local integration proof | MedOPL owns or modifies upstream OPL internals. |
| `runtime:bridge-projection` | Runtime | `services/opl-runtime-bridge` | `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs` | local smoke evidence | Local bridge proof is production runtime readiness. |
| `runtime:local-rc-provider-bound-message-backflow` | Integration + Runtime | `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs` | local deterministic proof | Local RC evidence is production provider, real WebUI provider reply, real cloud, deploy or billing readiness. |
| `runtime:opl-entry-real-preflight-launch` | Product + Integration + Runtime | `services/portal/frontend/src/app/pages`, `services/portal/frontend/src/app/data`, `services/medopl-go-backend`, `services/opl-web-gateway` | `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs` | local regression proof | OPL entry local projection is live provider evidence, real cloud authorization, deploy readiness or production WebUI provider reply evidence. |
| `runtime:portal-opl-entry-alias-preflight` | Product + Integration | `services/portal/frontend/src/app/routes.tsx`, `services/portal/frontend/src/app/data/portalOplEntryModel.ts`, `services/portal/frontend/src/app/data/portalQuery.ts`, `services/portal/frontend/src/api/portal/opl.ts`, `docs/history/README.md` | `node tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs`; `npm --prefix services/portal/frontend run typecheck` | local regression proof | Portal OPL alias/preflight proof is real upstream OPL production behavior, live provider, real cloud, production runtime or deploy readiness. |
| `runtime:go-control-plane-mvp-api` | Product + Runtime | `services/medopl-go-backend`, `services/portal/frontend/src/api/portal/**`, `docs/runtime/README.md` | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | Go local MVP typed API proof is production backend replacement, real cloud readiness or live provider evidence. |
| `runtime:go-local-rc-parity` | Product + Runtime + Operations | `services/medopl-go-backend`, `services/portal/frontend/src/api/portal/**`, `docs/runtime/README.md` | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend` | local deterministic RC proof | Go local RC parity is live provider, real OPL upstream, production secret storage, real cloud, deploy, kubectl, build/push, production billing or production runtime evidence. |
| `runtime:precloud-deployable-rc` | Product + Runtime + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local pre-cloud deployable proof | Local pre-cloud deployable proof is real-cloud, deploy, kubectl, build/push, live provider, production billing or production runtime evidence. |
| `runtime:local-clean-opl-delivery-rc` | Product + Integration + Runtime | `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge`, `docs/history/README.md` | `node tests/regression/opl/regression-test-v22-local-portal-gateway-runtime-rc.mjs`; `npm run verify:local-release-candidate -- --json` | local integration proof | Local clean OPL delivery RC is real upstream OPL production behavior, live provider, real cloud, production runtime or production billing evidence. |
| `runtime:cloud-foundation-preflight` | Operations + Runtime | `tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`, `docs/specs/README.md`, `docs/runtime/README.md` | `node tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`; `npm run test:cloud-future-authorized` | local dry-run preflight proof | TKE foundation preflight proves production runtime, real cloud, deploy, kubectl, build/push, live-test, namespace/workload/tenant node pool creation or Package C live mutation authorization. |
| `runtime:ai-runtime-contract` | Runtime | `services/opl-runtime-bridge`, `docs/runtime/README.md`, `docs/framework/README.md`, `docs/specs/README.md`, `docs/history/README.md` | `node tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs`; `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs` | local contract proof | AI Runtime Contract proof is production runtime readiness, live provider evidence, real cloud authorization, deploy, kubectl, build/push, live-test or production MCP server readiness. |
| `runtime:mcp-compatible-boundary` | Runtime | `services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs`, `specs/runtime/spec.md`, `docs/framework/README.md` | `node tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs` | local contract proof | MCP-compatible boundary authorizes external MCP clients, production MCP server, secret reads, real cloud, deploy, kubectl, build/push or live-test. |
| `runtime:saas-portal-opl-ops-surface-boundary` | Product + Runtime + Operations | `docs/product/README.md`, `docs/runtime/README.md`, `services/portal/frontend/src/app/**`, `services/portal/frontend/src/api/portal/**`, `services/medopl-go-backend` | `node tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs`; `node tests/regression/portal/regression-test-v22-portal-contract-role-consolidation.mjs` | local regression proof | Shared Portal/OPL/ops surface proof authorizes cloud-console UX, raw provider key exposure, launch/runtime tokens in browser storage, real cloud, deploy, production billing or direct upstream modification. |

`runtime:saas-portal-opl-ops-surface-boundary` defines shared Portal / OPL entry / admin-ops product semantics only. Executable Portal UI composition is delegated to `spec:v22-portal-resource-control-ui-composition-boundary` and source-owned by `specs/source/spec.md`, `services/portal/frontend/src/app/**` and `services/portal/frontend/src/api/portal/**`.

Related evidence anchor: `evidence:local-provider-bound-message-proof`.

## AI Runtime Contract

AI Runtime Contract is MedOPL's Runtime Bridge AI runtime adapter layer. It keeps Portal, Gateway, clean OPL upstream, OPL ACP runtime, Runtime Agent HTTP API and future tool/resource adapters behind one Runtime Bridge contract rather than making LangGraph, OpenAI Agents SDK, MCP, A2A or upstream internals the platform owner.

Stable contract objects:

- runtimeSession
- runtimeTool
- runtimeResource
- runtimeRun
- runtimeArtifact
- runtimeApproval

MCP-compatible boundary means tools / resources / prompts / artifacts / approval shape compatibility. The source-owned local projection is `services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs`; it emits shape-only runtimeTool, runtimeResource, runtimeRun, runtimeArtifact and runtimeApproval metadata for contract tests. It does not start a production MCP server, authorize external MCP clients, grant secret access, grant real cloud access, deploy, kubectl, build/push or live-test authorization.

`providerKeyRef` may cross the boundary as a reference. Raw provider key, bearer token, launchToken, runtimeToken, objectKey, localPath, signedUrl and presignedUrl must not enter public state, tool/resource response, artifact projection, evidence, logs or git.

Verification entry:

```bash
node tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs
```
