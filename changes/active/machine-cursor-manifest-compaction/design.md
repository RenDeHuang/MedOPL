# machine-cursor-manifest-compaction Design

## Architecture

The cleanup keeps the existing fixture files and consumers. It does not introduce a compatibility layer or a new archive JSON. The package deletes duplicated release-readiness subtrees and adds a current contract that treats the release readiness object as a compact gate-only surface.

## Data Flow

1. `goal-current.json` keeps top-level Package D and production launch projections.
2. `release_readiness_state` keeps only scalar and small gating fields needed by current tests and verify flows.
3. `contract-test-v22-current-state-index-loop.mjs` asserts the large duplicate fields are absent and that release readiness stays compact.
4. Existing `current`, `local-contract` and `review` lanes continue to run the current-state index loop gate.
5. `agent-verify-manifest.json` and current leaf commands keep their existing gate shape without adding a new test file.

## Failure Modes

- Reintroducing duplicate Package D or production launch payloads under `release_readiness_state` fails the current-state index loop contract.
- Omitting the current-state index loop from manifest suites fails the existing current-state and lane registry checks.
- Breaking current cursor or leaf command parity fails agent verify and current-state index loop tests.

## Surface Impact

- source: none
- fixtures: `tests/fixtures/v22/goal-current.json`, `tests/fixtures/v22/agent-verify-manifest.json`
- tests: `tests/contract/contract-test-v22-current-state-index-loop.mjs`
- specs: `specs/framework/spec.md`
