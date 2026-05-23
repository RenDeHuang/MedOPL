# MedOPL Durable Specs

Owner: `MedOPL`
Purpose: `durable_behavior_specs`
State: `active`
Machine boundary: root `specs/**` contains durable behavior specs and requirement-to-eval anchors. `docs/specs/README.md remains the human contract index`; `changes/active/<change-id>/spec-delta.md` is the only place for proposed spec changes before they are accepted.

Root specs are not current truth and not evidence logs. Current truth remains `docs/active/README.md`; evidence claims remain `docs/evidence/README.md`; landed provenance remains `docs/history/README.md`.

## Domain Specs

| Domain | Owner | File |
| --- | --- | --- |
| product | `MedOPL Portal` | `specs/product/spec.md` |
| runtime | `MedOPL Gateway / Runtime Bridge` | `specs/runtime/spec.md` |
| framework | `MedOPL Platform` | `specs/framework/spec.md` |
| operations | `MedOPL Operations` | `specs/operations/spec.md` |
| evidence | `MedOPL Platform` | `specs/evidence/spec.md` |
| policies | `MedOPL Platform` | `specs/policies/spec.md` |
| source | `MedOPL Platform` | `specs/source/spec.md` |

## Change Routing

Proposed spec changes start in `changes/active/<change-id>/spec-delta.md`. Accepted deltas are synced into the affected `specs/<domain>/spec.md` during closeout, then the package moves to `changes/archive/YYYY-MM-DD-<change-id>`.

Each durable requirement should expose:

- requirement id
- owner plane
- source or docs surface
- required evals
- evidence level
- cannot-claim boundary

## Traceability Invariants

Every durable requirement must map to at least one local deterministic eval or an explicit future-authorized boundary eval.

Specs without evals are design notes, not accepted durable requirements. Evals without spec anchors are regression checks, not contract evidence. If a requirement cannot be verified locally, it must explicitly declare its future-authorized boundary and cannot-claim list.
