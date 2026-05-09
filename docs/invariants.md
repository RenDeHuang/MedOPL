# v22 Invariants

This file records long-term v22 invariants. AGENTS defines collaboration discipline, contracts define product and interface boundaries, cloud onboarding execution board tracks current program/phase/lane/exit criteria, status table tracks per-phase state and next owner, and MVP suite guards the local contract regression bundle.

References:

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `scripts/smoke-test-v22-mvp-contract-suite.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-agent-workflow.mjs`

## Long-Term Red Lines

- 不读 secret，除非用户显式授权。
- 不调用真实云，除非用户显式授权。
- readonly inventory 与 create/release mutation 分离。
- A/C/D 独立 worktree，B 主工作区审查合并。
- B 审查、workflow gate、checkpoint 不能绕过。
- 普通用户不暴露 CVM/TKE/COS/K8s/云控制台语义。
- 文件空间和计算资源生命周期分离。
- 不恢复 user_owned/resource-order/旧云控制台叙事。
- 不自动 merge/push/build/push/kubectl。

## Product Boundary Invariants

- MedOPL v22 is a platform-provisioned / customer-dedicated managed OPL SaaS research workspace, not a cloud console.
- Ordinary users see workbench resources, plans, file space, estimated cost, release policy, and audit status; they do not manage cloud primitives directly.
- Portal canonical user surfaces must consume sanitized projections, not raw provider responses.
- Raw provider credentials, runtime launch credentials, internal storage keys, local paths, and signed URLs stay outside Portal public payloads, logs, evidence, and git.
- File-space deletion/protection and compute-resource release are separate lifecycles.

## Workflow Invariants

- Real external side effects are serial: real cloud live, create/release, deploy/build/push/kubectl, dependency installation, merge/push.
- Any live operation must stop for user authorization in the current task context.
- Check-config and default gate precede any official SDK readonly live run.
- TC3 remains diagnostic/reference until official SDK live report exists and B accepts cleanup readiness.
- create/release uses separate contracts, separate RUN gate, and separate mutation authorization from readonly inventory.

## Discovery/Canary Invariants

- 边界先行 -> 探索/canary -> 修正边界 -> 正式实现 -> B 吸收。
- 未知外部系统接入先走 Discovery/Canary lane。
- canary 必须有用户授权边界。
- canary 输出只进 .runtime，不进 git。
- canary 可以验证真实 SDK/云/服务，但不得自动变成 production dependency。
- canary 发现的事实必须回写 contracts/status/decisions。
- production implementation 必须基于已验证事实。
- B 只吸收 productionized 分支，不吸收未清理 canary 临时代码。
- Portal、Cloud、OPL sync 三条 program 都适用。
