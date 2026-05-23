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

