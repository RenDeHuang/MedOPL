# Runtime Spec

Owner: `MedOPL Gateway / Runtime Bridge`
Purpose: `runtime_behavior_spec`
State: `active`
Human index: `docs/runtime/README.md`, `docs/specs/README.md`

## Scope

Runtime specs define Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent boundaries, including session, message, fileRef, run, artifact and trace projection.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `runtime:clean-upstream-boundary` | Integration | `services/opl-web-gateway`, `docs/runtime/README.md` | `node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs` | local integration proof | MedOPL owns or modifies upstream OPL internals. |
| `runtime:bridge-projection` | Runtime | `services/opl-runtime-bridge` | `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs` | local smoke evidence | Local bridge proof is production runtime readiness. |
| `runtime:local-rc-provider-bound-message-backflow` | Integration + Runtime | `services/portal`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs` with authorized `GFLABTOKEN` env | local RC authorized proof | Local RC evidence is production provider, real WebUI provider reply, real cloud, deploy or billing readiness. |
| `runtime:opl-entry-real-preflight-launch` | Product + Integration + Runtime | `services/portal/src/routes`, `services/portal/frontend/src/app/pages`, `services/portal/frontend/src/app/data`, `services/opl-web-gateway` | `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`; `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`; `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs` | local regression proof | OPL entry local projection is live provider evidence, real cloud authorization, deploy readiness or production WebUI provider reply evidence. |
| `runtime:go-control-plane-mvp-api` | Product + Runtime | `services/medopl-go-backend`, `services/portal/frontend/src/api/portal/**`, `docs/runtime/README.md` | `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local backend proof | Go local MVP typed API proof is production backend replacement, real cloud readiness or live provider evidence. |
| `runtime:go-local-rc-parity` | Product + Runtime + Operations | `services/medopl-go-backend`, `services/portal/frontend/src/api/portal/**`, `services/portal/src`, `docs/runtime/README.md` | `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend` | local deterministic RC proof | Go local RC parity is live provider, real OPL upstream, production secret storage, real cloud, deploy, kubectl, build/push, production billing or production runtime evidence. |
| `runtime:precloud-deployable-rc` | Product + Runtime + Operations | `services/medopl-go-backend`, `services/portal/frontend`, `services/opl-web-gateway`, `services/opl-runtime-bridge` | `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` | local pre-cloud deployable proof | Local pre-cloud deployable proof is real-cloud, deploy, kubectl, build/push, live provider, production billing or production runtime evidence. |

Related evidence anchor: `evidence:local-provider-bound-message-proof`.
