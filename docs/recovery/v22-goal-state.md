# MedOPL v22 Goal State

This file is the product-goal cursor. Codex goal 不是自然语言愿望，而是 repo 内的 goal-state state machine。Codex 每轮必须读取 docs/recovery/v22-goal-state.md，选择当前 highest-priority executable leaf step。

## Current Trunk

- 当前 trunk HEAD: `c5c1e8d49e08e335f839ca7ae0c0d0f4fe44350f`
- branch baseline: `origin/recovery/platform-v22-trunk`
- current branch: `cleanup/v22-resource-order-store-postgres-schema-eval-shell`
- model: gpt-5.4

## Current Goal Cursor

- 当前 goal cursor: `leaf-resource-order-store-postgres-schema-implementation`
- highest-priority executable leaf step: `leaf-resource-order-store-postgres-schema-implementation`
- 当前下一问题：resource-order store/Postgres/schema 第四刀实现

B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。B 吸收后 cursor 才能前进。

## Autonomous Run State

- Autonomous run policy: active.
- Codex may run multiple leaf steps only when each leaf step independently completes light contract card, eval/gate, implementation, verification, failure analysis, truth writeback, commit, and B absorb/push 或 B blocker report.
- Each finished leaf step must write commit SHA, changed files, verification output summary, truth writeback files, and next cursor.
- If any gate fails, Codex must stop before the next leaf step and execute failure_analysis_rule.
- If B absorb criteria are not satisfied, Codex must not advance the goal-state cursor.
- After each push, fetch/rebase latest `origin/recovery/platform-v22-trunk` before continuing.
- Do not combine unrelated leaf steps into one large commit.
- Do not continue to the next phase without updating this goal-state file.
- For secret/live/cloud/kubectl/build/push/deploy actions, the leaf step must record auth record, scope, budget, baseline, rollback, cleanup, and evidence path before execution.
- Actor split: A 只能提交 leaf step；B 或被明确授权的 auto-B lane 才能 ff-only absorb/push trunk。A 不得伪装 B 吸收。

## Authorization State

- Authorization model: active.
- Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps。
- Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- risky leaf step must have a step-local auth record with step_id, authorized_operation_type, secret_scope, cloud_scope, region, resource_scope, budget_limit, baseline_requirement, rollback_plan, cleanup_plan, evidence_path, and stop_conditions.
- auth record 默认写入 .runtime，不进入 git。
- docs/recovery 只写脱敏摘要和 truth writeback，不写 raw secret、kubeconfig、token、SecretId/SecretKey、raw cloud response。
- 没有 auth record 的 risky leaf step 必须停在 deferred_authorized。
- default/local cleanup/refactor/dev steps 不得读取 secret、不调真实云、不 build/push/kubectl。

## Cloud Live State

- Cloud live baseline / cleanup / minimum spend policy: active.
- 云上 live step 前必须记录 baseline。
- TKE/node pool desired/current baseline 应为 2，且测试后必须回到 2。
- baseline must separate 平台共享 baseline，不得删除或 scale to 0, from 本 step 创建的测试资源，必须 cleanup/release.
- 开通/创建类 cloud step 必须有 cleanup-first 或 cleanup-after 计划。
- release/delete 类 cloud step 必须证明只释放本 step 或本用户绑定的资源，不能删除共享节点池、别人的节点、别人的存储或平台服务资源。
- cleanup evidence must record created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- 若 cleanup 不能完成，goal-state 不得前进，必须进入 blocked 或 reconciling。
- minimum spend policy requires budget_limit, stop_conditions, max_runtime, and cleanup deadline; 不得自动扩容或长时间保留测试资源。
- 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。

## Failure Truth Writeback State

- Failure truth writeback: active.
- 成功和失败都必须回写真相。
- failure writeback fields: failed_step_id, failed_gate, attempt_count, failure_category, evidence_path, suspected_root_cause, whether_contract_wrong, whether_eval_wrong, whether_problem_should_split, whether_authorization_required, next_recommended_action.
- failure_category allows contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, baseline_not_restored, cleanup_incomplete, and budget_or_stop_condition_hit.
- 失败后不得继续下一个 leaf step，除非 B 明确吸收 blocked truth writeback。
- B blocker report 也必须写入 goal-state 或 gap matrix 的 truth writeback section。

## Loop Budget State

