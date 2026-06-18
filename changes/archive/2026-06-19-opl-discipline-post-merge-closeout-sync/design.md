# opl-discipline-post-merge-closeout-sync Design

## Architecture

This is a closeout metadata sync only. The owner surfaces are the human current/delivery/history docs and the machine cursor fixture.

## Data Flow

`docs/history/README.md` records the landed branch and post-push closeout block. `tests/fixtures/v22/goal-current.json` records the same landed branch/commit as machine cursor state. `docs/active/README.md` and `docs/delivery/README.md` carry the human pointer required by the index-loop gate.

## Failure Modes

- If history order does not put the latest landed section last, `v22-landing-closeout` continues to see the previous landed run.
- If delivery or active omit the latest branch/commit, the index-loop gate fails.
- If current problem text is replaced by a stale script template, current truth drifts from the real Gap 08o blocker.

## Surface Impact

- source: none
- docs: `docs/active/README.md`, `docs/delivery/README.md`, `docs/history/README.md`
- specs: no durable spec behavior change
- tests: `tests/fixtures/v22/goal-current.json`
