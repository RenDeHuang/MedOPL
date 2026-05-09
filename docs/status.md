# v22 Status

本文件是 v22 当前唯一活状态入口。长期纪律写在 `AGENTS.md` 和 `docs/invariants.md`，边界 truth 写在 `docs/contracts/README.md` 和具体 contracts，当前 program/phase/lane/离场条件写在 cloud onboarding execution board，逐阶段下一棒写在 status table。

active program: v22-cloud-onboarding

current phase: CO-04 check-config

next phase: CO-05 default gate

CO-06 requires explicit user authorization

## Current Program

- active program: v22-cloud-onboarding
- current phase: CO-04 check-config
- next phase: CO-05 default gate
- user authorization gate: CO-06 requires explicit user authorization before any official SDK readonly live run
- execution board: `docs/recovery/cloud-onboarding-execution-board.md`
- status table: `docs/recovery/cloud-onboarding-status-table.md`
- verification matrix: `docs/recovery/cloud-onboarding-verification-matrix.md`
- workflow contract: `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- contract index: `docs/contracts/README.md`
- MVP suite: `scripts/smoke-test-v22-mvp-contract-suite.mjs`
- local workflow gate: `scripts/v22-workflow-gate.mjs`
- local packet generator: `scripts/v22-agent-workflow.mjs`

## Current Truth

- AGENTS governs collaboration discipline, allowed surfaces, and authorization red lines.
- contracts govern product and interface boundaries.
- execution board governs the current program, phase, lane, exit criteria, and blocker routing.
- status table governs per-phase status and next owner.
- MVP suite is the local smoke bundle for contract-level regression checks.

真实云 live/create/release/deploy 都必须用户显式授权。Until that authorization exists, v22 cloud onboarding can only prepare docs, contracts, smoke, local gates, fake wrappers, reports outside git, and next task packets.

## Current Non-Goals

- No secret read.
- No real cloud call.
- No create/release mutation.
- No deploy, build, push, kubectl, or live-test.
- No upstream, Gateway, Runtime Bridge, deploy, `.sentrux`, `adapters`, or business-code change in this governance-surface branch.
