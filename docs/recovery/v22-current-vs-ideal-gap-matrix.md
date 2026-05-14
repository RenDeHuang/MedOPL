# MedOPL v22 Current vs Ideal Gap Matrix

Every gap below is part of the product-goal harness, not a free-form roadmap. Each gap must have an eval. 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。

Machine-readable current state now lives in `docs/recovery/v22-goal-current.json`.
Product Completion Scoreboard now lives in `docs/recovery/v22-product-completion-scoreboard.json`.
This Markdown remains a human-readable gap explanation and history surface; the consistency gate checks JSON/Markdown/gap/scoreboard alignment.
scoreboard 只表达产品能力完成度，不决定 leaf execution order. Execution order is decided by `docs/recovery/v22-goal-current.json` plus this gap matrix's `depends_on` / `executable_when` / `cursor_eligible` fields.

Allowed status values: `open`, `in_progress`, `needs_eval`, `gated`, `cleaned`, `tombstone_only`, `archive_only`, `characterized`, `completed`, `intentionally_retained`, `pending`, `deferred_authorized_current_path`, `deferred_authorized_future_stage`.

## Dependency Stage Order

- S1 legacy cleanup
- S2 architecture refactor
- S3 OPL connection productionization
- S4 Cloud lane productionization
- S5 frontend/backend product completion
- S6 release readiness

Codex must execute the product-goal dependency graph in stage order: cleanup -> refactor -> OPL connection -> Cloud lane -> frontend/backend product completion -> release readiness. A future-stage blocker must not be treated as the current blocker when an earlier cleanup/refactor/dev leaf is still executable.

## Cleanup Stage Completion Gate

Cleanup stage completion gate: Cloud lane 不得跳过未完成 cleanup. Before any Cloud lane leaf may set `cursor_eligible: true`, legacy cleanup prerequisites satisfied before Cloud lane cursor_eligible=true:

- `legacy-cleanup-user-owned` status must be cleaned or intentionally_retained.
- resource-order store/Postgres/schema status must be cleaned or intentionally_retained before Cloud lane.
- `legacy-cleanup-secret-hygiene` status must be cleaned or gated by the diff-scoped scan eval.
- `legacy-cleanup-legacy-scripts` status must be cleaned or gated by the archive boundary eval.
- open / in_progress / needs_eval / deferred_authorized_current_path cleanup gaps block Cloud lane cursor eligibility.
- cleanup-only goal stop condition is stricter than Cloud lane dependency eligibility: all cleanup gaps must be `cleaned`, `tombstone_only`, `archive_only`, or `intentionally_retained`, then Codex writes `cleanup_completion` truth and stops before any Cloud/development/release leaf.

## Release Readiness Dependency Gate

Release readiness dependency gate: release-readiness leaf steps may set `cursor_eligible: true` only after all prerequisites below are true:

- resource-order store/Postgres/schema cleaned 或 intentionally_retained
- secret hygiene cleaned
- legacy scripts archive cleaned
- Portal architecture refactor characterized/cleaned
- OPL connection productionization completed 或 deferred_authorized with B-accepted future-stage blocker
- Cloud lane productionization completed 或 deferred_authorized with B-accepted future-stage blocker
- frontend/backend product completion completed

If any dependency is not satisfied, release readiness 未满足依赖时不能成为 current cursor, release readiness may only be `pending` or `deferred_authorized_future_stage`, and Codex 不得请求 deploy/cloud 授权 for release readiness. Codex must choose the highest-priority executable cleanup/refactor/product leaf instead.

## Gap Field Schema

Every gap entry must contain:

- id:
- current_fact:
- ideal_state:
- problem:
- dependency:
- depends_on:
- blocked_by:
- executable_when:
- stage:
- priority:
- cursor_eligible:
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
- depends_on: []
- blocked_by: []
- executable_when: monitoring detects user_owned primary-path regression or B requests a focused cleanup audit.
- stage: S1 legacy cleanup
- priority: 10
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B reruns eval, confirms no `user_owned` primary meaning, then ff-only absorbs and pushes before cursor moves.

