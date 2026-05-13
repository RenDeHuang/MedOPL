# MedOPL v22 Current vs Ideal Gap Matrix

Every gap below is part of the product-goal harness, not a free-form roadmap. Each gap must have an eval. 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。

Allowed status values: `open`, `in_progress`, `needs_eval`, `gated`, `cleaned`, `deferred_authorized`.

## Gap Field Schema

Every gap entry must contain:

- id:
- current_fact:
- ideal_state:
- problem:
- dependency:
- status:
- next_leaf_step:
- eval:
- allowed_files:
- forbidden_files:
- truth_writeback_target:
- B_absorb_criteria:

## Gap Entries

### Gap: legacy-cleanup-user-owned

- id: legacy-cleanup-user-owned
- current_fact: default entry and primary path have been retired into platform-provisioned semantics; retained `user_owned` is legacy alias only.
- ideal_state: no new implementation, doc, eval, or product language treats `user_owned` as user-owned cloud resource configuration.
- problem: prevent user-owned meaning from returning through active docs or tests.
- dependency: default-entry cleanup and user_owned primary path retirement absorbed.
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B reruns eval, confirms no `user_owned` primary meaning, then ff-only absorbs and pushes before cursor moves.

### Gap: legacy-cleanup-resource-order

- id: legacy-cleanup-resource-order
- current_fact: resource-order route tombstones, billing/payload rewrite, and store/admin/frontend third slice are complete; store/Postgres/schema remains.
- ideal_state: managed environment/resource binding/billing/audit is the only active resource attribution path.
- problem: remaining store/Postgres/schema surfaces can keep resource-order as persistence truth.
- dependency: route, billing/payload, store/admin/frontend cleanup absorbed.
- status: open
- next_leaf_step: leaf-resource-order-store-postgres-schema-eval-shell
- eval: `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs` plus a future store/Postgres/schema characterization gate
- allowed_files: `services/portal/src/state/portal-resource-order-store.mjs`, `services/portal/src/state/portal-store-schema.mjs`, relevant v22 smoke after a dedicated branch is opened
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, unrelated frontend
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms the characterization gate exists, resource binding replacement path stays green, and no route success path returns.

### Gap: legacy-cleanup-secret-hygiene

