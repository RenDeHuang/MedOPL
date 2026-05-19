# MedOPL v22 Goal State

## Canonical Current State

JSON 是机器可读 current truth。Markdown 是人类说明/历史，不再承载唯一 current truth。

- canonical current state: `docs/recovery/v22-goal-current.json`
- product completion scoreboard: `docs/recovery/v22-product-completion-scoreboard.json`
- leaf manifest schema: `docs/recovery/v22-goal-leaf-manifest.schema.json`
- agent verify manifest: `docs/recovery/v22-agent-verify-manifest.json`
- autonomous runner policy: `docs/recovery/v22-autonomous-goal-runner-policy.json`
- current cursor summary: `leaf-portal-workspace-file-action-closure`
- highest-priority executable leaf summary: `leaf-portal-workspace-file-action-closure`
- release readiness summary: `deferred_authorized_future_stage`

下面的中文摘要只帮助人读状态；任何 runner、gate、B review 选择 current leaf 时必须读取 `docs/recovery/v22-goal-current.json`，再用 consistency gate 对齐 Markdown/gap/scoreboard。

## Consolidation Motivation

- Problem: goal-state.md 太长，容易在长跑和上下文压缩后漂移。Solution: v22-goal-current.json 成为唯一 current truth；v22-goal-state.md 降级为 human summary / history。
- Problem: allowlist 分散在多个 gate，导致每个新 leaf 都要改多个脚本。Solution: `docs/recovery/v22-agent-verify-manifest.json` 是 agent-facing verify manifest；`scripts/v22-verify.mjs current` 是默认统一验证入口。smoke 只做 atomic gate，不再作为新增 leaf 的 allowlist 权威。
- Problem: low-risk 和 high-risk 还没有完全分流。Solution: `risk_class` 固定为 `local_doc_eval` / `local_service_code` / `sensitive_boundary` / `live_external`；当前分支只确保字段和说明存在，不改变现有授权边界。
- Problem: 缺真正的产品完成度计分板。Solution: docs/recovery/v22-product-completion-scoreboard.json 记录产品能力完成度，等级为 `0_not_started` / `1_contract_defined` / `2_local_api` / `3_local_ui` / `4_fake_live` / `5_authorized_canary` / `6_productionized` / `7_monitored`。scoreboard 只表达 product completion，不决定 execution order。
- Problem: 合同很多但执行入口不足，长时间 agent 容易重新选择 scattered smoke 或跳过 B 吸收。Solution: Autonomous Goal Runner uses `docs/recovery/v22-autonomous-goal-runner.md`, `docs/recovery/v22-autonomous-goal-runner-policy.json`, and `node scripts/v22-verify.mjs suite autonomous --base origin/recovery/platform-v22-trunk` to prove runner governance without changing the current cursor.

## Control Plane Consolidation Rules

### Migration order rule

迁移顺序必须固定为：先建立或更新 `docs/recovery/v22-goal-current.json`，再降级本 Markdown 的 current truth 职责，最后让 `node scripts/smoke-test-v22-goal-state-consistency.mjs` 校验 JSON/Markdown/gap/scoreboard 一致。不得先删除 Markdown current context 再补 JSON。

### Single write entry rule

所有 `current_cursor`、`next_leaf`、`current_stage`、`current_blockers`、`release_readiness_state`、`dependency_ordering_repair` 更新必须先写 `docs/recovery/v22-goal-current.json`。本 Markdown 只能同步摘要、历史和规则说明，不得作为唯一 current truth。

### Scoreboard boundary rule

`docs/recovery/v22-product-completion-scoreboard.json` 只表达产品能力完成度，不决定 leaf execution order。执行顺序由 `docs/recovery/v22-goal-current.json` 加 gap matrix 的 `depends_on` / `executable_when` / `cursor_eligible` 决定；scoreboard 不得承载 cursor、dependency、priority 或 executable leaf 选择。

### Autonomous Goal Runner rule

Autonomous Goal Runner is runner governance only. It lets agents keep using the contract + manifest + runner path for eligible low-risk leaves, while preserving independent branch, verification, receipt, commit, B review, ff-only absorption, and post-absorb cursor movement. It does not authorize secret, live cloud, build/push/kubectl, deploy, live-test, upstream write, dependency upgrade, or automatic risky merge.

## Human Summary

