# agent-verify-manifest-compaction Design

## Architecture

The active verify manifest remains the only machine-readable verify manifest. The cleanup does not introduce a compatibility layer, facade, alias manifest or archive JSON. Historical leaves are deleted from the active manifest after confirming that current consumers only need the active cursor leaf.

## Data Flow

1. `goal-current.json` owns `current_cursor` and current leaf command parity.
2. `agent-verify-manifest.json` keeps one `leaves` entry matching `current_cursor`.
3. `scripts/v22-verify.mjs current` resolves that current leaf and continues to execute the same command bundle.
4. `scripts/v22-verify.mjs list` reports only active machine leaves, not historical provenance.
5. `contract-test-v22-current-state-index-loop.mjs` enforces current-only leaf storage.

## Failure Modes

- Reintroducing old leaves fails the current-state index loop gate.
- Removing the current leaf fails agent verify and current-state gates.
- Changing current leaf commands fails parity with `goal-current.json`.
- Breaking suite/package bundles fails lane registry and root verify workflow gates.

## Surface Impact

- fixtures: `tests/fixtures/v22/agent-verify-manifest.json`
- tests: `tests/contract/contract-test-v22-current-state-index-loop.mjs`
- specs: `specs/framework/spec.md`
- change package: `changes/active/agent-verify-manifest-compaction`
