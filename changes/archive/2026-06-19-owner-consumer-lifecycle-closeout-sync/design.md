# owner-consumer-lifecycle-closeout-sync Design

## Architecture

This is a closeout metadata and workflow-gate alignment change. It keeps `tests/fixtures/v22/goal-current.json` as the machine cursor, updates the human pointers in `docs/active`, `docs/delivery` and `docs/history`, and changes `scripts/v22-landing-closeout.mjs` so cleaned landed branches do not need to remain as local refs.

## Data Flow

`goal-current.json.latest_landed_closeout` records the landed branch label and commit. `docs/history/README.md` records the same compact pointer. `docs/active/README.md` and `docs/delivery/README.md` expose the latest repo closeout to human readers. The closeout runner validates the commit against the Git object database and the current machine cursor when the branch ref has been retired.

## Failure Modes

- If active/delivery/history omit the latest branch or commit, index-loop fails.
- If closeout automation requires deleted branch refs, local branch cleanup and closeout verification conflict.
- If current problem text drifts to an old template, MedOPL product truth is replaced by stale implementation debt.

## Surface Impact

- source: `scripts/v22-landing-closeout.mjs`
- docs: `docs/active/README.md`, `docs/delivery/README.md`, `docs/history/README.md`
- specs: `specs/framework/spec.md` adds `framework:retired-landed-branch-ref-closeout`
- tests: `tests/fixtures/v22/goal-current.json`, `tests/governance/governance-test-v22-landing-closeout-automation.mjs`
