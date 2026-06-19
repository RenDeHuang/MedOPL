# Evidence Spec

Owner: `MedOPL Platform`
Purpose: `evidence_behavior_spec`
State: `active`
Human index: `docs/evidence/README.md`

## Scope

Evidence specs define evidence-after-contract, evidence levels, storage boundaries, can-claim / cannot-claim and closeout routing.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `evidence:after-contract` | Framework | `docs/evidence/README.md` | `node tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs`; `node tests/health/health-check-v22-workflow-gate.mjs` | local contract proof | Smoke, proof or canary automatically becomes production truth. |
| `evidence:no-secret-storage` | Framework | `docs/evidence/README.md`, `docs/policies/README.md` | `node tests/hygiene/hygiene-test-v22-diff-scoped-sensitive-review-gate.mjs`; `node tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs` | local contract proof | Raw secrets can enter git evidence. |
| `evidence:local-provider-bound-message-proof` | Runtime | `docs/evidence/README.md`, `docs/specs/README.md`, `docs/history/README.md` | `node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs` | historical local RC proof with current deterministic guards | Historical local provider-bound proof is current production provider, live external, deploy, real cloud or billing evidence. |

Related runtime anchor: `runtime:local-rc-provider-bound-message-backflow`.