- Loop budget / escalation policy: active.
- max_attempts_per_leaf_step = 10
- max_attempts_per_root_cause = 10
- max_consecutive_same_gate_failure = 2
- max_changed_files_without_B_review = 12
- gate_failure_budget: same gate may fail at most 2 consecutive times before failure analysis.
- 同一个 gate 连续失败 2 次后，必须进入 failure analysis；分析后可以继续 attempt，但必须记录 root cause 和策略变化。
- 每个 leaf step 最多允许 10 次 implementation attempt。
- 同一个 root cause 最多允许 10 次 failed attempt。
- 第 10 次 leaf step attempt 失败后，才必须 blocked truth writeback。
- 同一个 root cause 达到 10 次失败后，也必须 blocked truth writeback。
- blocked, reconciling, and deferred_authorized are valid cursor-hold states.
- attempt failure 只统计以下 blocker: test/gate exit non-zero, B absorb blocker, contract/eval mismatch, scope drift, forbidden action needed without auth record, baseline_not_restored, cleanup_incomplete, budget_or_stop_condition_hit.
- 以下不算 attempt failure，除非它们导致验证命令失败或 tracked diff 污染: warning, formatting suggestion, one-time local dependency install, ignored node_modules / .runtime output, transient command retry with no tracked change.
- failure analysis 必须记录: failed gate, attempt number, root cause id, whether this is same gate failure, whether this is same root cause failure, changed strategy, whether split is needed.
- If the same leaf step fails for the tenth time, mark it blocked and stop patching until B absorbs blocked truth writeback.
- blocked writeback must include failed gate, attempts summary, suspected root cause, whether problem should be split, whether contract/eval is wrong, whether external authorization/canary is required, and proposed next smaller leaf steps.
- If failure is eval_wrong or contract_wrong, repair contract/eval first.
- If failure is problem_too_large, split into smaller leaf steps and update gap matrix/execution line.
- If failure is environment_missing or authorization_required, stop at deferred_authorized and do not force a mock/fallback pass.
- If failure is architecture_blocker, open a refactor leaf step and do not do broad refactor inside the current feature step.
- If failure is baseline_not_restored, cleanup_incomplete, or budget_or_stop_condition_hit, stop cursor advancement and write failure truth before any next leaf step.
- blocked leaf step 不允许推进 goal-state cursor，除非 B 明确吸收 blocked truth writeback。

## Completed Facts

- 已完成事实：default entry、user_owned、resource-order 前三刀
- default entry legacy narrative is cleaned.
- user_owned primary path is retired to legacy alias/tombstone.
- resource-order first three slices are complete: route tombstones, billing/payload rewrite, store/admin/frontend surface cleanup.
- leaf-resource-order-store-postgres-schema-eval-shell completed on branch `cleanup/v22-resource-order-store-postgres-schema-eval-shell`: `node scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs` now statically characterizes the remaining store/Postgres/schema/runtime connection legacy facts without touching `services/*`, without connecting to Postgres, and without running live/cloud/build/kubectl. The gate records current legacy tables/collections (`resource_orders`, `resource_order_events`, `ledger_entries.order_id`, `resourceOrders`, `resourceOrderEvents`) and confirms replacement truth (`resource_binding_id`, `workspace_resource_bindings`) is present before fourth-slice implementation.

## Later Problems

- secret hygiene
- legacy scripts archive
- Portal architecture refactor
- OPL connection
- Cloud lane
- frontend/backend product completion
- release readiness
- dependency modernization future gap: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness only; no dependency upgrade in this branch.

## 当前 execution line 的前 5 个 leaf steps

### Leaf Step 1

