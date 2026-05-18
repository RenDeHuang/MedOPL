# MedOPL v22 Current vs Ideal Gap Matrix

Every gap below is part of the product-goal harness, not a free-form roadmap. Each gap must have an eval. 每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。

Machine-readable current state now lives in `docs/recovery/v22-goal-current.json`.
Product Completion Scoreboard now lives in `docs/recovery/v22-product-completion-scoreboard.json`.
This Markdown remains a human-readable gap explanation and history surface; the consistency gate checks JSON/Markdown/gap/scoreboard alignment.
scoreboard 只表达产品能力完成度，不决定 leaf execution order. Execution order is decided by `docs/recovery/v22-goal-current.json` plus this gap matrix's `depends_on` / `executable_when` / `cursor_eligible` fields.
Autonomous Goal Runner is runner governance，不改变 current cursor; it only verifies that contract, manifest, policy, and runner entrypoints stay wired so code follows the subscribed contracts.

Allowed status values: `open`, `in_progress`, `needs_eval`, `gated`, `cleaned`, `characterized`, `completed`, `intentionally_retained`, `pending`, `deferred_authorized_current_path`, `deferred_authorized_future_stage`.

## Dependency Stage Order

- S1 legacy cleanup
- S2 architecture refactor
- S3 OPL connection productionization
- S4 Cloud lane productionization
- S5 frontend/backend product completion
- S6 release readiness

Codex must execute the product-goal dependency graph in stage order: cleanup -> refactor -> OPL connection -> Cloud lane -> frontend/backend product completion -> release readiness. A future-stage blocker must not be treated as the current blocker when an earlier cleanup/refactor/dev leaf is still executable.

## Strict Monolith Ideal Gap Truth

- v22 ideal state: MedOPL 是 platform-provisioned / customer-dedicated 的 OPL SaaS 托管科研工作台。
- v22 ideal state: Portal 是托管科研工作台 control plane。
- v22 ideal state: 用户购买套餐、算力、存储和运行环境。
- v22 ideal state: 平台负责开通、隔离、计费、审计和释放。
- v22 ideal state: OPL runtime 负责科研工作区执行、文件、任务和结果。
- gap to ideal: `user-owned` 不是主线；任何 public route、route registration、compat alias、fixture、copy 或测试锚点都必须从 active repo 删除。
- gap to ideal: `resource-order` 不是主线；旧 route、store、schema、migration、fixture、evalset、copy 或测试锚点都必须删除，或先改名改边界进入 v22 active surface。
- gap to ideal: v19/v20/v21 legacy smoke 不是当前验证体系；active repo 不再保留旧脚本作为历史证据，当前验证只使用 v22 local smoke 和明确授权的 future canary 合同。
- gap to ideal: old runner/provisioner 不是 v22 runtime bridge / gateway 主线；旧 adapters、旧 deploy、旧 infra 资产必须物理退役，除非能证明属于 active v22 Portal/Gateway/Runtime Bridge 交付面。
- gap to ideal: OpenCost/Langfuse 旧默认叙事不是当前产品事实源；Langfuse 只可作为 sanitized trace metadata implementation boundary，旧 compose/deploy/infra 资产不得作为完成态保留。
- strict cleanup rule: 后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续。
- strict cleanup rule: 保留项必须写出 active v22 reason；不能因为 git history、历史证据、旧兼容或旧失败壳而留在 active repo。
- zero-compat active surface rule: 任何让旧路线、旧字段、旧模块、旧部署形态、旧测试体系、旧叙事还能被调用、注册、接受、映射、解释、验证、部署或作为默认上下文存在的 active repo 资产，都是兼容层。
- zero-compat active surface rule: `adapters/*`、`deploy/*`、`infra/*`、live/canary/authorized runner executable surface 不属于 strict monolith 默认 active surface；需要能力时必须迁入 Portal / Gateway / Runtime Bridge / repo-local v22 gate 后删除旧路径。
- current zero-compat fact: Runtime Bridge active code 中的旧 resource-order 与 user-owned runtime 标识已清退；Slice K 已删除 `adapters/billing-aggregator/**`，并把 billing summary/status/server plans 收回 Portal monolith ledger projection；Slice L 已删除 `deploy/local/dockerfiles/**`，Package D 本地 gate 只保留 `imageTargetRef` + active service `sourceRoot` 元数据；Slice M 已删除或迁名 live/canary/authorized runner executable scripts；Slice N 已清理 residual compatibility narrative；Slice O 已记录 zero-compat active surface completed。这不改变 current cursor。
- current zero-compat gap: no active zero-compat cleanup gap remains after Slice O; 后续 feature leaf 若碰到过时模块、接口、测试或兼容面，必须同 leaf 清理退役，或拆 cleanup leaf 后再继续。

## Cleanup Stage Completion Gate

Cleanup stage completion gate: Cloud lane 不得跳过未完成 cleanup. Before any Cloud lane leaf may set `cursor_eligible: true`, legacy cleanup prerequisites satisfied before Cloud lane cursor_eligible=true:

- `legacy-cleanup-user-owned` status must be cleaned or intentionally_retained.
- resource-order store/Postgres/schema status must be cleaned or intentionally_retained before Cloud lane.
- `legacy-cleanup-secret-hygiene` status must be cleaned or gated by the diff-scoped scan eval.
- `legacy-cleanup-legacy-scripts` status must be cleaned or gated by the archive boundary eval.
- open / in_progress / needs_eval / deferred_authorized_current_path cleanup gaps block Cloud lane cursor eligibility.
- cleanup-only goal stop condition is stricter than Cloud lane dependency eligibility: all cleanup gaps must be `cleaned` or `intentionally_retained` with an explicit active v22 reason, then Codex writes `cleanup_completion` truth and stops before any Cloud/development/release leaf. After B absorbs a dedicated cleanup-stop retirement, `cleanup_completion` becomes historical and normal product-goal selection may resume at the lowest-priority eligible non-cleanup leaf.

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
- current_fact: default entry and primary path have been retired into platform-provisioned semantics; remaining public retired route, route registration, copy, fixture or alias hits are strict delete targets in this cleanup branch.
- ideal_state: no implementation, route, doc, eval, fixture, copy, test, or product language retains `user_owned` / `user-owned` as a usable path or alias.
- problem: prevent user-owned meaning from returning through active code, docs, tests, or compatibility entrypoints.
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
- current_fact: resource-order route success paths, billing/payload rewrite, store/admin/frontend surface cleanup, active runtime persistence retirement, old Portal resource-provisioner client wiring deletion, and old non-v22 billing/portal smoke anchor deletion are complete; any remaining retired route registration, domain/store/schema/migration/snapshot helper, copy, fixture, evalset or test anchor is a strict delete target unless first migrated into v22 resource binding boundaries.
- ideal_state: managed environment/resource binding/billing/audit is the only resource attribution path; no `resource-order` file, route, schema, migration key, public copy, fixture or test anchor remains in active repo.
- problem: prevent resource-order persistence and compatibility surfaces from returning as active runtime truth.
- dependency: route, billing/payload, store/admin/frontend cleanup absorbed.
- depends_on: [legacy-cleanup-user-owned]
- blocked_by: []
- executable_when: monitoring detects active resource-order primary-path regression, or a future schema-drop/archive leaf is explicitly scoped.
- stage: S1 legacy cleanup
- priority: 20
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`; store/Postgres/schema physical retirement is covered by the resource-order retirement gate and strict monolith schema gate.
- allowed_files: relevant v22 smoke, recovery docs, and active Portal persistence/runtime files only when they remove legacy resource-order schema/store/client remnants or preserve resource binding/workspace/billing/audit v22 surfaces; no `portal-resource-order-store.mjs`, resource-order domain family, `resource-provisioner-client.mjs`, characterization gate, old non-v22 billing/portal smoke, or future archive/drop compatibility leaf remains as a completion state.
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
- current_fact: v19/v20/v21/live-test scripts are not default validation; strict monolith cleanup now treats remaining v19/v20/v21 smoke/check/daily/live-prepare scripts as physical delete targets.
- ideal_state: default execution line uses only v22 local smoke unless a canary is explicitly authorized.
- problem: old scripts can re-enter AI context as default truth.
- dependency: secret hygiene eval shell absorbed; archive boundary gate exists and is runnable locally.
- depends_on: [legacy-cleanup-secret-hygiene]
- blocked_by: []
- executable_when: default validation docs, MVP suite, workflow, README, product, architecture, or script directory retains v19/v20/v21 legacy scripts as current validation or retained repo assets.
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
- current_fact: cleanup_completion truth is historical after cleanup-stop current-lock retirement; strict monolith cleanup reopens the physical retirement dimension so old modules, interfaces, tests, deploy assets, and compatibility surfaces are removed rather than retained as inactive evidence.
- ideal_state: all cleanup gaps are cleaned or intentionally retained only with explicit active v22 reason, and cleanup_completion remains a historical completion fact rather than the active current cursor.
- problem: cleanup_completion correctly stopped a cleanup-only run, but its execution lock must not remain the normal product-goal current cursor after B absorption.
- dependency: cleanup gates for user_owned, resource-order, secret hygiene, legacy scripts, default entry, and OpenCost/Langfuse narrative are absorbed, and strict physical cleanup removes legacy files instead of treating old shells or historical scripts as completion evidence.
- depends_on: [legacy-cleanup-user-owned, legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts]
- blocked_by: []
- executable_when: monitor-only after B absorb; it becomes executable again only if cleanup regression reopens a cleanup gap.
- stage: S1 legacy cleanup
- priority: 45
- cursor_eligible: false
- status: cleaned
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-cleanup-completion-truth.mjs`
- allowed_files: `docs/recovery/*`, `scripts/smoke-test-v22-*`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, secret-like paths, true cloud runners, non-Portal-frontend dependency files
- truth_writeback_target: `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/legacy-cleanup-backlog.md`, `docs/recovery/repo-zoning.md`
- B_absorb_criteria: B reruns cleanup completion and required v22 gates, confirms no cleanup gap remains unfinished, confirms OpenCost/Langfuse remain non-primary, and confirms cleanup_completion truth remains historical rather than the active current cursor.

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