### Gap: legacy-cleanup-resource-order

- id: legacy-cleanup-resource-order
- current_fact: resource-order route tombstones, billing/payload rewrite, store/admin/frontend third slice, store/Postgres/schema characterization, and fourth-slice active runtime persistence retirement are complete. Resource-order remains only retired/tombstone/migration-only in store/Postgres/schema surfaces.
- ideal_state: managed environment/resource binding/billing/audit is the only active resource attribution path.
- problem: prevent resource-order persistence from returning as active runtime truth while retaining migration-only legacy tables/collections until a later schema-drop/archive leaf proves it is safe.
- dependency: route, billing/payload, store/admin/frontend cleanup absorbed.
- depends_on: [legacy-cleanup-user-owned]
- blocked_by: []
- executable_when: monitoring detects active resource-order primary-path regression, or a future schema-drop/archive leaf is explicitly scoped.
- stage: S1 legacy cleanup
- priority: 20
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`; store/Postgres/schema retired-active-runtime facts are covered by `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs` and dedicated static gate `node scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs`
- allowed_files: `services/portal/src/state/portal-resource-order-store.mjs`, `services/portal/src/state/portal-store-schema.mjs`, `services/portal/src/state/portal-store-postgres-persistence.mjs`, `services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs`, `services/portal/src/state/portal-store-runtime-connections.mjs`, `services/portal/src/state/portal-store-storage-bootstrap.mjs`, `services/portal/src/app/portal-store-runtime.mjs`, `services/portal/src/state/portal-store-db-delegates.mjs`, relevant v22 smoke and recovery docs for monitoring or a future dedicated schema-drop/archive leaf
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, unrelated frontend
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms the characterization gate now describes retired active runtime behavior, resource binding replacement path stays green, no route success path returns, no active runtime resource-order store/Postgres read/write remains, and fourth-slice implementation did not run real DB/cloud operations.

### Gap: legacy-cleanup-secret-hygiene

- id: legacy-cleanup-secret-hygiene
- current_fact: workflow gate has path-level secret-like checks; reusable local diff-scoped sensitive hygiene eval is absorbed and proves changed-files / added-lines scanning without reading real secret-like paths.
- ideal_state: B always runs changed-files / added-lines diff-scoped secret scan before absorb; full-repo secret scan is read-only audit only.
- problem: secret hygiene can degrade if B relies only on broad scans or path names.
- dependency: product-goal harness absorbed.
- depends_on: [legacy-cleanup-resource-order]
- blocked_by: []
- executable_when: any branch changes docs/scripts/contracts/services or B needs diff-scoped scan evidence.
- stage: S1 legacy cleanup
- priority: 30
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs`
- allowed_files: `scripts/smoke-test-v22-*`, `docs/recovery/*`
- forbidden_files: `.env*`, secret files, kubeconfig, `deploy/*`, `adapters/*`, `.sentrux/*`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/recovery/status-matrix.md`
- B_absorb_criteria: B confirms changed-files / added-lines diff-scoped sensitive hygiene scan is mandatory, path-level fail-closed checks still block secret-like paths, no secret content is read, and cleanup_completion may treat this gate as cleaned truth.

### Gap: legacy-cleanup-legacy-scripts

- id: legacy-cleanup-legacy-scripts
- current_fact: v19/v20/v21/live-test scripts remain archive/reference, not default validation; `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` is absorbed and gates default docs and MVP suite against legacy script re-entry.
- ideal_state: default execution line uses only v22 local smoke unless a canary is explicitly authorized.
- problem: old scripts can re-enter AI context as default truth.
- dependency: secret hygiene eval shell absorbed; archive boundary gate exists and is runnable locally.
- depends_on: [legacy-cleanup-secret-hygiene]
- blocked_by: []
- executable_when: default validation docs or MVP suite mention archive/reference legacy scripts.
- stage: S1 legacy cleanup
- priority: 40
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`, branch-scoped harness allowlist updates
- forbidden_files: `scripts/live-test-*`, `scripts/smoke-test-v19-*`, `scripts/smoke-test-v20*`, `scripts/smoke-test-v21-*` unless archiving is explicitly scoped
- truth_writeback_target: `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B verifies MVP suite does not include old scripts, no live-test is run, and cleanup_completion may treat this archive boundary as cleaned truth.

### Gap: cleanup-completion-truth

- id: cleanup-completion-truth
- current_fact: cleanup-only cursor correction records that user_owned, resource-order, secret hygiene, legacy scripts, default narrative, and OpenCost/Langfuse primary narrative cleanup are no longer active primary paths.
- ideal_state: all cleanup gaps are cleaned, tombstone_only, archive_only, or intentionally_retained, and the goal stops before Cloud lane or product development.
- problem: the canonical cursor pointed at a Cloud lane leaf while this run is cleanup-only; cleanup_completion truth must be written before stopping.
- dependency: cleanup gates for user_owned, resource-order, secret hygiene, legacy scripts, default entry, and OpenCost/Langfuse narrative are absorbed or represented as tombstone/archive facts.
- depends_on: [legacy-cleanup-user-owned, legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts]
- blocked_by: []
- executable_when: cleanup-only goal observes no cleanup gap with open, in_progress, needs_eval, or deferred_authorized_current_path status.
- stage: S1 legacy cleanup
- priority: 45
- cursor_eligible: true
- status: cleaned
- next_leaf_step: leaf-cleanup-completion-truth-writeback
- eval: `node scripts/smoke-test-v22-cleanup-completion-truth.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, secret-like paths, true cloud runners, package/dependency files
- truth_writeback_target: `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`
- B_absorb_criteria: B reruns cleanup completion and required v22 gates, confirms no cleanup gap remains unfinished, confirms OpenCost/Langfuse remain non-primary, and stops without entering Cloud lane.

