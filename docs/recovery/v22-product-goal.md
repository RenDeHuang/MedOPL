# MedOPL v22 Product Goal Harness

## Branch Declaration

- branch: `cleanup/v22-product-goal-harness`
- model: gpt-5.4
- intent: 建立 Codex 可持续执行的 product-goal harness，把当前 legacy-mixed repo 收敛为 MedOPL v22 production-ready SaaS workbench。
- this is not: cleanup 路线图、业务代码实现、依赖升级、真实云授权、deploy 授权或 upstream 修改。
- validation:
  - `node scripts/smoke-test-v22-product-goal-harness.mjs`
  - `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
  - `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
  - `node scripts/smoke-test-v22-mvp-contract-suite.mjs`
  - `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
  - `git diff --check -- docs/recovery scripts`

## Product Goal

MedOPL v22 is a `platform-provisioned / customer-dedicated` OPL SaaS workbench based on One Person Lab. The user-facing product is an `开箱即用 SaaS 托管科研工作台`, `不是云资源控制台`, and `不是用户自配云资源`.

The production-ready target is a single product loop:

- platform creates a user.
- platform credits the user account.
- the user logs in to `portal.medopl.cn` and `opl.medopl.cn`.
- `portal.medopl.cn 登录不需要 gflabtoken API Key`.
- `opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key`; `API Key 输入框放在 OPL 登录页密码下面`; the grey release explanation comes from gflabtoken.
- the user opens a 托管 OPL 科研工作台 from Portal, selecting compute plan and file space.
- the user sees 托管工作台、workspace, file space, balance, preauth, and frozen amount without CVM/COS/K8s/cloud-console user language.
- backend/admin/ops may use CVM/COS/runtime/resourceBinding/billingAccount/auditTag as implementation facts only.
- billing is reconciled within the billing day; release stop-billing confirmation completes within 120 minutes; audit is T+1.
- OPL Web remains clean upstream at `https://github.com/gaofeng21cn/one-person-lab`; no upstream source modification and no import of upstream internals.
- the user can send messages, upload files, run tasks from files, and download outputs in `opl.medopl.cn`.
- Portal shows workspace files, related billing, and session conversation trace.
- release stops charging and leaves audit evidence.

## Codex Goal State Machine

Codex goal 不是自然语言愿望，而是 repo 内的 goal-state state machine。

Codex 每轮必须读取 docs/recovery/v22-goal-state.md and select the current `highest-priority executable leaf step`. A leaf step is executable only when:

- its dependencies are absorbed into `recovery/platform-v22-trunk`;
- its gap has an eval;
- its allowed files do not conflict with another active lane;
- its forbidden files and authorization boundary are respected;
- the step can be completed by A and reviewed by B without claiming global completion.

B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。

Autonomous run policy and Loop budget / escalation policy are part of this state machine. Codex may continue across leaf steps only when each step independently closes contract, eval/gate, implementation, verification, failure analysis, truth writeback, commit, and B absorb/push or B blocker report. max_attempts_per_leaf_step = 3 and max_changed_files_without_B_review = 12. If B absorb conditions are not met, or if a leaf step is blocked/deferred_authorized, the goal-state cursor does not advance.

## goal tree -> execution line

The product终局 is decomposed as a goal tree:

1. product e2e contract.
2. gap matrix.
3. leaf steps.
4. dependency ordering.
5. `docs/recovery/v22-goal-state.md` cursor.

The execution line is not a brainstorm list. It is the ordered subset of leaf steps whose dependencies, evals, and authorization state make them executable now. New leaf steps must be appended by updating the gap matrix and goal-state cursor, not by relying on chat memory.

## contract-driven and eval-driven

- contract-driven: every slice starts with a light contract card and subscribed contracts.
- eval-driven: every gap has an eval; every leaf step has `eval_command` or characterization gate before implementation.
- cleanup work: cleanup 必须先 tombstone/archive/gate，再删除 active dependency。
- refactor work: refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。
- development work: development 必须先 contract/eval，再最小实现。
- 禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。

## Hard Rules

- Codex goal 不是自然语言愿望，而是 repo 内的 goal-state state machine。
- Codex 每轮必须读取 docs/recovery/v22-goal-state.md，选择当前 highest-priority executable leaf step。
- 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。
- 每个 leaf step 必须有 eval_command 或 characterization gate。
- B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。
- canary 事实不能自动变 production truth，必须回写合同/status，并等待 productionized 分支吸收。
- refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。
- cleanup 必须先 tombstone/archive/gate，再删除 active dependency。
- development 必须先 contract/eval，再最小实现。
- 禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。

## A/B/C Window Responsibilities

- A：执行 8-step goal loop，写 gate/eval，做最小实现，提交。
- B：审计 diff、复跑验证、执行 changed-files / added-lines diff-scoped secret scan，无 blocker 时 ff-only absorb 并 push。
- C：只做只读审计或明确不冲突的小片段；合并前必须 rebase 最新 trunk 并交 B。

## Authorization Boundary

This harness records targets and gates only:

- 不改 services/*
- 不改 deploy/adapters/.sentrux/.env.demo.template
- 不跑 live-test
- 不读 secret
- 不 build/push/kubectl
- 不改 upstream one-person-lab
- 不升级依赖

Forbidden without explicit authorization: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, `.runtime`, secret, kubeconfig, build/push/kubectl/live-test, real cloud, and one-person-lab upstream modification.

Cloud lane 授权边界: mock -> readonly -> dry-run -> authorized create/release; any true cloud, secret, mutation, build/push, kubectl, deploy, or live-test action requires a separate explicit authorization.

OPL Web must keep clean upstream one-person-lab. Portal/Gateway/Runtime/Cloud code must not be written into upstream, and MedOPL must not import upstream internal modules.
