# docs-history-summary-only Design

## Architecture

The history surface becomes a stable, short human index. It exposes owner, purpose, state, machine boundary, latest cursor pointer, archive pointer and tombstone map. It does not store per-run records.

The machine closeout state moves to `tests/fixtures/v22/goal-current.json.latest_landed_closeout`, alongside the existing `last_landed_commit`, `last_landed_branch`, `history_latest_branch` and `post_merge_closeout_completed` fields.

`scripts/v22-landing-closeout.mjs` keeps its CLI contract but reads latest landed state from the fixture. Generate mode validates git reachability, updates the fixture, updates `docs/active/README.md`, and refreshes only the short latest-cursor block in history.

## Data Flow

`goal-current.json.latest_landed_closeout` -> `scripts/v22-landing-closeout.mjs check` -> contract tests / verify manifest.

`scripts/v22-landing-closeout.mjs generate` -> fixture structured closeout state + short history pointer + active current evidence sentence.

Historical detail remains in `changes/archive/` and git history.

## Failure Modes

- If history grows landed-run sections again, lifecycle and closeout tests fail.
- If `latest_landed_closeout` is missing or stale, current-state and cleanup lifecycle tests fail.
- If closeout automation starts parsing history prose again, local-contract tests fail.
- If tombstone pointers are removed, docs portfolio and full taxonomy cleanup tests fail.

## Surface Impact

- source: `scripts/v22-landing-closeout.mjs`
- docs: `docs/history/README.md`
- specs: `specs/framework/spec.md`
- tests: history, closeout and lifecycle contract tests
- fixtures: `tests/fixtures/v22/goal-current.json`
