# v22 Status

本文件是 v22 当前唯一活状态入口。长期纪律写在 `AGENTS.md` 和 `docs/invariants.md`，边界 truth 写在 `docs/contracts/README.md` 和具体 contracts，当前 program/phase/lane/离场条件写在 cloud onboarding execution board，逐阶段下一棒写在 status table。

active program: v22-contract-cleanup-and-drift-control

current phase: 先清合同-smoke-实现漂移，不接云

next phase: B 审核后再决定是否进入 future-authorized cloud lane

所有真实云动作均需 future-authorized 显式授权

## Current Program

- active program: v22-contract-cleanup-and-drift-control
- current phase: 先清合同-smoke-实现漂移，不接云
- next phase: B 审核后再决定是否进入 future-authorized cloud lane
- user authorization gate: 未进入 future-authorized 边界前，禁止任何 real cloud call
- total program board: `docs/recovery/v22-program-board.md`
- total program status table: `docs/recovery/v22-program-status-table.md`
- execution board: `docs/recovery/cloud-onboarding-execution-board.md`
- status table: `docs/recovery/cloud-onboarding-status-table.md`
- verification matrix: `docs/recovery/cloud-onboarding-verification-matrix.md`
- workflow contract: `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`（当前只作为 future-authorized lane 规则，不是本阶段执行入口）
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

当前阶段是合同清退与本地 smoke 对齐阶段。真实云 live/create/release/deploy 都必须用户显式授权；在授权前只能进行 docs/contracts/recovery/status 与本地 smoke/门禁收敛。

## Current Non-Goals

- No secret read.
- No real cloud call.
- No create/release mutation.
- No deploy, build, push, kubectl, or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, build/push/kubectl/live-test, secret read, or real cloud operation in this cleanup branch.
- Active code physical retirement is limited to `services/portal`, `services/opl-web-gateway`, and `services/opl-runtime-bridge`, and only for contract-smoke-implementation drift cleanup.