- step_id: leaf-resource-order-store-postgres-schema-eval-shell
- problem: resource-order store/Postgres/schema fourth slice lacks a dedicated characterization gate.
- input_state: resource-order route, billing/payload, and store/admin/frontend first three slices are absorbed; store/Postgres/schema remains a future cleanup surface.
- expected_output: write an eval shell that characterizes store/Postgres/schema resource-order persistence before any implementation.
- light_contract_card:
  - problem: resource-order persistence must not remain v22 primary truth.
  - subscribed_contracts: `docs/contracts/v22-mvp-managed-opl-loop.md`, `docs/contracts/v22-resource-plan-boundary.md`, `docs/contracts/v22-tenant-resource-binding-boundary.md`, `docs/recovery/status-matrix.md`
  - in_scope: eval shell and recovery writeback for store/Postgres/schema gap.
  - out_of_scope: service implementation, DB migration, deploy, cloud, upstream.
  - data_or_field_truth: v22 attribution fields are `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`; old id may only be `legacyResourceOrderId` optional migration alias.
  - auth_boundary: no secret, no live-test, no build/push/kubectl, no true DB/cloud operation.
  - pollution_risks: resource-order primary path, fallback/shim compatibility, hidden migration success path.
  - verification_commands: `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
  - B_absorb_criteria: B verifies the characterization gate fails closed before implementation and replacement truth remains green.
- eval_command: characterization gate to be created; current guard is `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: local stdout JSON only; no `.runtime` evidence unless future canary is explicitly authorized.
- allowed_files: `docs/recovery/*`, future `scripts/smoke-test-v22-*`, then scoped state/schema files only in a later branch.
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, unrelated frontend/backend.
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`
- B_absorb_criteria: B reruns evals, checks diff-scoped secret scan, ff-only absorbs and pushes before cursor moves.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

### Leaf Step 2

- step_id: leaf-resource-order-store-postgres-schema-implementation
- problem: resource-order store/Postgres/schema remains as active persistence truth after characterization.
- input_state: `leaf-resource-order-store-postgres-schema-eval-shell` is absorbed; characterization gate covers store, schema, Postgres persistence, snapshot writer, runtime connection, db delegate, runtime store, and JSON migration collection facts.
- expected_output: retire active resource-order store/Postgres/schema primary-path dependency so resource-order remains only retired/tombstone/migration-only semantics.
- light_contract_card:
  - problem: resource-order persistence must stop being active v22 runtime truth.
  - subscribed_contracts: `docs/contracts/v22-mvp-managed-opl-loop.md`, `docs/contracts/v22-resource-plan-boundary.md`, `docs/contracts/v22-tenant-resource-binding-boundary.md`, `docs/recovery/status-matrix.md`
  - in_scope: scoped state/schema/runtime connection cleanup and matching gates.
  - out_of_scope: real DB migration execution, deploy, cloud, upstream, fallback/shim/adapter compatibility.
  - data_or_field_truth: active fields are `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`; retained old identifier can only be `legacyResourceOrderId` optional migration-only alias.
  - auth_boundary: no secret, no live-test, no build/push/kubectl, no true DB/cloud operation.
  - pollution_risks: restoring resource-order success route, required `resourceOrderId`, fallback/shim compatibility layer, hidden migration success path.
  - verification_commands: `node scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs`, `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`, `npm --prefix services/portal run check`
  - B_absorb_criteria: B verifies characterization gate is intentionally updated for fourth-slice implementation, route success path stays tombstoned, services check passes, and no real DB/cloud operation ran.
- eval_command: `node scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs` and `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: local stdout JSON only; no `.runtime` evidence unless future canary is explicitly authorized.
- allowed_files: `services/portal/src/state/portal-resource-order-store.mjs`, `services/portal/src/state/portal-store-schema.mjs`, `services/portal/src/state/portal-store-postgres-persistence.mjs`, `services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs`, `services/portal/src/state/portal-store-runtime-connections.mjs`, `services/portal/src/app/portal-store-runtime.mjs`, `services/portal/src/state/portal-store-db-delegates.mjs`, `scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs`, `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`, `docs/recovery/*`
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, package/dependency files, unrelated frontend/backend.
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- B_absorb_criteria: B reruns evals, checks diff-scoped secret scan, confirms no real DB/cloud operation, then ff-only absorbs and pushes before cursor moves.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

### Leaf Step 3

- step_id: leaf-secret-hygiene-diff-scan-eval-shell
- problem: secret hygiene must be enforced by changed-files / added-lines diff-scoped secret scan.
- input_state: workflow gate has broad secret-like path checks.
- expected_output: eval shell requires B diff-scoped scan and treats full-repo scan as read-only audit.
- light_contract_card:
  - problem: prevent raw secrets in diff, browser state, logs, evidence, or git.
  - subscribed_contracts: `docs/contracts/v22-token-provider-boundary.md`, `docs/recovery/status-matrix.md`
  - in_scope: local eval shell and docs.
  - out_of_scope: reading secret files or `.env`.
  - data_or_field_truth: raw provider key, bearer token, launchToken, runtimeToken, SecretId/SecretKey, kubeconfig, private key never enter git.
  - auth_boundary: 不读 secret.
  - pollution_risks: secret-like path bypass, full-repo scan used as false pass.
  - verification_commands: `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
  - B_absorb_criteria: B confirms changed-files / added-lines diff-scoped secret scan.
- eval_command: future `node scripts/smoke-test-v22-diff-scoped-secret-hygiene.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: no secret values; only pass/fail and changed path summaries.
- allowed_files: `scripts/smoke-test-v22-*`, `docs/recovery/*`
- forbidden_files: `.env*`, secret files, kubeconfig, `deploy/*`, `adapters/*`, `.sentrux/*`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/status-matrix.md`
- B_absorb_criteria: B reruns gate and confirms no secret content was read.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

### Leaf Step 4

- step_id: leaf-legacy-scripts-archive-eval-shell
- problem: legacy scripts can re-enter default validation.
- input_state: v19/v20/v21/live-test scripts are archive/reference only.
- expected_output: eval shell proves default suite and docs do not route through legacy scripts.
- light_contract_card:
  - problem: keep default validation v22-only.
  - subscribed_contracts: `docs/recovery/status-matrix.md`, `docs/recovery/mvp-contract-acceptance.md`
  - in_scope: docs and smoke gate.
  - out_of_scope: deleting scripts or running live-test.
  - data_or_field_truth: old scripts are archive/reference, not default proof.
  - auth_boundary: no live-test.
  - pollution_risks: old v19/v20/v21 truth, live-test as default.
  - verification_commands: `node scripts/smoke-test-v22-mvp-contract-suite.mjs`
  - B_absorb_criteria: B confirms no live-test ran.
- eval_command: future `node scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: local stdout only.
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `scripts/live-test-*` execution, `deploy/*`, `adapters/*`, `.sentrux/*`
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B reruns MVP suite and archive gate.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