### Gap: saas-control-plane-user-experience-truth

- id: saas-control-plane-user-experience-truth
- current_fact: dedicated subscribable contract now promotes "MedOPL is the SaaS control plane and managed delivery platform for One Person Lab" into product truth, and the contract index now maps service product, user experience, information architecture, lifecycle, role, state source, operation risk, UI composition, delivery/platform, and support truth layers.
- ideal_state: every Portal/UI branch can subscribe to a single contract that states MedOPL makes clean upstream OPL open-box SaaS: Portal explains what service the user bought, whether the OPL workbench is usable, what is missing, what to click next, where files/tasks/results are, and whether billing/release state is normal; OPL remains responsible for chatbot, agent, scientific task execution, file understanding, result generation, and in-workbench interaction.
- problem: without this truth layer, Portal UI can pass execution-layer contracts while still reading like a resource delivery dashboard instead of an OPL SaaS control plane.
- dependency: Portal role surface and UI composition contracts exist.
- depends_on: [architecture-refactor-portal-layering]
- blocked_by: []
- executable_when: monitor-only after B absorb; future Portal/UI, OPL entry, runtime, resource/billing, trace, and cloud/provider branches must subscribe to the SaaS control plane UX truth before changing user-visible behavior.
- stage: S2 architecture refactor
- priority: 55
- cursor_eligible: false
- status: completed
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`
- allowed_files: `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`, `docs/contracts/README.md`, `docs/recovery/product-truth.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/mvp-contract-acceptance.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/v22-goal-current.json`, `scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`, `scripts/smoke-test-v22-mvp-contract-suite.mjs`, `scripts/v22-workflow-gate.mjs`, `scripts/smoke-test-v22-workflow-gate.mjs`, `scripts/smoke-test-v22-product-goal-harness.mjs`
- forbidden_files: `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, upstream one-person-lab, non-Portal-frontend dependency files, secret-like paths, true cloud runners
- truth_writeback_target: `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`, `docs/contracts/README.md`, `docs/recovery/product-truth.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/mvp-contract-acceptance.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/v22-goal-current.json`
- B_absorb_criteria: B confirms this is an additive truth layer, not a UI implementation; Portal remains a SaaS control plane, OPL remains the scientific execution/chatbot surface, cloud resources remain后台交付边界, and no current goal cursor is advanced without B absorption.

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
- eval: `node scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs`, `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`, `node scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs`; Runtime Agent HTTP API proof is retained as historical proof only, not default MVP suite or production deploy evidence.
- allowed_files: local OPL productionization implementation only under `services/portal/src/routes/opl.routes.mjs`, `services/portal/src/routes/portal-api-v22-opl-work.routes.mjs`, `services/portal/src/domain/opl-work-flow.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-routes-http.mjs`, `services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-messages.mjs`, `services/opl-runtime-bridge/src/runtime-bridge-launch-scope.mjs`, `services/opl-runtime-bridge/src/run-contract.mjs`, OPL productionization smokes, and scoped recovery truth writeback
- forbidden_files: upstream one-person-lab, `deploy/*` without authorization, raw provider key paths
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms clean upstream one-person-lab boundary, no fake success path, no Package D owner-field leakage, no raw secret/token/storage/path leakage, no canary-only production claim, and no secret/live/cloud/deploy/upstream operation.

### Gap: cloud-lane-mock-readonly-dry-run-authorized