- 当前 trunk HEAD: see `docs/recovery/v22-goal-current.json`.
- branch baseline: `origin/recovery/platform-v22-trunk`.
- authoring/source branch: `cleanup/v22-post-absorb-current-truth`.
- target branch: `recovery/platform-v22-trunk`.
- branch field semantics: `v22-goal-current.json` 是 trunk current truth；`authoring_branch` / `current_branch` 只记录最近写入该 truth 的分支来源，不绑定 runtime git branch。
- head field semantics: `base_trunk_head` = 本 leaf 写入时基线；`expected_absorbed_head` = B ff-only absorb 后的 trunk 目标 HEAD 解析规则，而不是写死在同一提交里的 SHA；`last_absorbed_commit` = 上一个已吸收事实，不等同于当前分支 commit，除非已经在 trunk 上。
- model: gpt-5.4.
- 当前 goal cursor: `leaf-portal-workspace-file-action-closure`.
- highest-priority executable leaf step: `leaf-portal-workspace-file-action-closure`.
- 当前下一问题：S5 frontend/backend product completion continues with `leaf-portal-workspace-file-action-closure`; trunk 已吸收 `955fb78866e5f2d4130cec604cc2fbe13ae263e1` 上的 `portal-local-api-action-closure`，所以下一步只绑定现有合同和现有 eval，继续闭合 `/workspace` 文件空间、storage entitlement、upload/download URL 与现有 Portal workspace route/domain/state 的真实对齐，不新增产品合同，不改 Figma 视觉。
- release readiness 当前状态: `deferred_authorized_future_stage`.

B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。B 吸收后 cursor 才能前进。

## Current Leaf Summary

- step_id: `leaf-portal-workspace-file-action-closure`.
- gap_id: `portal-workspace-file-action-closure`.
- stage: `S5 frontend/backend product completion`.
- cursor_eligible: true.
- eval_command: Step 0 current-truth gate uses `node scripts/smoke-test-v22-goal-state-consistency.mjs`; `node scripts/smoke-test-v22-agent-verify-entrypoint.mjs`; `node scripts/smoke-test-v22-product-goal-harness.mjs`; `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`; `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`; `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`. Step 1 implementation eval remains the workspace file-space bundle listed in Step Index.
- default_agent_verify_entrypoint: `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`.
- auth_boundary: this cleanup branch may update current truth, manifest, gap matrix and goal summary only. Step 1 implementation is indexed but not executed here. No service edits in Step 0, no Portal visual/layout/information-architecture changes, no secret, no live-test, no true cloud mutation, no build/push/kubectl, no deploy, no upstream modification.
- truth_writeback_target: `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/status-matrix.md`.
- ui_best_practices_boundary: external UI/UX best practices may be used as expression-quality references only; v22 contracts fix the content semantics, service truth, Portal/OPL responsibility boundary, role boundary, secret hygiene, billing/release/file/task/result truth, and no-cloud-console language.
- implementation_evidence: current leaf is an execution index only in this branch. It binds the next Step 1 workspace file-space closure to existing contracts, frontend APIs, `/workspace`, `portalAdapters`, and existing Portal workspace route/domain/state plus the required eval bundle.
- design_source_scope: `DESIGN.md` remains a design execution source, not a replacement for contracts, Figma Make ZIP source-of-truth, smoke, or v22 product truth.
- implementation_scope: Step 0 only corrects current truth after trunk absorb. Step 1, when opened in its own implementation branch, must not change Figma UI visuals, layout or information architecture; it only closes workspace file-space behavior that the current Figma UI already exposes.

## Completed Facts