### Gap: architecture-refactor-portal-layering

- id: architecture-refactor-portal-layering
- current_fact: Portal structure/failure isolation contract exists and now characterizes the current backend route/app/domain/state and frontend view/composable/API module anchors. Current code shape includes a large backend composition root, some route-to-state direct imports, domain modules that include payload/provider bridge semantics, frontend API barrel retained as non-page-default, harness renderer as a cross-domain registry, and admin views that partly call admin API directly.
- ideal_state: backend route -> app payload -> domain -> state/persistence and frontend view/composable/API module boundaries are enforceable by characterization gates.
- problem: refactors can move behavior without proving contract parity.
- dependency: cleanup of resource-order store/Postgres/schema should land first for related surfaces.
- depends_on: [legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts]
- blocked_by: []
- executable_when: a Portal refactor branch is opened; characterization gate must run before moving or splitting code.
- stage: S2 architecture refactor
- priority: 50
- cursor_eligible: false
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`, `docs/recovery/*`, `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`, branch-scoped harness allowlist updates; future implementation refactor branches under `services/portal/**` must be separate leaf steps
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- B_absorb_criteria: B reruns characterization gate and confirms no product behavior drift.

### Gap: opl-connection-gateway-preflight-runtime-file-run-artifact-trace

- id: opl-connection-gateway-preflight-runtime-file-run-artifact-trace
- current_fact: local contracts prove Gateway/preflight/Runtime Bridge, selected file/run/artifact gates, a local OPL productionization eval shell, and Runtime Agent HTTP relay rejection of Package D owner fields. Production connection is not fully live.
- ideal_state: Portal -> Gateway -> clean upstream OPL -> Runtime Agent -> file/run/artifact -> Portal trace works without fake 200.
- problem: canary facts must not become production truth without productionized branch absorption.
- dependency: OPL capability and file/run/artifact contracts.
- depends_on: [architecture-refactor-portal-layering]
- blocked_by: [true cloud runtime, COS billing reconciliation, Langfuse / trace.medopl.cn, deploy evidence, secret-backed live provider calls]
- executable_when: repo-local OPL contract/eval/local projection work is scoped and does not require secret/live/cloud/deploy/upstream actions.
- stage: S3 OPL connection productionization
- priority: 60
- cursor_eligible: false
- status: gated
- next_leaf_step: deferred_authorized_without_step_local_auth_record
- eval: `node scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs`, `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`, `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`, `node scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs`
- allowed_files: local OPL productionization implementation only under `services/portal/src/routes/opl.routes.mjs`, `services/portal/src/routes/portal-api-v22-opl-work.routes.mjs`, `services/portal/src/domain/opl-work-flow.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-routes-http.mjs`, `services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-messages.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-launch-scope.mjs`, `services/opl-runtime-bridge/src/run-contract.mjs`, OPL productionization smokes, and scoped recovery truth writeback
- forbidden_files: upstream one-person-lab, `deploy/*` without authorization, raw provider key paths
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms clean upstream one-person-lab boundary, no fake success path, no Package D owner-field leakage, no raw secret/token/storage/path leakage, no canary-only production claim, and no secret/live/cloud/deploy/upstream operation.

### Gap: cloud-lane-mock-readonly-dry-run-authorized

- id: cloud-lane-mock-readonly-dry-run-authorized
- current_fact: Cloud lane contracts define mock -> readonly -> dry-run -> authorized create/release, with real operations separately authorized.
- ideal_state: production cloud lifecycle follows authorized gates, secret allowlists, billing checks, rollback, and audit without exposing cloud console language to users.
- problem: cloud facts and Portal product facts can be mixed if authorization boundaries are not explicit.
- dependency: cloud onboarding workflow boundary.
- depends_on: [legacy-cleanup-user-owned, legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts, architecture-refactor-portal-layering, opl-connection-gateway-preflight-runtime-file-run-artifact-trace]
- blocked_by: [authorized create/release, true cloud mutation, secret-backed live inventory]
- executable_when: readonly/local status audit can run without secret/live/cloud/build/push/kubectl/deploy and without touching deploy/adapters/.sentrux.
- stage: S4 Cloud lane productionization
- priority: 70
- cursor_eligible: false
- status: in_progress
- next_leaf_step: leaf-cloud-lane-readonly-status-audit
- eval: `node scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs`
- allowed_files: cloud-lane contract/docs/smoke in a dedicated authorized branch
- forbidden_files: `deploy/*`, `.env*`, kubeconfig, true cloud runners unless explicitly authorized
- truth_writeback_target: `docs/recovery/cloud-onboarding-status-table.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms no true cloud operation ran without authorization and any risky leaf step has step-local auth record, minimum spend, baseline, cleanup evidence, owner guard, and failure truth writeback.

truth writeback section:

- leaf-resource-order-store-postgres-schema-implementation: active `portal-resource-order-store` is now fail-closed retired API surface; runtime connections, storage bootstrap, db delegates, and Postgres snapshot read/write no longer instantiate or call resource-order store or `resource_orders` / `resource_order_events` active queries/writers. Legacy tables, snapshot helper functions, and JSON migration collection keys remain migration-only/tombstone facts. Verification passed locally with resource-order characterization, resource-order retirement gate, Portal check, product-goal harness, default-entry gate, MVP suite, workflow review, scoped node --check, and diff whitespace check. Failure analysis classified initial branch allowlist failures as `eval_wrong` / `leaf2_branch_subscription_missing`; exact branch-scoped allowlists were updated, including `portal-store-storage-bootstrap.mjs` because it was part of active runtime bootstrap.
- leaf-secret-hygiene-diff-scan-eval-shell: `scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs` added a reusable local eval using a temporary git repo. It proves added-line sensitive-value detection, unchanged historical content exclusion, secret-like path content skipping, and workflow path-gate fail-closed behavior without reading real `.env`, secret, kubeconfig, token, or key files. The eval filename intentionally avoids `secret` to prevent the path-level fail-closed gate from treating the eval file itself as a secret-like path.
- leaf-legacy-scripts-archive-eval-shell: `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` is absorbed as the legacy script archive boundary eval. It checks README and `docs/vibe-coding.md` code blocks, enforces MVP suite references to `scripts/smoke-test-v22-*`, and verifies `docs/recovery/repo-zoning.md` archive/review-rewrite rows for v19/v20/v21/live-test/check legacy script families. No live-test was run, no legacy script was deleted or modified, and no service/deploy/adapter/upstream/package/secret path was touched.
- leaf-portal-layering-characterization-gate: `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs` now validates `currentPortalCodeShape` in the Portal structure contract. It pins stable backend route/app/domain/state anchors, frontend view/composable/API anchors, smoke-layer files, and known future refactor risks without changing Portal business code. Future refactor truth recorded: `portal-runtime.mjs` is a large composition root, `platform-provisioned-resource.routes.mjs` still has route-to-state direct import shape, some domain modules include payload/provider bridge semantics, app layer mixes orchestration and view-model payload builders, `services/portal/frontend/src/api/portal.ts` remains a non-default barrel, `PortalComponentFixtureRenderer.vue` is a large cross-domain harness registry, admin views are not uniformly composable-based, and retired `resource-order` / `user-owned` tombstones remain controlled legacy guards.
- leaf-opl-connection-productionization-contract-refresh: `scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs` gates contract_refresh_only OPL productionization handoff status. Local Runtime Agent HTTP API relay full-loop and WebUI bridge no-fake-success gates are absorbed only as canary facts; provider message reply remains message/reply only. Real cloud runtime, COS billing reconciliation, Langfuse / `trace.medopl.cn`, one-person-lab HTTP Product API, deploy owner fields, Package D owner labels, raw provider key, tokens, object/storage keys, local paths, and signed URLs remain outside OPL production truth until separately authorized and productionized.
- next executable OPL leaf: `leaf-opl-connection-productionization-eval-shell` must create a local eval shell before any production implementation. It may only prove allowed OPL-lane production inputs and block canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations.
- leaf-opl-connection-productionization-eval-shell: `scripts/smoke-test-v22-opl-productionization-eval-shell.mjs` now provides the local eval shell for the next OPL production implementation. It reads only repo-tracked contracts/recovery/gates, asserts OPL projection inputs are limited to `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`, and fail-closes on Package D owner fields, raw key/token/storage/path leakage, fake success, upstream drift, and canary evidence promoted to production truth.
- leaf-opl-connection-productionization-eval-shell B absorbed on `6a939de05efa8967fa2b0bf8da3c53768471fc89`. The next executable OPL leaf is `leaf-opl-connection-productionization-local-implementation`: a local-only implementation slice that may productionize repo-local Portal/Adapter/Runtime Bridge projection boundaries, but must not read secret, call a live provider, call true cloud, build/push/kubectl, deploy, modify upstream, or claim real cloud/COS/Langfuse production truth.
- leaf-opl-connection-productionization-local-implementation attempt 1: the local eval now proves `services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs` rejects Package D owner fields (`ownerRef`, `operationId`, K8s/deploy owner labels) in Runtime Agent HTTP relay payloads, in addition to existing raw key/token/storage/path leakage guards. This remains local productionization hardening only and does not claim true cloud runtime, COS billing, Langfuse, deploy, or upstream production truth.
- leaf-opl-connection-productionization-local-implementation B absorbed on `f114ee587db2a41a3a85fc5f67bbed4fbe63e57b`. The remaining OPL productionization work that requires true cloud runtime, COS billing reconciliation, Langfuse / `trace.medopl.cn`, deploy evidence, build/push/kubectl, live-test, or secret-backed live provider calls is not executable without a step-local auth record and remains `deferred_authorized`; the next local executable leaf is `leaf-frontend-product-evalset-gap`.
- Authorization model: Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps；Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- No auth record means the risky step remains deferred_authorized.
- Cloud live baseline / cleanup / minimum spend policy requires desired/current baseline 应为 2，且测试后必须回到 2.
- cleanup evidence must prove created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- Owner guard: 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。
- Failure truth writeback must record failed_step_id, failed_gate, attempt_count, failure_category, evidence_path, suspected_root_cause, whether_contract_wrong, whether_eval_wrong, whether_problem_should_split, whether_authorization_required, and next_recommended_action.

### Gap: frontend-product-vue-vite-ts-pinia

- id: frontend-product-vue-vite-ts-pinia
- current_fact: Portal UI MVP exists; future frontend completion must preserve Vue 3 + Vite + TypeScript + Pinia contracts. `services/portal/frontend/src/harness/portal-ui-evalset.json` is now characterized as the executable Portal UI truth source: it covers 14 routes, 3 layouts, 32 done surfaces, 8 API shapes, 9 primitives, 26 copy registry entries, 11 fixtures, 13 visual routes, page composition, surface states, component fixtures, visual workbench, screenshot regression metadata, design tokens, presentation rules, browser DOM anchors, and runtime report generation.
- ideal_state: user loop, admin, mobile/table usability, empty/loading/error states, and API contracts are eval-covered.
- problem: visual or API changes can ship without responsive or component-state verification.
- dependency: current Portal UI contracts.
- depends_on: [cloud-lane-mock-readonly-dry-run-authorized]
- blocked_by: []
- executable_when: Cloud lane readonly/dry-run/product language boundaries are characterized or B accepts any cloud live gap as a future-stage blocker.
- stage: S5 frontend/backend product completion
- priority: 80
- cursor_eligible: false
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-portal-frontend-surface-composables.mjs`
- allowed_files: future frontend branch under `services/portal/frontend/**` plus evalset/smoke
- forbidden_files: `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, Portal UI contracts
- B_absorb_criteria: B requires API contract, component states, mobile/table responsive evidence, and typecheck.

- leaf-frontend-product-evalset-gap: frontend evalset characterization passed locally with `node scripts/smoke-test-v22-portal-frontend-surface-composables.mjs`, `node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`, and `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface`. The runtime suite ran 8 Playwright visual tests successfully and generated only uncommitted `.runtime` evidence. This leaf did not change UI implementation, package/dependency files, deploy, adapters, `.sentrux`, `.env.demo.template`, upstream, secrets, live/cloud/build/push/kubectl/deploy, or live-test. The next local executable leaf is `leaf-backend-contract-eval-template`.

### Gap: backend-product-node22-esm-layering

- id: backend-product-node22-esm-layering
- current_fact: backend baseline uses Node 22 ESM and route/app/domain/state/persistence conventions across Portal services; Portal structure characterization now includes a reusable backend implementation eval template with route -> app payload -> domain -> state/persistence, required verification commands, forbidden route-to-state shortcut, forbidden fallback/shim missing-field behavior, and legacy primary-path guards.
- ideal_state: every backend change has route smoke, payload/domain contract smoke, node --check or npm check, and workflow gate coverage.
- problem: route logic can bypass app/domain/state layering or hide missing fields behind fallback/shim.
- dependency: Portal structure contract.
- depends_on: [frontend-product-vue-vite-ts-pinia]
- blocked_by: []
- executable_when: frontend product evalset is absorbed and a backend route/payload/domain contract leaf is scoped.
- stage: S5 frontend/backend product completion
- priority: 90
- cursor_eligible: false
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`
- allowed_files: future backend branch under `services/portal/**` plus smoke
- forbidden_files: implicit fallback/shim, `user_owned` primary path, `resource-order` primary path, OpenCost/Langfuse main path
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, backend contracts
- B_absorb_criteria: B confirms route -> app payload -> domain -> state/persistence and no hidden fallback.

- leaf-backend-contract-eval-template: backend implementation eval template was added to `docs/contracts/v22-portal-structure-failure-isolation-boundary.md` and gated by `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`. The RED phase failed on `portal_structure_required_surface_missing:backend_implementation_eval_template`; the GREEN phase proves `backendImplementationEvalTemplate` with Node 22 ESM, route/app_payload/domain/state_persistence flow, required verification commands, route forbidden state imports, missing-field `implicit_default` / `silent_fallback` / `shim_adapter_compatibility` bans, domain legacy primary-path bans, and state/persistence responsibility bans. Existing `route_to_state_direct_import_exists` remains recorded as characterization risk, so this leaf does not claim backend refactor completion. No `services/*`, package/dependency files, deploy, adapters, `.sentrux`, `.env.demo.template`, upstream, secrets, live/cloud/build/push/kubectl/deploy, or live-test was touched or run. The next local executable leaf after B absorb is `leaf-billing-audit-characterization`.

### Gap: billing-audit-preauth-ledger-release-t1

- id: billing-audit-preauth-ledger-release-t1
- current_fact: contract-level release stop billing and audit flow exists; characterization now gates release/preauth/freeze/audit and billing attribution fields before deeper billing production work.
- ideal_state: preauth, ledger, release stop billing within 120 minutes, and T+1 audit are production-ready and traceable.
- problem: billing truth can be confused with trace metadata, Langfuse, or cloud raw facts.
- dependency: managed environment/resource binding and cloud lane facts.
- depends_on: [backend-product-node22-esm-layering, cloud-lane-mock-readonly-dry-run-authorized]
- blocked_by: []
- executable_when: billing/audit work is local contract/eval scoped or cloud live billing reconciliation has a step-local auth record.
- stage: S5 frontend/backend product completion
- priority: 100
- cursor_eligible: false
- status: gated
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- allowed_files: `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs`, `scripts/smoke-test-v22-product-goal-harness.mjs`, `scripts/smoke-test-v22-default-entry-narrative-gate.mjs`, `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`, and exact branch-scoped harness allowlist updates; future implementation branches must declare a narrower billing/service write set separately.
- forbidden_files: OpenCost primary narrative, Langfuse billing truth, real cloud mutation without authorization
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, billing contracts
- B_absorb_criteria: B confirms release stops charging and audit record exists without treating observability as billing truth.

- leaf-billing-audit-characterization: `scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs` now characterizes the local release stop billing/audit loop beyond contract existence. The RED phase failed on `billing_ledger_fixture_must_not_use_resourceOrderId_as_active_truth`, proving the gate detects active `resourceOrderId` billing attribution. The GREEN phase rewrites the fixture to use `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`, verifies active freeze/preauth before release, zeroed/billing-stopped preauth after release, pending ledger identity projection, release audit record/API projection parity, no active `resourceOrderId`, no raw secret/storage leakage, and no billing truth dependency on trace metadata, Langfuse, or cloud raw facts. No `services/*`, package/dependency files, deploy, adapters, `.sentrux`, `.env.demo.template`, upstream, secrets, live/cloud/build/push/kubectl/deploy, or live-test was touched or run.

### Gap: release-readiness-authorized-deploy-only

- id: release-readiness-authorized-deploy-only
- current_fact: deploy/build/push/kubectl/live-test are outside default development and require explicit authorization. The current session now authorizes `release_readiness_deploy_runtime_smoke`, `build_push_kubectl_deploy`, and `live_runtime_smoke`, but local discovery found no concrete Package D release plan file, no concrete region, no local accepted preflight/build-push/deploy-dry-run/runtime-smoke evidence package, no previous image digest / rollback evidence, no node pool desired/current=2 baseline evidence for this step, and no cleanup evidence.
- ideal_state: release readiness is evaluated only after contracts, local suite, secret scan, and authorized deploy plan pass.
- problem: deploy readiness can be falsely inferred from local smoke or from operation-type authorization without a concrete release plan/evidence package.
- dependency: product e2e, cloud lane, OPL connection, billing/audit.
- depends_on: [legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts, architecture-refactor-portal-layering, opl-connection-gateway-preflight-runtime-file-run-artifact-trace, cloud-lane-mock-readonly-dry-run-authorized, frontend-product-vue-vite-ts-pinia, backend-product-node22-esm-layering, billing-audit-preauth-ledger-release-t1]
- blocked_by: [missing concrete Package D release plan, missing region, missing accepted preflight/build-push/dry-run evidence, missing rollback evidence, missing baseline/cleanup evidence]
- executable_when: all release readiness dependency gate prerequisites are satisfied and a step-local release auth record includes concrete plan, scope, budget, baseline, rollback, cleanup, evidence path, and stop conditions.
- stage: S6 release readiness
- priority: 999
- cursor_eligible: false
- status: deferred_authorized_future_stage
- next_leaf_step: leaf-release-readiness-auth-boundary
- eval: `node scripts/smoke-test-v22-release-readiness-auth-boundary.mjs`; `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- allowed_files: docs/recovery and future authorized deploy contracts; current local auth-boundary leaf may add `scripts/smoke-test-v22-release-readiness-auth-boundary.mjs` and exact harness allowlist updates only
- forbidden_files: `deploy/*`, build/push/kubectl/live-test without explicit authorization or without concrete release plan/evidence closure
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, deploy contracts
- B_absorb_criteria: B confirms release readiness does not execute deploy unless authorized.

- next leaf selection after billing audit characterization: `leaf-release-readiness-auth-boundary` is the next product-goal cursor but remains `deferred_authorized` until a concrete step-local auth record exists for any build/push/kubectl/live-test/deploy/cloud/secret action. The billing characterization leaf did not create or authorize such a record.
- leaf-release-readiness-auth-boundary: `scripts/smoke-test-v22-release-readiness-auth-boundary.mjs` records `generic_chat_authorization_insufficient_for_risky_release`: 用户笼统允许不等于可执行 build/push/kubectl/live-test/deploy/cloud/secret. The current session adds `user_authorized_release_readiness_deploy_runtime_smoke_2026_05_14` for `release_readiness_deploy_runtime_smoke`, `build_push_kubectl_deploy`, and `live_runtime_smoke`, but the step-local auth record still blocks with `authorized_but_missing_concrete_release_plan`, `missing_local_release_plan_file`, `missing_concrete_region`, `missing_local_package_d_evidence`, and `blocked_before_secret_or_cloud_execution`. The required concrete step-local auth record must provide `step_id`, `authorized_operation_type`, `secret_scope`, `cloud_scope`, concrete `region`, `resource_scope`, `budget_limit`, `baseline_requirement`, `rollback_plan`, `cleanup_plan`, `evidence_path`, and `stop_conditions`, plus Package D release-plan owner guard fields before any risky release action. This local leaf executes no release/deploy operation and records `no_release_deploy_operation_executed`; status remains `deferred_authorized`.

### Gap: dependency-modernization-node24-vite-vitest-readiness

- id: dependency-modernization-node24-vite-vitest-readiness
- current_fact: current baseline is Node 22 ESM with Vue 3 + Vite + TypeScript + Pinia; this branch does not upgrade dependencies.
- ideal_state: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness are tracked as future eval-backed gaps.
- problem: dependency upgrades can mix with product harness and destabilize unrelated lanes.
- dependency: product-goal harness only records the future gap.
- depends_on: [release-readiness-authorized-deploy-only]
- blocked_by: [future modernization authorization and dedicated dependency migration branch]
- executable_when: a future dependency modernization branch is explicitly scoped; this harness branch must not upgrade dependencies.
- stage: S6 release readiness
- priority: 1000
- cursor_eligible: false
- status: needs_eval
- next_leaf_step: write_eval_shell
- eval: future dependency readiness characterization gate; no upgrade in this branch
- allowed_files: future dedicated modernization contract/eval branch
- forbidden_files: `package.json`, lockfiles, service dependency files in this harness branch
- truth_writeback_target: `docs/recovery/v22-goal-state.md`, future modernization contract
- B_absorb_criteria: B confirms Node 24 / Vite / Vitest modernization 只作为 future gap，不在本分支升级。
