# opl-style-development-discipline-convergence Tasks

- [x] Step 0: baseline audit of current AGENTS discipline, closeout generator, workflow gate, and large-file cleanup signals.
- [x] Step 1: add failing health and contract coverage for structured closeout and review behavior.
- [x] Step 2: harden `AGENTS.md` with OPL-style ideal-state, retirement, docs foldback, and closeout discipline.
- [x] Step 3: update closeout generation and workflow review to require Plan Completion Audit and Cleanup Result on new modified closeouts.
- [x] Step 4: verify local health, contract, and full verify lanes.
- [ ] Step 5: complete landing review and archive after branch review.

## Next Cleanup Packages

- Machine cursor compaction: `tests/fixtures/v22/goal-current.json`.
- Verify manifest compaction: `tests/fixtures/v22/agent-verify-manifest.json`.
- Specs/history foldback: `docs/specs/README.md`, `docs/history/README.md`.
- Go handler split: `services/medopl-go-backend/internal/server/handlers/controlplane.go`, `services/medopl-go-backend/internal/server/handlers/portal_projection.go`.
- Workflow gate split: `scripts/v22-workflow-gate.mjs`.