- 已完成事实：default entry、user_owned、resource-order 前四刀、secret hygiene diff scan、legacy scripts archive boundary、OpenCost/Langfuse primary narrative retirement truth、cleanup_completion truth、Portal layering characterization、OPL productionization contract refresh、OPL productionization eval shell、OPL productionization local implementation、Portal frontend product evalset gap、Backend contract eval template、Billing audit characterization、release readiness auth boundary、release readiness authorized blocker truth writeback.
- default entry legacy narrative is cleaned.
- user_owned primary path is retired and its public route shell is physically deleted.
- resource-order first four slices are complete: route success path cleanup, billing/payload rewrite, store/admin/frontend surface cleanup, and active store/Postgres/runtime persistence retirement; strict monolith cleanup deletes the remaining route shell, registration, legacy store/domain family, schema fragments, snapshot helper writers, and JSON migration collection keys.
- leaf-resource-order-store-postgres-schema-eval-shell completed: characterization gate fixed store/Postgres/schema legacy facts without touching `services/*`, connecting to Postgres, running live/cloud/build/kubectl, or deleting schema.
- leaf-resource-order-store-postgres-schema-implementation completed: active runtime no longer instantiates or wires resource-order store/Postgres persistence.
- strict monolith Slice E completed: resource-order store/schema/domain remnants, unused Portal resource-provisioner client wiring, old non-v22 billing/portal smoke anchors, and old live/kubectl helper remnants are physically retired from active repo without executing real DB migration, live-test, kubectl, deploy, build/push, or true cloud operation; active Portal persistence now retains resource binding/workspace/billing/audit surfaces only.
- leaf-secret-hygiene-diff-scan-eval-shell completed: diff-scoped sensitive hygiene eval proves changed-files / added-lines scanning without reading real secret-like paths.
- leaf-legacy-scripts-archive-eval-shell completed: legacy script archive boundary eval keeps v19/v20/v21/live-test scripts out of default validation.
- OpenCost/Langfuse primary narrative retirement is cleanup-complete: `scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs` proves Langfuse is optional sanitized observability attachment and OpenCost is archive/reference, not Portal, billing, artifact, run, or product truth.
- cleanup_completion truth is written by `leaf-cleanup-completion-truth-writeback`: all cleanup gaps were cleaned or intentionally retained at that historical point. Strict monolith cleanup supersedes old shell/archive completion states and removes legacy files from active repo.
- cleanup_completion truth is historical after `cleanup/v22-retire-cleanup-stop-current-lock`: the cleanup-only execution lock no longer remains the current cursor; at that historical repair point, normal product-goal selection resumed at `leaf-cloud-lane-readonly-status-audit`.
- leaf-cloud-lane-readonly-status-audit B absorbed on `377641b47ed2de5f6f9f2528fc06e7f3d5c16adc`; normal product-goal selection now resumes at `leaf-portal-ui-design-quality-audit`.
- leaf-portal-layering-characterization-gate completed: Portal structure/failure isolation characterization is recorded.
- leaf-opl-connection-productionization-contract-refresh completed: OPL productionization handoff status is `contract_refresh_only`.
- leaf-opl-connection-productionization-eval-shell completed: local eval shell blocks canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations.
- leaf-opl-connection-productionization-local-implementation completed: Runtime Agent HTTP relay rejects Package D owner fields; no service/upstream/deploy/cloud/secret operation may be present beyond the scoped local hardening.
- leaf-frontend-product-evalset-gap completed historically: the prior Portal frontend characterization covered API contract, component states, responsive/mobile/table usability, loading/empty/error, and typecheck gates; current implementation truth is now Figma Make ZIP surface gate plus `src/app/data/portalAdapters.ts`.
- leaf-portal-ui-design-quality-audit was absorbed on `90b3ecd7271a94ff63266aef3bd5f0d5b1f13739`: it defined boundary/rubric/eval/report schema/future handoff for design quality, did not implement UI, and did not freeze a specific aesthetic solution.
- leaf-portal-figma-make-react-ui-implementation is absorbed as the current user/admin React/Figma Make UI baseline. `leaf-portal-ui-contract-truth-convergence` and `portal-local-api-action-closure` are absorbed/monitor-only facts on trunk; `leaf-portal-workspace-file-action-closure` is now the current feature leaf and only indexes the next implementation branch around `/workspace` file-space closure.

## Step Index

