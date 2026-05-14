# v22 Codex Goal Loop

This document keeps the repeatable runner rules only. Current state, dependency graph, cursor, gap ordering, and scoreboard truth live in JSON:

- current state: `docs/recovery/v22-goal-current.json`
- scoreboard: `docs/recovery/v22-product-completion-scoreboard.json`
- schema: `docs/recovery/v22-goal-leaf-manifest.schema.json`

## 8-step goal loop

- Step 1：问题
- Step 2：写轻合同卡
- Step 3：定义验证
- Step 4：先补验证壳
- Step 5：做最小实现
- Step 6：跑结果
- Step 7：分析失败
- Step 8：回写真相

## Loop Rules

- Codex goal 不是自然语言愿望，而是 repo 内的 goal-state state machine。
- Codex 每轮必须读取 `docs/recovery/v22-goal-current.json`，并用 `node scripts/smoke-test-v22-goal-state-consistency.mjs` 校验 JSON/Markdown/gap/scoreboard 一致。
- 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。
- 每个 leaf step 必须有 eval_command 或 characterization gate。
- B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。
- canary 事实不能自动变 production truth，必须回写合同/status，并等待 productionized 分支吸收。
- refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。
- cleanup 必须先 tombstone/archive/gate，再删除 active dependency。
- development 必须先 contract/eval，再最小实现。
- 禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。

## Autonomous run policy

Codex may continue through multiple leaf steps inside this goal harness only when each leaf step is independently closed before the next one starts. 允许 Codex 在本 goal harness 内连续推进多个 leaf step，但每个 leaf step 必须独立完成。

Each leaf step must independently complete:

- light contract card
- eval/gate
- implementation
- verification
- failure analysis
- truth writeback
- commit
- B absorb/push 或 B blocker report

Each completed leaf step must produce. 每个 leaf step 完成后必须产生：

- commit SHA
- changed files
- verification output summary
- truth writeback files
- next cursor

If any gate fails, Codex must not continue to the next leaf step. It must run failure_analysis_rule first. 如果任一 gate 失败，Codex 不得继续下一个 leaf step，必须先执行 failure_analysis_rule。

If B absorb criteria are not satisfied, Codex must not advance the goal-state cursor. 如果 B absorb 条件不满足，Codex 不得推进 goal-state cursor。

After each push, Codex must fetch/rebase the latest `origin/recovery/platform-v22-trunk` before continuing to the next leaf step. 每个 push 后必须重新 fetch/rebase 最新 origin/recovery/platform-v22-trunk，再继续下一 leaf step。

Codex must not combine unrelated leaf steps into one large commit. 禁止把多个无关 leaf steps 合成一个大提交。

Codex must not continue to the next phase without updating goal-state. 禁止在未更新 goal-state 的情况下继续跑下一阶段。

Actor split is mandatory: A 只能提交 leaf step；B 或被明确授权的 auto-B lane 才能 ff-only absorb/push trunk。A 不得伪装 B 吸收。

## Authorization model

Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps。

Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。

Every risky leaf step must have a step-local auth record before execution. The auth record schema is:

- step_id:
- authorized_operation_type:
- secret_scope:
- cloud_scope:
- region:
- resource_scope:
- budget_limit:
- baseline_requirement:
- rollback_plan:
- cleanup_plan:
- evidence_path:
- stop_conditions:

For any secret/live/cloud/kubectl/build/push/deploy action, even if broad authorization exists, the current leaf step must record auth record, scope, budget, baseline, rollback, cleanup, and evidence path before action. secret/live/cloud/kubectl/build/push/deploy 类动作必须写入当前 step 的 auth record、scope、budget、baseline、rollback、cleanup 和 evidence path。

auth record 默认写入 .runtime，不进入 git。

docs/recovery 只写脱敏摘要和 truth writeback，不写 raw secret、kubeconfig、token、SecretId/SecretKey、raw cloud response。

没有 auth record 的 risky leaf step 必须停在 deferred_authorized。

default/local cleanup/refactor/dev steps 不得读取 secret、不调真实云、不 build/push/kubectl。

## Cloud live baseline / cleanup / minimum spend policy

云上 live step 前必须记录 baseline。

当前 TKE/node pool baseline requirement 必须明确：desired/current baseline 应为 2，且测试后必须回到 2。

baseline 必须区分：

- 平台共享 baseline，不得删除或 scale to 0
- 本 step 创建的测试资源，必须 cleanup/release

开通/创建类 cloud step 必须有 cleanup-first 或 cleanup-after 计划。

release/delete 类 cloud step 必须证明只释放本 step 或本用户绑定的资源，不能删除共享节点池、别人的节点、别人的存储或平台服务资源。

测试结束必须生成 cleanup evidence：

- created resources
- released resources
- remaining resources
- baseline after cleanup
- active operations count
- billing/reconciliation status

若 cleanup 不能完成，goal-state 不得前进，必须进入 blocked 或 reconciling。

费用策略：cloud live step 必须以最低消费为目标，设置 budget_limit、stop_conditions、max_runtime、cleanup deadline；minimum spend is required and must be recorded before live action。

不得自动扩容或长时间保留测试资源。

