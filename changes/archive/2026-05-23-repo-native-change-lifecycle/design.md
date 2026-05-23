# repo-native-change-lifecycle Design

## Architecture

The lifecycle adds two root control surfaces:

- `changes/`: active and archived change packages.
- `specs/`: durable behavior specs with requirement-to-eval traceability.

`docs/**` remains the human truth taxonomy. `tests/**` remains the eval taxonomy. `scripts/` remains runner/classifier/workflow only.

## Data Flow

```text
docs/active current cursor
-> changes/active/<change-id>
-> spec-delta.md
-> specs/<domain>/spec.md
-> tests/** evals
-> review gate
-> changes/archive/YYYY-MM-DD-<change-id>
-> docs/history/README.md summary
```

## Failure Modes

- Missing active change package for formal engineering changes fails workflow review.
- Archived package without required files fails lifecycle gate.
- Archived delta not synced to target specs fails lifecycle gate.
- Domain spec without eval traceability fails spec/eval gate.
- Active truth carrying change details fails current development lines gate.

## Surface Impact

- source: none.
- docs: docs index, active, policies, delivery, history.
- specs: new root domain specs and framework requirement.
- tests: lifecycle, traceability, registry, manifest and workflow gates.