- Step 1 current leaf: `leaf-portal-workspace-file-action-closure`
- Step 1 gap: `portal-workspace-file-action-closure`
- Step 1 subscribed contracts: `v22-mvp-managed-opl-loop.md`, `v22-saas-control-plane-user-experience-boundary.md`, `v22-portal-figma-make-ui-implementation-boundary.md`, `v22-portal-workbench-management-ui-composition-boundary.md`, `v22-portal-files-billing-trace-boundary.md`, `v22-opl-work-message-file-run-boundary.md`, `v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`, `v22-portal-structure-failure-isolation-boundary.md`, `v22-smoke-eval-boundary.md`, recovery `status-matrix.md`, recovery gap matrix
- Step 1 frontend API bindings: `fetchWorkspaceStorage`, `fetchStorageEntitlement`, `createWorkspaceFileUploadUrl`, `createWorkspaceFileDownloadUrl`
- Step 1 page/files: `/workspace`, `services/portal/frontend/src/api/portal/workspace.ts`, `services/portal/frontend/src/app/pages/Workspace.tsx`, `services/portal/frontend/src/app/data/portalAdapters.ts`, and necessary Portal backend workspace route/domain/state files
- Step 1 eval: `node scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs`, `node scripts/smoke-test-v22-portal-file-space-management.mjs`, `node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs`, `node scripts/smoke-test-v22-portal-storage-mode-local-closure.mjs`, `node scripts/smoke-test-v22-portal-runtime-suite.mjs --group surface`, `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- Step 1 non-goals: 不接真实云；不读 secret；不改 Figma 视觉；不返回 `objectKey` / `localPath` / `signedUrl` 到浏览器持久状态；不修改 upstream
- Step 2 indexed-only follow-up: `leaf-portal-opl-file-run-artifact-closure` / `portal-opl-file-run-artifact-closure`
- Step 2 API bindings: `createOplFileRef`, `startOplRun`, `fetchOplArtifact`
- Step 2 note: this is not the current executable leaf in this branch; it is only the next indexed follow-up for later OPL file/run/artifact closure under existing OPL / Runtime Bridge contracts and eval.
- leaf-backend-contract-eval-template completed: backend implementation eval template covers Node 22 ESM, route -> app payload -> domain -> state/persistence, missing-field fallback bans, and legacy primary-path guards.
- leaf-billing-audit-characterization completed: release stop billing/audit characterization pins `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`; `resourceOrderId` is not active billing truth.
- leaf-release-readiness-auth-boundary completed: generic_chat_authorization_insufficient_for_risky_release is recorded; no_release_deploy_operation_executed.
- leaf-release-readiness-authorized-blocker completed: user_authorized_release_readiness_deploy_runtime_smoke_2026_05_14 is recorded, but authorized_but_missing_concrete_release_plan, missing_local_release_plan_file, missing_concrete_region, missing_local_package_d_evidence, and blocked_before_secret_or_cloud_execution keep release readiness non-executable.

## Historical Leaf Results

- Leaf 6 B absorb/push result: OPL connection productionization contract refresh branch `contract/v22-opl-productionization-contract-refresh`, commit `bc22a76b4776f54c10bcc659f1c777e30791b72d`; next cursor is `leaf-opl-connection-productionization-eval-shell`.
- OPL connection productionization contract refresh; OPL connection productionization eval shell; OPL connection productionization local implementation.
- no raw provider key, no live canary unless separately authorized.
- truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`.
- leaf-opl-connection-productionization-local-implementation: implement the smallest local OPL productionization slice; production implementation must not treat canary evidence as production deploy evidence; verification includes `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`.
- Leaf 8 B absorb/push result: commit `f114ee587db2a41a3a85fc5f67bbed4fbe63e57b`; next cursor is `leaf-frontend-product-evalset-gap`.
- Leaf 9 B absorb/push result: Portal frontend product evalset gap commit `6acb92e03c07e580191d77e1a5389a94fbe137fc`; next cursor is `leaf-backend-contract-eval-template`.
- leaf-backend-contract-eval-template was absorbed after the prior frontend characterization.
- 当前下一问题：OPL connection productionization local implementation.
- 当前下一问题：Portal Figma Make ZIP React UI implementation.
- 当前下一问题：Backend contract eval template.
- 当前下一问题：Billing audit characterization.

### Historical Release Readiness Blocker Record

This subsection is historical evidence only. It is intentionally not the current cursor; canonical current state is the JSON file above.

- historical phrase for prior gate: 当前 goal cursor: `leaf-release-readiness-auth-boundary`.
- historical phrase for prior gate: highest-priority executable leaf step: `deferred_authorized`.
- Release readiness auth boundary deferred authorization.
- generic_chat_authorization_insufficient_for_risky_release.
- 用户笼统允许不等于可执行 build/push/kubectl/live-test/deploy/cloud/secret.
- no_release_deploy_operation_executed.
- deferred_authorized.
- step-local auth record.
- docs/recovery 只写脱敏摘要和 truth writeback.
- release_readiness_deploy_runtime_smoke.
- build_push_kubectl_deploy.
- live_runtime_smoke.
- node scripts/smoke-test-v22-release-readiness-auth-boundary.mjs.
- build/push/kubectl, live-test, deploy, true cloud, and secret remain forbidden until the JSON current state marks a risky release leaf executable with a concrete step-local auth record, release plan, owner guard, baseline, rollback, cleanup, and evidence path.

## Later Problems

- Portal architecture refactor
- OPL connection
- Cloud lane
- frontend/backend product completion
- Portal UI design quality audit
- release readiness
- dependency modernization future gap: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness only; no dependency upgrade in this branch.

## Historical Execution Line Note

历史记录保留：当前 execution line 的前 5 个 leaf steps 已迁入 `docs/recovery/v22-goal-current.json` 和 git history；本 Markdown 不再维护机器可读 execution manifest。

## Coordination Notes

### 禁止并行写入的区域

- Portal route/app/domain/state refactor overlapping the same route or payload module.
- OPL Gateway/Runtime Bridge connection files.
- Cloud lane authorized create/release and deploy lanes.
- `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, non-Portal-frontend dependency files, upstream one-person-lab.

### 允许只读审计的区域

- `docs/contracts/README.md`
- `docs/contracts/v22-*`
- `docs/recovery/*`
- `scripts/smoke-test-v22-*`
- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- archive/reference docs and legacy scripts as read-only evidence only

## Cursor Advancement Rule

B 吸收后 cursor 才能前进。B ff-only 吸收并 push 后，先更新 `docs/recovery/v22-goal-current.json` 的 `current_cursor`、`next_leaf`、`current_stage`、`current_blockers`、`release_readiness_state`、`dependency_ordering_repair`、`base_trunk_head`、`expected_absorbed_head` 解析规则、`last_absorbed_commit` 和相关 gap 状态；本 Markdown 只同步人类摘要与历史。
