# Evidence Spec

Owner: `MedOPL Platform`
Purpose: `evidence_behavior_spec`
State: `active`
Human index: `docs/evidence/README.md`

## Scope

Evidence specs define evidence-after-contract, evidence levels, storage boundaries, can-claim / cannot-claim and closeout routing.

| Requirement | Owner plane | Source surface | Required evals | Evidence level | Cannot claim |
| --- | --- | --- | --- | --- | --- |
| `evidence:after-contract` | Framework | `docs/evidence/README.md` | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` | local contract proof | Smoke, proof or canary automatically becomes production truth. |
| `evidence:no-secret-storage` | Framework | `docs/evidence/README.md`, `docs/policies/README.md` | `node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs` | local contract proof | Raw secrets can enter git evidence. |
| `evidence:local-provider-key-bound-message-proof` | Runtime | `docs/evidence/README.md`, `docs/specs/README.md` | `node tests/local-rc/local-rc-test-v22-provider-key-message-backflow.mjs` with authorized `GFLABTOKEN` env | local RC authorized proof | Local provider-key-bound proof is production provider, live external, deploy, real cloud or billing evidence. |
