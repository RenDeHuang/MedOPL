# Policies Spec

Owner: `MedOPL Platform`
Purpose: `policy_behavior_spec`
State: `active`
Human index: `docs/policies/README.md`, `AGENTS.md`

## Scope

Policy specs define authorization, secret hygiene, workflow, cleanup, human/machine boundary and landing protocol.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `policies:no-secret-live-default` | Framework | `AGENTS.md`, `docs/policies/README.md` | `node tests/hygiene/hygiene-test-v22-diff-scoped-sensitive-review-gate.mjs`; `node tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs` | local contract proof | Secret read, real cloud, build/push, kubectl, deploy or live-test is allowed by default. |
| `policies:human-machine-boundary` | Framework | `docs/policies/README.md`, `tests/README.md` | `node tests/health/health-check-v22-smoke-eval-boundary.mjs`; `node tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs` | local contract proof | Markdown prose is a machine API. |