### Leaf Step 5

- step_id: leaf-portal-layering-characterization-gate
- problem: future Portal refactor needs route/app/domain/state/frontend characterization.
- input_state: Portal structure/failure isolation contract exists.
- expected_output: characterization gate proves behavior before moving or splitting code.
- light_contract_card:
  - problem: prevent refactor drift.
  - subscribed_contracts: `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`, `docs/contracts/v22-portal-user-surface-boundary.md`
  - in_scope: characterization gate and scoped refactor plan.
  - out_of_scope: OPL Gateway, Runtime Bridge, deploy, true cloud.
  - data_or_field_truth: backend route -> app payload -> domain -> state/persistence; frontend API module -> composable/view.
  - auth_boundary: local smoke only.
  - pollution_risks: fallback/shim, route logic in payload builders, UI cloud-console language.
  - verification_commands: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
  - B_absorb_criteria: B confirms contract parity.
- eval_command: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: local smoke output, no live data.
- allowed_files: future dedicated refactor branch.
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab.
- truth_writeback_target: `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B reruns characterization gate and type checks.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

### Leaf Step 6

- step_id: leaf-opl-connection-productionization-contract-refresh
- problem: OPL connection has canary facts that must not be treated as production truth.
- input_state: local Runtime Agent HTTP API relay canary exists; real production file/run/artifact is not claimed.
- expected_output: refresh contracts/status before any productionized OPL connection branch.
- light_contract_card:
  - problem: separate canary evidence from production truth.
  - subscribed_contracts: `docs/contracts/v22-portal-opl-connection-boundary.md`, `docs/contracts/v22-upstream-opl-boundary.md`, `docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md`
  - in_scope: contract/status refresh and local gate.
  - out_of_scope: modifying upstream, true provider secret, true cloud runtime, deploy.
  - data_or_field_truth: OPL lane provides fileRef/run/artifact projection and resourceBindingId/workspace runtime identity; deploy ownership stays Package D.
  - auth_boundary: no raw provider key, no live canary unless separately authorized.
  - pollution_risks: fake 200, upstream internal import, direct path as user entry.
  - verification_commands: `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`
  - B_absorb_criteria: B confirms no production truth claim from canary alone.
- eval_command: `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`
- failure_analysis_rule: classify as contract_wrong, eval_wrong, implementation_wrong, environment_missing, authorization_required, upstream_or_cloud_fact_unknown, problem_too_large, or architecture_blocker.
- trace_or_evidence_expectation: sanitized `.runtime` evidence only for separately authorized canary; otherwise local stdout.
- allowed_files: `docs/recovery/*`, `docs/contracts/v22-*`, `scripts/smoke-test-v22-*` in future branch.
- forbidden_files: upstream one-person-lab, `deploy/*`, `.env*`, raw secret paths.
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms clean upstream one-person-lab and no fake success.
- attempt_budget: max_attempts_per_leaf_step = 10; max_attempts_per_root_cause = 10; max_consecutive_same_gate_failure = 2; same gate may fail 2 times before failure analysis; tenth leaf step or root-cause failure becomes blocked truth writeback.

## 禁止并行写入的区域

- `services/portal/src/state/portal-resource-order-store.mjs` with `services/portal/src/state/portal-store-schema.mjs`
- Portal route/app/domain/state refactor overlapping the same route or payload module
- OPL Gateway/Runtime Bridge connection files
- Cloud lane authorized create/release and deploy lanes
- `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`

## 允许只读审计的区域

- `docs/contracts/README.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `scripts/smoke-test-v22-*`
- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- archive/reference docs and legacy scripts as read-only evidence only

## Cursor Advancement Rule

B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。 The next cursor update must name the absorbed commit and update this file in a follow-up branch or B-reviewed absorb commit.
