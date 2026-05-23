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