- id: legacy-cleanup-secret-hygiene
- current_fact: workflow gate has path-level secret-like checks; default gates scan selected files for secret-like values.
- ideal_state: B always runs changed-files / added-lines diff-scoped secret scan before absorb; full-repo secret scan is read-only audit only.
- problem: secret hygiene can degrade if B relies only on broad scans or path names.
- dependency: product-goal harness absorbed.
- status: needs_eval
- next_leaf_step: write_eval_shell
- eval: required future `scripts/smoke-test-v22-diff-scoped-secret-hygiene.mjs`
- allowed_files: `scripts/smoke-test-v22-*`, `docs/recovery/*`
- forbidden_files: `.env*`, secret files, kubeconfig, `deploy/*`, `adapters/*`, `.sentrux/*`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/status-matrix.md`
- B_absorb_criteria: B confirms changed-files / added-lines diff-scoped secret scan is mandatory and no secret content is read.

### Gap: legacy-cleanup-legacy-scripts

- id: legacy-cleanup-legacy-scripts
- current_fact: v19/v20/v21/live-test scripts remain archive/reference, not default validation.
- ideal_state: default execution line uses only v22 local smoke unless a canary is explicitly authorized.
- problem: old scripts can re-enter AI context as default truth.
- dependency: secret hygiene eval shell can run independently as C read-only audit.
- status: needs_eval
- next_leaf_step: write_eval_shell
- eval: required future `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`
- forbidden_files: `scripts/live-test-*`, `scripts/smoke-test-v19-*`, `scripts/smoke-test-v20*`, `scripts/smoke-test-v21-*` unless archiving is explicitly scoped
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B verifies MVP suite does not include old scripts and no live-test is run.

### Gap: architecture-refactor-portal-layering

- id: architecture-refactor-portal-layering
- current_fact: Portal structure/failure isolation contract exists; active Portal still needs route/app/domain/state/frontend layering discipline on future edits.
- ideal_state: backend route -> app payload -> domain -> state/persistence and frontend view/composable/API module boundaries are enforceable by characterization gates.
- problem: refactors can move behavior without proving contract parity.
- dependency: cleanup of resource-order store/Postgres/schema should land first for related surfaces.
- status: open
- next_leaf_step: leaf-portal-layering-characterization-gate
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: future dedicated refactor branch under `services/portal/**` plus matching v22 smoke
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- B_absorb_criteria: B reruns characterization gate and confirms no product behavior drift.

### Gap: opl-connection-gateway-preflight-runtime-file-run-artifact-trace

- id: opl-connection-gateway-preflight-runtime-file-run-artifact-trace
- current_fact: local contracts prove Gateway/preflight/Runtime Bridge and selected file/run/artifact gates; production connection is not fully live.
- ideal_state: Portal -> Gateway -> clean upstream OPL -> Runtime Agent -> file/run/artifact -> Portal trace works without fake 200.
- problem: canary facts must not become production truth without productionized branch absorption.
- dependency: OPL capability and file/run/artifact contracts.
- status: gated
- next_leaf_step: leaf-opl-productionization-contract-refresh
- eval: `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`
- allowed_files: future OPL connection branch files and v22 OPL smoke
- forbidden_files: upstream one-person-lab, `deploy/*` without authorization, raw provider key paths
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms clean upstream one-person-lab boundary and no fake success path.

### Gap: cloud-lane-mock-readonly-dry-run-authorized

- id: cloud-lane-mock-readonly-dry-run-authorized
- current_fact: Cloud lane contracts define mock -> readonly -> dry-run -> authorized create/release, with real operations separately authorized.
- ideal_state: production cloud lifecycle follows authorized gates, secret allowlists, billing checks, rollback, and audit without exposing cloud console language to users.
- problem: cloud facts and Portal product facts can be mixed if authorization boundaries are not explicit.
- dependency: cloud onboarding workflow boundary.
- status: deferred_authorized
- next_leaf_step: leaf-cloud-lane-readonly-status-audit
- eval: `node scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs`
- allowed_files: cloud-lane contract/docs/smoke in a dedicated authorized branch
- forbidden_files: `deploy/*`, `.env*`, kubeconfig, true cloud runners unless explicitly authorized
- truth_writeback_target: `docs/recovery/cloud-onboarding-status-table.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms no true cloud operation ran without authorization and any risky leaf step has step-local auth record, minimum spend, baseline, cleanup evidence, owner guard, and failure truth writeback.

truth writeback section:

- Authorization model: Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps；Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- No auth record means the risky step remains deferred_authorized.
- Cloud live baseline / cleanup / minimum spend policy requires desired/current baseline 应为 2，且测试后必须回到 2.
- cleanup evidence must prove created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- Owner guard: 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。
- Failure truth writeback must record failed_step_id, failed_gate, attempt_count, failure_category, evidence_path, suspected_root_cause, whether_contract_wrong, whether_eval_wrong, whether_problem_should_split, whether_authorization_required, and next_recommended_action.

### Gap: frontend-product-vue-vite-ts-pinia

- id: frontend-product-vue-vite-ts-pinia
- current_fact: Portal UI MVP exists; future frontend completion must preserve Vue 3 + Vite + TypeScript + Pinia contracts.
- ideal_state: user loop, admin, mobile/table usability, empty/loading/error states, and API contracts are eval-covered.
- problem: visual or API changes can ship without responsive or component-state verification.
- dependency: current Portal UI contracts.
- status: open
- next_leaf_step: leaf-frontend-product-evalset-gap
- eval: `node scripts/smoke-test-v22-portal-frontend-surface-composables.mjs`
- allowed_files: future frontend branch under `services/portal/frontend/**` plus evalset/smoke
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, Portal UI contracts
- B_absorb_criteria: B requires API contract, component states, mobile/table responsive evidence, and typecheck.

### Gap: backend-product-node22-esm-layering

- id: backend-product-node22-esm-layering
- current_fact: backend baseline uses Node 22 ESM and route/app/domain/state/persistence conventions across Portal services.
- ideal_state: every backend change has route smoke, payload/domain contract smoke, node --check or npm check, and workflow gate coverage.
- problem: route logic can bypass app/domain/state layering or hide missing fields behind fallback/shim.
- dependency: Portal structure contract.
- status: open
- next_leaf_step: leaf-backend-contract-eval-template
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: future backend branch under `services/portal/**` plus smoke
- forbidden_files: implicit fallback/shim, `user_owned` primary path, `resource-order` primary path, OpenCost/Langfuse main path
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, backend contracts
- B_absorb_criteria: B confirms route -> app payload -> domain -> state/persistence and no hidden fallback.

### Gap: billing-audit-preauth-ledger-release-t1

- id: billing-audit-preauth-ledger-release-t1
- current_fact: contract-level release stop billing and audit flow exists.
- ideal_state: preauth, ledger, release stop billing within 120 minutes, and T+1 audit are production-ready and traceable.
- problem: billing truth can be confused with trace metadata, Langfuse, or cloud raw facts.
- dependency: managed environment/resource binding and cloud lane facts.
- status: gated
- next_leaf_step: leaf-billing-audit-characterization
- eval: `node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- allowed_files: future billing branch and v22 billing smoke
- forbidden_files: OpenCost primary narrative, Langfuse billing truth, real cloud mutation without authorization
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, billing contracts
- B_absorb_criteria: B confirms release stops charging and audit record exists without treating observability as billing truth.

### Gap: release-readiness-authorized-deploy-only

- id: release-readiness-authorized-deploy-only
- current_fact: deploy/build/push/kubectl/live-test are outside default development and require explicit authorization.
- ideal_state: release readiness is evaluated only after contracts, local suite, secret scan, and authorized deploy plan pass.
- problem: deploy readiness can be falsely inferred from local smoke.
- dependency: product e2e, cloud lane, OPL connection, billing/audit.
- status: deferred_authorized
- next_leaf_step: leaf-release-readiness-auth-boundary
- eval: `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- allowed_files: docs/recovery and future authorized deploy contracts
- forbidden_files: `deploy/*`, build/push/kubectl/live-test without explicit authorization
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, deploy contracts
- B_absorb_criteria: B confirms release readiness does not execute deploy unless authorized.

### Gap: dependency-modernization-node24-vite-vitest-readiness

- id: dependency-modernization-node24-vite-vitest-readiness
- current_fact: current baseline is Node 22 ESM with Vue 3 + Vite + TypeScript + Pinia; this branch does not upgrade dependencies.
- ideal_state: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness are tracked as future eval-backed gaps.
- problem: dependency upgrades can mix with product harness and destabilize unrelated lanes.
- dependency: product-goal harness only records the future gap.
- status: needs_eval
- next_leaf_step: write_eval_shell
- eval: future dependency readiness characterization gate; no upgrade in this branch
- allowed_files: future dedicated modernization contract/eval branch
- forbidden_files: `package.json`, lockfiles, service dependency files in this harness branch
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, future modernization contract
- B_absorb_criteria: B confirms Node 24 / Vite / Vitest modernization 只作为 future gap，不在本分支升级。
