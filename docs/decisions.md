# v22 Decisions

This file records currently effective v22 decisions. AGENTS governs discipline, contracts govern boundaries, execution board governs the active cloud onboarding program lane, status table governs per-phase state and next owner, and MVP suite verifies local contract regressions.

References:

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `docs/recovery/cloud-onboarding-verification-matrix.md`
- `scripts/smoke-test-v22-mvp-contract-suite.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-agent-workflow.mjs`

## Current Effective Decisions

- production default provider 使用 Tencent official SDK wrapper.
- TC3 保留为 diagnostic/reference.
- official SDK live report 通过后再 cleanup.
- cloud onboarding 使用 execution board + status table + v22-agent-workflow 生成任务包.
- 真实外部副作用串行.
- create/release 与 readonly 分离.
- create/release 另有独立合同和 RUN gate.

## Decision Notes

- The active program is `v22-cloud-onboarding`; live status is tracked in `docs/status.md`.
- `docs/recovery/cloud-onboarding-execution-board.md` is the current board for program/phase/lane/exit criteria and blocker routing.
- `docs/recovery/cloud-onboarding-status-table.md` is the current table for per-phase status, owner, next action, required smoke, and user gate.
- `scripts/v22-agent-workflow.mjs` may generate task packets, but it must not auto-run live operations, auto-merge, auto-push, read secrets, or call real cloud.
- Production deploy execution requires concrete deploy plan contracts and explicit user authorization before build, push, kubectl, registry access, or rollback.
