# agent-verify-manifest-compaction Tasks

- [x] Step 0: audit manifest consumers.
- [x] Step 1: write the failing current-only leaf assertion.
- [x] Step 2: verify RED on `contract-test-v22-current-state-index-loop.mjs`.
- [x] Step 3: delete closed historical leaves from the active verify manifest.
- [x] Step 4: update framework spec and change package docs.
- [x] Step 5: run focused verification.
- [x] Step 6: run review gate and full verify.

## Next Cleanup Packages

- Suite/package command catalog compaction if still needed after docs foldback.
- `docs/specs/README.md` index-only foldback.
- `docs/history/README.md` summary-only foldback.
- Go handler split.
- Workflow gate split.