任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。

## Failure truth writeback

成功和失败都必须回写真相。

failure writeback 必须包含：

- failed_step_id:
- failed_gate:
- attempt_count:
- failure_category:
- evidence_path:
- suspected_root_cause:
- whether_contract_wrong:
- whether_eval_wrong:
- whether_problem_should_split:
- whether_authorization_required:
- next_recommended_action:

failure_category 必须允许：

- contract_wrong
- eval_wrong
- implementation_wrong
- environment_missing
- authorization_required
- upstream_or_cloud_fact_unknown
- problem_too_large
- architecture_blocker
- baseline_not_restored
- cleanup_incomplete
- budget_or_stop_condition_hit

失败后不得继续下一个 leaf step，除非 B 明确吸收 blocked truth writeback。

B blocker report 也必须写入 goal-state 或 gap matrix 的 truth writeback section。

## Loop budget / escalation policy

Suggested thresholds:

- max_attempts_per_leaf_step = 10
- max_attempts_per_root_cause = 10
- max_consecutive_same_gate_failure = 2
- max_changed_files_without_B_review = 12

Budget rules:

- 每个 leaf step 最多允许 10 次 implementation attempt。
- 同一个 root cause 最多允许 10 次 failed attempt。
- 同一个 gate 连续失败 2 次后，必须进入 failure analysis；分析后可以继续 attempt，但必须记录 root cause 和策略变化。
- 第 10 次 leaf step attempt 失败后，才必须 blocked truth writeback。
- 同一个 root cause 达到 10 次失败后，也必须 blocked truth writeback。
- blocked writeback must include: failed gate, attempts summary, suspected root cause, whether problem should be split, whether contract/eval is wrong, whether external authorization/canary is required, and proposed next smaller leaf steps.
- attempt failure 只统计以下 blocker:
  - test/gate exit non-zero
  - B absorb blocker
  - contract/eval mismatch
  - scope drift
  - forbidden action needed without auth record
  - baseline_not_restored
  - cleanup_incomplete
  - budget_or_stop_condition_hit
- 以下不算 attempt failure，除非它们导致验证命令失败或 tracked diff 污染:
  - warning
  - formatting suggestion
  - one-time local dependency install
  - ignored node_modules / .runtime output
  - transient command retry with no tracked change
- failure analysis 必须记录:
  - failed gate
  - attempt number
  - root cause id
  - whether this is same gate failure
  - whether this is same root cause failure
  - changed strategy
  - whether split is needed
- 如果失败原因是 eval_wrong 或 contract_wrong，下一步必须先修 contract/eval，不得继续实现。
- 如果失败原因是 problem_too_large，必须拆成更小 leaf steps，并更新 gap matrix/execution line。
- 如果失败原因是 environment_missing 或 authorization_required，必须停在 deferred_authorized，不得用 mock/fallback 硬过。
- 如果失败原因是 architecture_blocker，必须开 refactor leaf step，不得在当前 feature step 里顺手重构大面。
- blocked leaf step 不允许推进 goal-state cursor，除非 B 明确吸收 blocked truth writeback。
- If changed files exceed max_changed_files_without_B_review = 12, A must stop and request B review before continuing.

## Light Contract Card Schema

Every leaf step starts with a light contract card:

- problem:
- subscribed_contracts:
- in_scope:
- out_of_scope:
- data_or_field_truth:
- auth_boundary:
- pollution_risks:
- verification_commands:
- B_absorb_criteria:

## Leaf Step Schema

Every leaf step must contain:

- step_id:
- problem:
- depends_on:
- executable_when:
- cursor_eligible:
- stage:
- failure_state:
- input_state:
- expected_output:
- light_contract_card:
- eval_command:
- failure_analysis_rule:
- trace_or_evidence_expectation:
- allowed_files:
- forbidden_files:
- truth_writeback_target:
- B_absorb_criteria:
- attempt_budget:

## A/B/C Window Responsibilities

- A：执行 8-step goal loop，写 gate/eval，做最小实现，提交。
- B：审计 diff、复跑验证、执行 changed-files / added-lines diff-scoped secret scan，无 blocker 时 ff-only absorb 并 push。
- C：只做只读审计或明确不冲突的小片段；合并前必须 rebase 最新 trunk 并交 B。

## Boundary Summary

- 不改 services/*
- 不改 deploy/adapters/.sentrux/.env.demo.template
- 不跑 live-test
- 不读 secret
- 不 build/push/kubectl
- 不改 upstream one-person-lab
- 不升级依赖
- deploy/*
- adapters/*
- .sentrux/*
- .env.demo.template
- Cloud lane 授权边界
- clean upstream one-person-lab

## Required Local Validation

- `node scripts/smoke-test-v22-goal-state-consistency.mjs`
- `node scripts/smoke-test-v22-product-goal-harness.mjs`
- `node scripts/smoke-test-v22-product-goal-execution-order.mjs`
- `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
- `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
- `node scripts/smoke-test-v22-mvp-contract-suite.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts`

The product-goal harness gate includes changed-files / added-lines diff-scoped secret scan for this branch. A reusable generic B-window secret hygiene scan remains a future eval leaf.