- id: cloud-lane-mock-readonly-dry-run-authorized
- current_fact: Cloud lane readonly status audit has been absorbed into trunk. Cloud lane contracts define mock -> readonly -> dry-run -> authorized create/release, with real operations separately authorized; starter minimal live evidence remains historical/tracked, full matrix live is not claimed, and risky cloud/deploy/live steps still require step-local authorization.
- ideal_state: production cloud lifecycle follows authorized gates, secret allowlists, billing checks, rollback, and audit without exposing cloud console language to users.
- problem: cloud facts and Portal product facts can be mixed if authorization boundaries are not explicit.
- dependency: cloud onboarding workflow boundary.
- depends_on: [legacy-cleanup-user-owned, legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts, architecture-refactor-portal-layering, opl-connection-gateway-preflight-runtime-file-run-artifact-trace]
- blocked_by: [authorized create/release, true cloud mutation, secret-backed live inventory]
- executable_when: monitoring detects Cloud lane readonly status or authorization boundary regression; otherwise monitor-only after B absorb.
- stage: S4 Cloud lane productionization
- priority: 70
- cursor_eligible: false
- status: completed
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs`
- allowed_files: cloud-lane contract/docs/smoke in a dedicated authorized branch
- forbidden_files: `deploy/*`, `.env*`, kubeconfig, true cloud runners unless explicitly authorized
- truth_writeback_target: `docs/recovery/cloud-onboarding-status-table.md`, `docs/recovery/v22-goal-state.md`
- B_absorb_criteria: B confirms no true cloud operation ran without authorization and any risky leaf step has step-local auth record, minimum spend, baseline, cleanup evidence, owner guard, and failure truth writeback.

truth writeback section:

- leaf-resource-order-store-postgres-schema-implementation: active runtime connections, storage bootstrap, db delegates, and Postgres snapshot read/write no longer instantiate or call resource-order store or `resource_orders` / `resource_order_events` active queries/writers. Strict monolith Slice E deletes resource-order store/schema/domain remnants, removes resource-order schema fragments, deletes snapshot helper writers and JSON migration collection keys, removes the old characterization gate, and does not execute real DB migration. Verification is now the resource-order retirement gate plus strict monolith schema gate, not a retained characterization shell.
- leaf-secret-hygiene-diff-scan-eval-shell: `scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs` added a reusable local eval using a temporary git repo. It proves added-line sensitive-value detection, unchanged historical content exclusion, secret-like path content skipping, and workflow path-gate fail-closed behavior without reading real `.env`, secret, kubeconfig, token, or key files. The eval filename intentionally avoids `secret` to prevent the path-level fail-closed gate from treating the eval file itself as a secret-like path.
- leaf-legacy-scripts-archive-eval-shell: `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` is absorbed as the legacy script archive boundary eval. It checks README and `docs/vibe-coding.md` code blocks, enforces MVP suite references to `scripts/smoke-test-v22-*`, and verifies `docs/recovery/repo-zoning.md` archive/review-rewrite rows for v19/v20/v21/live-test/check legacy script families. No live-test was run, no legacy script was deleted or modified, and no service/deploy/adapter/upstream/package/secret path was touched.
- leaf-portal-layering-characterization-gate: `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs` now validates `currentPortalCodeShape` in the Portal structure contract. It pins stable backend route/app/domain/state anchors, frontend view/composable/API anchors, smoke-layer files, and known future refactor risks without changing Portal business code. Future refactor truth recorded: `portal-runtime.mjs` is a large composition root, `platform-provisioned-resource.routes.mjs` still has route-to-state direct import shape, some domain modules include payload/provider bridge semantics, app layer mixes orchestration and view-model payload builders, `services/portal/frontend/src/api/portal.ts` remains a non-default barrel, old frontend harness ownership has moved to the retired frontend surface gate, admin views are not uniformly composable-based, and strict monolith cleanup has removed retired `resource-order` / `user-owned` public route shells.
- leaf-opl-connection-productionization-contract-refresh: `scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs` gates contract_refresh_only OPL productionization handoff status. Local Runtime Agent HTTP API relay full-loop and WebUI bridge no-fake-success gates are absorbed only as canary facts; provider message reply remains message/reply only. Real cloud runtime, COS billing reconciliation, Langfuse / `trace.medopl.cn`, one-person-lab HTTP Product API, deploy owner fields, Package D owner labels, raw provider key, tokens, object/storage keys, local paths, and signed URLs remain outside OPL production truth until separately authorized and productionized.
- next executable OPL leaf: `leaf-opl-connection-productionization-eval-shell` must create a local eval shell before any production implementation. It may only prove allowed OPL-lane production inputs and block canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations.
- leaf-opl-connection-productionization-eval-shell: `scripts/smoke-test-v22-opl-productionization-eval-shell.mjs` now provides the local eval shell for the next OPL production implementation. It reads only repo-tracked contracts/recovery/gates, asserts OPL projection inputs are limited to `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`, and fail-closes on Package D owner fields, raw key/token/storage/path leakage, fake success, upstream drift, and canary evidence promoted to production truth.
- leaf-opl-connection-productionization-eval-shell B absorbed on `6a939de05efa8967fa2b0bf8da3c53768471fc89`. The next executable OPL leaf is `leaf-opl-connection-productionization-local-implementation`: a local-only implementation slice that may productionize repo-local Portal/Gateway/Runtime Bridge projection boundaries, but must not read secret, call a live provider, call true cloud, build/push/kubectl, deploy, modify upstream, or claim real cloud/COS/Langfuse production truth.
- leaf-opl-connection-productionization-local-implementation attempt 1: the local eval now proves `services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs` rejects Package D owner fields (`ownerRef`, `operationId`, K8s/deploy owner labels) in Runtime Agent HTTP relay payloads, in addition to existing raw key/token/storage/path leakage guards. This remains local productionization hardening only and does not claim true cloud runtime, COS billing, Langfuse, deploy, or upstream production truth.
- leaf-opl-connection-productionization-local-implementation B absorbed on `f114ee587db2a41a3a85fc5f67bbed4fbe63e57b`. The remaining OPL productionization work that requires true cloud runtime, COS billing reconciliation, Langfuse / `trace.medopl.cn`, deploy evidence, build/push/kubectl, live-test, or secret-backed live provider calls is not executable without a step-local auth record and remains `deferred_authorized`; the next local executable leaf is `leaf-frontend-product-evalset-gap`.
- Authorization model: Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps；Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- No auth record means the risky step remains deferred_authorized.
- Cloud live baseline / cleanup / minimum spend policy requires desired/current baseline 应为 2，且测试后必须回到 2.
- cleanup evidence must prove created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- Owner guard: 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。
- Failure truth writeback must record failed_step_id, failed_gate, attempt_count, failure_category, evidence_path, suspected_root_cause, whether_contract_wrong, whether_eval_wrong, whether_problem_should_split, whether_authorization_required, and next_recommended_action.

### Gap: portal-ui-contract-truth-convergence

- id: portal-ui-contract-truth-convergence
- current_fact: The Figma Make user/admin React UI baseline has been absorbed, and this cleanup leaf centralizes remaining retired frontend residue into `scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs`.
- ideal_state: Figma Make ZIP plus `services/portal/frontend/src/app/**` and `src/app/data/portalAdapters.ts` are the current Portal UI implementation truth; historical UI evidence is not active completion evidence; Playwright starts from a real React route; Figma UI visuals remain unchanged until a new Figma-approved design change exists.
- problem: old UI truth residue can make agents rebuild or verify against the wrong Portal surface before Portal-OPL, admin, announcement and data-layer loops are locally closed.
- dependency: Figma Make user/admin Portal UI implementation baseline is absorbed and cleanup_completion truth is historical.
- depends_on: [cleanup-completion-truth]
- blocked_by: []
- executable_when: cleanup_completion is historical and the absorbed Figma Make user/admin Portal UI baseline exists; this leaf only updates subscribed UI contracts/recovery/smoke files, `DESIGN.md`, and `services/portal/frontend/playwright.config.ts`.
- stage: S1 legacy cleanup
- priority: 46
- cursor_eligible: true
- status: in_progress
- next_leaf_step: leaf-portal-ui-contract-truth-convergence
- eval: `node scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs`; `node scripts/smoke-test-v22-portal-ui-truth-convergence.mjs`; `node scripts/smoke-test-v22-portal-workbench-management-ui-composition-contract.mjs`; `node scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs`; `node scripts/smoke-test-v22-contract-conflict-boundary.mjs`; `node scripts/smoke-test-v22-goal-state-consistency.mjs`
- allowed_files: `DESIGN.md`, `services/portal/frontend/playwright.config.ts`, `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`, `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`, `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`, `docs/contracts/README.md`, `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/mvp-contract-acceptance.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/status-matrix.md`, `docs/recovery/physical-legacy-file-retirement-run-manifest.json`, `docs/recovery/portal-figma-make-ui-convergence-plan.md`, `docs/recovery/portal-ui-design-generation-brief.md`, `docs/recovery/portal-ui-design-prd.md`, `scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs`, `scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs`, `scripts/smoke-test-v22-portal-ui-truth-convergence.mjs`, `scripts/smoke-test-v22-agent-verify-entrypoint.mjs`, `scripts/smoke-test-v22-cleanup-completion-truth.mjs`, `scripts/smoke-test-v22-default-entry-narrative-gate.mjs`, `scripts/smoke-test-v22-goal-state-consistency.mjs`, `scripts/smoke-test-v22-mvp-contract-suite.mjs`, `scripts/smoke-test-v22-product-goal-execution-order.mjs`, `scripts/smoke-test-v22-product-goal-harness.mjs`, `scripts/smoke-test-v22-portal-contract-role-consolidation.mjs`, `scripts/smoke-test-v22-portal-figma-make-admin-readiness.mjs`, `scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs`, `scripts/smoke-test-v22-portal-frontend-surface-eval.mjs`, `scripts/smoke-test-v22-portal-mobile-table-usability.mjs`, `scripts/smoke-test-v22-portal-mobile-usability.mjs`, `scripts/smoke-test-v22-portal-package-surface-isolation.mjs`, `scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`, `scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs`, `scripts/smoke-test-v22-portal-web-route-alignment.mjs`, `scripts/smoke-test-v22-portal-workbench-management-ui-composition-contract.mjs`, `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`, `scripts/smoke-test-v22-retire-legacy-resource-user-surface.mjs`, `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs`
- forbidden_files: Portal page visual changes; Portal backend services changes unless separately authorized; `deploy/*`; `adapters/*`; `.sentrux/*`; `.env.demo.template`; upstream / one-person-lab; secret-like paths; true cloud runners
- truth_writeback_target: `DESIGN.md`, `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`, `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`, `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`, `docs/contracts/README.md`, `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/mvp-contract-acceptance.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/status-matrix.md`, `docs/recovery/physical-legacy-file-retirement-run-manifest.json`, `docs/recovery/portal-ui-design-prd.md`, `services/portal/frontend/playwright.config.ts`
- B_absorb_criteria: B reruns current verify, confirms old UI truth no longer appears as active completion evidence, confirms Playwright uses the current React route, confirms no Portal visual/page/backend/cloud/deploy/upstream/secret boundary is crossed, then ff-only absorbs before any product-system rebuild or business-loop leaf starts.

### Gap: frontend-product-react-vite-figma-make

- id: frontend-product-react-vite-figma-make
- current_fact: Portal UI MVP has been migrated to React + Vite + TypeScript + shadcn/Radix + lucide for the ordinary user Portal routes `/overview`, `/resources`, `/workspace`, `/trace`, `/billing`, and `/opl-launch`, plus admin Portal routes `/admin/dashboard`, `/admin/users`, `/admin/alerts`, `/admin/billing-ops`, `/admin/audit`, `/admin/system`, and `/admin/ops`. `v22-portal-figma-make-ui-implementation-boundary.md` authorizes this Portal-wide frontend stack and records Figma Make file `pjLYKml89XFsf8BMNOJ3CV` plus ZIP artifact `/mnt/c/Users/Administrator/Downloads/MedOPL+Portal+UI+Design+(1).zip` as the ordinary user and admin UI implementation source. Retired admin console residue is physically retired; current admin UI lives in `src/app/pages/admin/*`, uses `/portal/api/admin/*` adapters, and keeps RoleContext as display-only while backend admin APIs enforce authorization. `/admin/ops` remains a mounted service-status route, but the default backend API can return `404 ops_surface_disabled`; frontend must render “平台托管运维入口未启用” instead of a generic error or fake success. DESIGN.md translates contracts and Figma Make truth into implementation guidance without replacing contracts, ZIP source-of-truth, smoke, or v22 product truth.
- ideal_state: user loop, admin, mobile/table usability, empty/loading/error states, API contracts, and design quality audit are eval-covered.
- problem: visual or API changes can ship without responsive, component-state, route-anchor, typecheck and build verification unless design quality audit and Figma Make ZIP surface gate keep service clarity, next action clarity, workbench scanability, secret hygiene and mainline-question coverage executable.
- dependency: current Portal UI contracts.
- depends_on: [portal-ui-contract-truth-convergence, cloud-lane-mock-readonly-dry-run-authorized]
- blocked_by: []
- executable_when: Cloud lane readonly status audit and Portal UI design quality audit evidence are absorbed; this leaf remains local Portal frontend implementation only.
- stage: S5 frontend/backend product completion
- priority: 80
- cursor_eligible: false
- status: completed
- next_leaf_step: monitor_only_after_B_absorb
- eval: `node scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs`; `node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs`; `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface`; `npm --prefix services/portal/frontend run typecheck`; `npm --prefix services/portal/frontend run build`
- allowed_files: `services/portal/frontend/**`, `DESIGN.md`, `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md`, `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`, `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`, `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`, `docs/contracts/README.md`, `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/mvp-contract-acceptance.md`, `scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs`, `scripts/smoke-test-v22-portal-runtime-suite.mjs`
- forbidden_files: Portal backend services changes unless separately authorized; `deploy/*`; `adapters/*`; `.sentrux/*`; `.env.demo.template`; upstream / one-person-lab; secret-like paths; true cloud runners
- truth_writeback_target: `DESIGN.md`, `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md`, `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`, `docs/contracts/README.md`, `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/mvp-contract-acceptance.md`
- B_absorb_criteria: B confirms Portal frontend implementation is real React/Vite UI work under `services/portal/frontend/**`, dependency changes are limited to Portal frontend stack migration, retired Figma residue is excluded, admin pages are sourced from the new ZIP and connected to existing `/portal/api/admin/*` adapters, no backend/deploy/upstream/secret/live-cloud boundary is crossed, and Portal remains the SaaS control plane for the托管 OPL 科研工作台服务.

- leaf-frontend-product-evalset-gap: historical frontend characterization was absorbed before this React/Figma Make implementation leaf. Current executable user Portal truth now lives in the Figma Make ZIP surface gate and `src/app/data/portalAdapters.ts`. Historical UI evidence is not current completion evidence.

- leaf-cloud-lane-readonly-status-audit B absorbed on `377641b47ed2de5f6f9f2528fc06e7f3d5c16adc`: Cloud lane readonly status, authorization boundary, full-matrix non-claim, and S5 handoff are recorded. No secret, true cloud, services implementation, deploy, build/push/kubectl, live-test, adapters, `.sentrux`, upstream, package/dependency, merge, or push operation was authorized by that leaf.

- leaf-portal-ui-design-quality-audit: historical S5 audit leaf added contract/rubric/eval checks for design quality. It does not itself migrate frontend stack; the stack migration authorization now comes from `v22-portal-figma-make-ui-implementation-boundary.md`.

- leaf-portal-design-system-source: historical authoring branch recorded `DESIGN.md` as a design execution source before continuing implementation slices. The current implementation leaf may change Portal frontend React/CSS/TS and Portal frontend package/lockfile only inside its subscribed boundary; it still forbids Portal backend, Gateway, Runtime Bridge, deploy, `.sentrux`, adapters, upstream, non-Portal-frontend dependency changes, secret, true cloud, build/push/kubectl, and live-test.

- current UI implementation leaf handoff: `leaf-portal-figma-make-react-ui-implementation` is absorbed as the current user/admin React/Figma Make baseline. It may be used as implementation truth, but it is no longer the active current cursor while `portal-ui-contract-truth-convergence` cleans old truth residue.

- leaf-portal-figma-make-react-ui-implementation: absorbed S5 implementation baseline. It implemented the audit handoff in the real Portal frontend so the first screen answers what managed workbench service was purchased, whether the OPL workspace is usable, what environment/package/compute/storage/release state exists, how users enter OPL and move files/tasks/results, which responsibility belongs to Portal versus OPL runtime, and what the next action is. Follow-up product-system rebuild must keep Figma UI visuals, layout, information architecture and main paths unchanged unless Figma is changed first.

- leaf-portal-figma-make-react-ui-implementation truth writeback: current implementation replaces the historical SPA with React user and admin Portal routes, excludes retired Figma residue, connects existing `/portal/api/*` and `/portal/api/admin/*` adapters, records RoleContext as display-only navigation gating, and removes historical UI evidence from current completion evidence. Remaining non-UI work stays out of scope: Portal backend services, backend-product Node 22 ESM layering, billing audit preauth ledger release T1, true cloud, release readiness, deploy/build/push/kubectl/live-test, secrets, and upstream OPL changes.

### Gap: backend-product-node22-esm-layering

- id: backend-product-node22-esm-layering
- current_fact: backend baseline uses Node 22 ESM and route/app/domain/state/persistence conventions across Portal services; Portal structure characterization now includes a reusable backend implementation eval template with route -> app payload -> domain -> state/persistence, required verification commands, forbidden route-to-state shortcut, forbidden fallback/shim missing-field behavior, and legacy primary-path guards.
- ideal_state: every backend change has route smoke, payload/domain contract smoke, node --check or npm check, and workflow gate coverage.
- problem: route logic can bypass app/domain/state layering or hide missing fields behind fallback/shim.
- dependency: Portal structure contract.
- depends_on: [frontend-product-react-vite-figma-make]
- blocked_by: []
- executable_when: frontend Figma Make ZIP implementation leaf is absorbed and a backend route/payload/domain contract leaf is scoped.
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

- leaf-backend-contract-eval-template: backend implementation eval template was added to `docs/contracts/v22-portal-structure-failure-isolation-boundary.md` and gated by `node scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs`. The RED phase failed on `portal_structure_required_surface_missing:backend_implementation_eval_template`; the GREEN phase proves `backendImplementationEvalTemplate` with Node 22 ESM, route/app_payload/domain/state_persistence flow, required verification commands, route forbidden state imports, missing-field `implicit_default` / `silent_fallback` / `shim_adapter_compatibility` bans, domain legacy primary-path bans, and state/persistence responsibility bans. Existing `route_to_state_direct_import_exists` remains recorded as characterization risk, so this leaf does not claim backend refactor completion. No `services/*`, non-Portal-frontend dependency files, deploy, adapters, `.sentrux`, `.env.demo.template`, upstream, secrets, live/cloud/build/push/kubectl/deploy, or live-test was touched or run. The next local executable leaf after B absorb is `leaf-billing-audit-characterization`.

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

- leaf-billing-audit-characterization: `scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs` now characterizes the local release stop billing/audit loop beyond contract existence. The RED phase failed on `billing_ledger_fixture_must_not_use_resourceOrderId_as_active_truth`, proving the gate detects active `resourceOrderId` billing attribution. The GREEN phase rewrites the fixture to use `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`, verifies active freeze/preauth before release, zeroed/billing-stopped preauth after release, pending ledger identity projection, release audit record/API projection parity, no active `resourceOrderId`, no raw secret/storage leakage, and no billing truth dependency on trace metadata, Langfuse, or cloud raw facts. No `services/*`, non-Portal-frontend dependency files, deploy, adapters, `.sentrux`, `.env.demo.template`, upstream, secrets, live/cloud/build/push/kubectl/deploy, or live-test was touched or run.

### Gap: release-readiness-authorized-deploy-only

- id: release-readiness-authorized-deploy-only
- current_fact: deploy/build/push/kubectl/live-test are outside default development and require explicit authorization. The current session now authorizes `release_readiness_deploy_runtime_smoke`, `build_push_kubectl_deploy`, and `live_runtime_smoke`, but local discovery found no concrete Package D release plan file, no concrete region, no local accepted preflight/build-push/deploy-dry-run/runtime-smoke evidence package, no previous image digest / rollback evidence, no node pool desired/current=2 baseline evidence for this step, and no cleanup evidence.
- ideal_state: release readiness is evaluated only after contracts, local suite, secret scan, and authorized deploy plan pass.
- problem: deploy readiness can be falsely inferred from local smoke or from operation-type authorization without a concrete release plan/evidence package.
- dependency: product e2e, cloud lane, OPL connection, billing/audit.
- depends_on: [legacy-cleanup-resource-order, legacy-cleanup-secret-hygiene, legacy-cleanup-legacy-scripts, architecture-refactor-portal-layering, opl-connection-gateway-preflight-runtime-file-run-artifact-trace, cloud-lane-mock-readonly-dry-run-authorized, portal-ui-contract-truth-convergence, frontend-product-react-vite-figma-make, backend-product-node22-esm-layering, billing-audit-preauth-ledger-release-t1]
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
- current_fact: current baseline is Node 22 ESM with React + Vite + TypeScript + shadcn/Radix + lucide; this branch does not upgrade dependencies.
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

### System Domain × Truth Layer Ideal vs Current Gap

- id: system-domain-truth-layer-zero-old-context
- ideal state: Portal 对小白用户说清买了什么、可以做什么、现在能不能用、如果不能用还缺哪一步、下一步点哪里，以及文件、任务、结果、费用在哪里；Portal 同时表达交付真相，说明平台如何开通、隔离、绑定 resourceBinding、计费、审计、释放和停止计费。Gateway + Runtime Bridge 是 Portal 与 OPL 的唯一主线衔接命名。Portal 与云的衔接只用 resource binding、billing ledger、readonly inventory、dry-run plan、authorized create-release control plane。云是平台托管资源池，不是普通用户入口。OPL 是 clean upstream 科研执行工作台。
- current after cleanup: `docs/recovery/system-domain-truth-layer-matrix.md` 已把 Portal、Portal 与 OPL 的衔接、Portal 与云的衔接、云、OPL 映射到用户真相 / UX truth、服务商品真相 / product truth、交付真相 / delivery truth、OPL 衔接真相 / OPL connection truth、云/资源真相 / cloud-resource truth、运营真相 / ops truth、风险授权真相 / risk-authorization truth。active code 已迁到 Runtime Bridge client、Runtime Bridge state root、Runtime Bridge contract field 和 `/runtime-bridge` proxy path；legacy redirect route 已删除；workspace lifecycle route 使用 `/portal/workspaces/*`；旧 `managed_runtime` mode 和 `runtime-bridge-managed-runs.mjs` 已删除；non-v22 OPL smoke 已删除或迁名为 `scripts/smoke-test-v22-*`；`compose.product.yaml` 使用 Runtime Bridge service/env 命名；旧 v19 Docker product appliance 文档已删除，不再把旧 adapter/provisioner/runner/Dockerfile 解释成当前 deploy truth。
- remaining gaps: cleanup gap: public旧入口、Portal-OPL旧 Adapter 主链命名、旧 runtime mode、旧非 v22 OPL smoke、旧部署解释和正向“保留旧路径”话术已清退，后续 active surface 继续由 gate 扫描旧 Adapter、legacy redirect、task-space 产品域、deploy/adapters/infra/live/canary 是否回流；internal data-store naming gap: `taskSpaces` / `task_spaces` / `currentTaskSlug` 仍是 Portal workspace persistence 的内部 schema 命名，若要彻底迁成 `workspaces` / `currentWorkspaceSlug` 必须另开 data-store naming cleanup，不执行真实 DB migration；UX expression gap: Portal UI 已开始表达用户买到的服务、可用性、下一步、文件/任务/结果/费用，但面向小白的文案和状态层次仍可在后续 UI/copy leaf 继续打磨；delivery gap: 开通、隔离、计费、审计、释放和停止计费已有合同和本地 gate，但不等于真实生产交付全上线；cloud gap: 真实云 mutation、deploy、build/push/kubectl、live-test 和真实 DB migration 仍需单独授权；OPL capability gap: 真实 file/run/artifact/provider 能力仍按 canary/future boundary 裁定，不得把本地 Runtime Agent proof 写成生产事实。
- next leaf recommendation: 若继续推进产品体验，开 `feat/*` UI/copy leaf，只改 Portal frontend 和订阅合同，让小白用户第一屏更直接回答“我买了什么、现在能不能用、下一步点哪里”；若继续推进交付能力，开单独 cloud/OPL capability leaf，先写授权边界和 canary gate，再执行真实外部验证。
- cleanup gap: old naming / old entry / old explanation must stay deleted or renamed under v22 Runtime Bridge / Gateway / workspace / resourceBinding semantics.
- UX expression gap: user-facing Portal wording should keep improving without reintroducing cloud-console language or OPL chatbot reimplementation.
- delivery gap: delivery truth is contract/local-gate backed but not full production delivery.
- cloud gap: cloud remains future-authorized; no default active executable cloud/deploy runner exists.
- OPL capability gap: OPL file/run/artifact/provider capabilities remain bounded by canary evidence and Runtime Bridge / Runtime Agent contracts.
