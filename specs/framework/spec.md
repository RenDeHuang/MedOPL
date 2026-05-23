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
| `framework:golden-path-impact-required` | Framework | `changes/README.md`, `docs/framework/README.md` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs` | local contract proof | Governance gate success can replace golden path health. |
| `framework:repo-native-change-lifecycle` | Framework | `changes/README.md`, `specs/README.md`, `scripts/v22-workflow-gate.mjs` | `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`; `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`; `node tests/health/health-check-v22-workflow-gate.mjs` | local contract proof | OpenSpec CLI is installed or production operations are authorized. |
