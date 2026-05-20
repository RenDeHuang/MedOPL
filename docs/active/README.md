# Active Truth

Owner: `MedOPL`
Purpose: `current_state_vs_ideal_gap`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读 gap map。机器 cursor、last absorbed commit、branch override、verification bundle 仍以 `docs/recovery/v22-goal-current.json` 和 `docs/recovery/v22-agent-verify-manifest.json` 为准。

## Ideal State

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。用户购买套餐、计算能力、存储容量和运行环境；平台负责开通、隔离、计费、审计和释放。MedOPL 不是云资源控制台，不是用户自配 CVM/COS/K8s。

## Current State

当前已收敛的事实：

- Portal、OPL Web Gateway、Runtime Bridge / Runtime Agent 是 v22 active product chain。
- `scripts/v22-verify.mjs current/suite ...` 是默认 agent-facing verification 入口。
- `scripts/smoke-test-v22-*` 当前是 repo-local eval 文件族，不全是 smoke。
- `docs/recovery/agent-runs/*` 是 evidence，不是 product truth。

当前未闭合的事实：

- 文档仍处于 `docs/contracts/**`、`docs/recovery/**` 与目标 taxonomy 并存状态。
- 测试仍主要在 `scripts/smoke-test-v22-*` 下，尚未迁入 `tests/**`。
- `docs/recovery/v22-goal-current.json` 当前 cursor 仍指向 `leaf-portal-postgres-redis-local-production-data-closure`，本分支不实现该 leaf。

## Gap Matrix

| Area | Ideal | Current Evidence | Gap | Next Action | Done When | Verify |
| --- | --- | --- | --- | --- | --- | --- |
| Docs taxonomy | 生命周期分层，一目录一 README truth | `docs/contracts/**` 与 `docs/recovery/**` 仍为活引用 | truth / evidence / reference 混合 | `cleanup/v22-docs-taxonomy-skeleton` | 新 taxonomy README 和清退规则建立 | `node scripts/smoke-test-v22-docs-taxonomy-skeleton.mjs` |
| Tests taxonomy | `tests/**` 独立承载 health/smoke/contract/regression/future-authorized | 152 个 `scripts/smoke-test-v22-*` 已分类 | smoke/eval 命名污染仍在文件名 | `cleanup/v22-tests-taxonomy` | `scripts/` 只留 runner/classifier/workflow | smoke classification + verify |
| Contracts compaction | human truth 吸收到 `docs/specs/README.md` 等目录 README | 42 个 `docs/contracts/v22-*` 仍被 gate 引用 | README 与 leaf contract 混合 | `cleanup/v22-contracts-into-specs` | 旧合同引用迁移且 leaf boundary 保留策略明确 | local-contract suite |
| Recovery retirement | recovery 不再是长期 docs taxonomy | recovery 根层仍有 truth/index/board/agent-run | 过程记录和当前状态混放 | `cleanup/v22-recovery-absorb-and-delete` | current truth / history / references 全部有替代入口 | local-contract suite |

## Cannot Claim

- 不能写成 152 个 `scripts/smoke-test-v22-*` 都是 smoke。
- 不能写成 `docs/recovery/agent-runs/*` 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl 或 live-test 已授权。
- 不能写成本 skeleton 已完成物理清退。

## Source Of Truth During Migration

- 当前状态基线：`docs/status.md`、`docs/recovery/status-matrix.md`、`docs/recovery/mvp-contract-acceptance.md`
- 机器 cursor：`docs/recovery/v22-goal-current.json`
- 验证 manifest：`docs/recovery/v22-agent-verify-manifest.json`
- smoke/eval 边界：`docs/contracts/v22-smoke-eval-boundary.md`

