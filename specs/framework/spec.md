# Framework Spec

Owner: `MedOPL Platform`
Purpose: `framework_behavior_spec`
State: `active`
Human index: `docs/framework/README.md`, `docs/specs/README.md`

## Scope

Framework specs define owner boundary, surface budget, admission, readiness and four-plane governance.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `framework:rules-before-status` | Framework | `docs/framework/README.md`, `docs/policies/README.md` | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` | local contract proof | Current status can rewrite durable rules. |
| `framework:change-package-required` | Framework | `changes/README.md` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs` | local contract proof | Chat prompt alone is durable change context. |

