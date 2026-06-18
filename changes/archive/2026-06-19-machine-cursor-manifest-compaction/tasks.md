# machine-cursor-manifest-compaction Tasks

- [x] Step 0: audit direct consumers of `goal-current.json` and `agent-verify-manifest.json`.
- [x] Step 1: add a failing machine cursor compaction contract.
- [x] Step 2: remove duplicate release readiness large payloads from `goal-current.json`.
- [x] Step 3: register the compaction contract in test lane registry and verify manifest.
- [x] Step 4: run focused consumer verification.
- [x] Step 5: run full verification and landing review.

## Next Cleanup Packages

- `goal-current.json` deeper compaction after consumer migration.
- `agent-verify-manifest.json` header and suite duplication compaction.
- `docs/specs/README.md` and `docs/history/README.md` foldback.
- Go handler split.
- Workflow gate split.
