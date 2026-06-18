# current-leaf-owner-compaction-closeout-sync Design

## Architecture

This is a closeout metadata sync only. It updates the human current/delivery/history docs and machine cursor landed pointers for the cleanup package already on trunk.

It also corrects the cleanup closeout gate: post-merge closeout commits cannot know their own future commit hash, so the stable rule is to reject non-closeout commits after the latest landed commit while allowing closeout-only commits.

## Data Flow

`docs/history/README.md` records the cleanup branch as the latest landed run. `tests/fixtures/v22/goal-current.json` records the same landed branch/commit. `docs/active/README.md` and `docs/delivery/README.md` carry the human pointer required by the index-loop gate.

## Failure Modes

- If history order does not put the latest cleanup section last, closeout check sees the previous landed run.
- If active or delivery omit the latest branch/commit, index-loop fails.
- If current problem text is replaced by the stale script template, current truth drifts from the real Gap 08o blocker.
- If cleanup closeout requires the landed commit to equal the later closeout commit hash, the gate becomes impossible to satisfy.

## Surface Impact

- source: `scripts/v22-landing-closeout.mjs`
- docs: `docs/active/README.md`, `docs/delivery/README.md`, `docs/history/README.md`
- specs: `specs/framework/spec.md`
- tests: `tests/fixtures/v22/goal-current.json`, `tests/contract/contract-test-v22-landing-closeout-automation.mjs`
