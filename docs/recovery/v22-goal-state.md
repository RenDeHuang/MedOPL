# MedOPL v22 Goal State

## Canonical Current State

JSON 是机器可读 current truth。Markdown 是人类说明/历史，不再承载唯一 current truth。

- canonical current state: `docs/recovery/v22-goal-current.json`
- product completion scoreboard: `docs/recovery/v22-product-completion-scoreboard.json`
- leaf manifest schema: `docs/recovery/v22-goal-leaf-manifest.schema.json`
- current cursor summary: `leaf-cloud-lane-readonly-status-audit`
- highest-priority executable leaf summary: `leaf-cloud-lane-readonly-status-audit`
- release readiness summary: `deferred_authorized_future_stage`

下面的中文摘要只帮助人读状态；任何 runner、gate、B review 选择 current leaf 时必须读取 `docs/recovery/v22-goal-current.json`，再用 consistency gate 对齐 Markdown/gap/scoreboard。

## Human Summary

- 当前 trunk HEAD: see `docs/recovery/v22-goal-current.json`.
- branch baseline: `origin/recovery/platform-v22-trunk`.
- current branch: `cleanup/v22-goal-harness-consolidation`.
- model: gpt-5.4.
- 当前 goal cursor: `leaf-cloud-lane-readonly-status-audit`.
- highest-priority executable leaf step: `leaf-cloud-lane-readonly-status-audit`.
- 当前下一问题：Cloud lane readonly status audit; release readiness stays future-stage until cleanup/refactor/OPL/Cloud/frontend/backend prerequisites are satisfied.
- release readiness 当前状态: `deferred_authorized_future_stage`.

B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。B 吸收后 cursor 才能前进。

## Current Leaf Summary

- step_id: `leaf-cloud-lane-readonly-status-audit`.
- gap_id: `cloud-lane-mock-readonly-dry-run-authorized`.
- stage: `S4 Cloud lane productionization`.
- cursor_eligible: true.
- eval_command: `node scripts/smoke-test-v22-goal-state-consistency.mjs`; `node scripts/smoke-test-v22-product-goal-execution-order.mjs`.
- auth_boundary: local readonly/docs/scripts only; no secret, no live-test, no true cloud, no build/push/kubectl, no deploy, no services implementation.
- truth_writeback_target: `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-goal-state.md`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`.

## Completed Facts

- 已完成事实：default entry、user_owned、resource-order 前四刀、secret hygiene diff scan、legacy scripts archive boundary、Portal layering characterization、OPL productionization contract refresh、OPL productionization eval shell、OPL productionization local implementation、Portal frontend product evalset gap、Backend contract eval template、Billing audit characterization、release readiness auth boundary、release readiness authorized blocker truth writeback.
- default entry legacy narrative is cleaned.
- user_owned primary path is retired to legacy alias/tombstone.
- resource-order first four slices are complete: route tombstones, billing/payload rewrite, store/admin/frontend surface cleanup, and active store/Postgres/runtime persistence retirement.
- leaf-resource-order-store-postgres-schema-eval-shell completed: characterization gate fixed store/Postgres/schema legacy facts without touching `services/*`, connecting to Postgres, running live/cloud/build/kubectl, or deleting schema.
- leaf-resource-order-store-postgres-schema-implementation completed: active runtime no longer instantiates or wires resource-order store/Postgres persistence; legacy tables/collections remain migration-only/tombstone facts.
- leaf-secret-hygiene-diff-scan-eval-shell completed: diff-scoped sensitive hygiene eval proves changed-files / added-lines scanning without reading real secret-like paths.
- leaf-legacy-scripts-archive-eval-shell completed: legacy script archive boundary eval keeps v19/v20/v21/live-test scripts out of default validation.
- leaf-portal-layering-characterization-gate completed: Portal structure/failure isolation characterization is recorded.
- leaf-opl-connection-productionization-contract-refresh completed: OPL productionization handoff status is `contract_refresh_only`.
- leaf-opl-connection-productionization-eval-shell completed: local eval shell blocks canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations.
- leaf-opl-connection-productionization-local-implementation completed: Runtime Agent HTTP relay rejects Package D owner fields; no service/upstream/deploy/cloud/secret operation may be present beyond the scoped local hardening.
- leaf-frontend-product-evalset-gap completed: Portal frontend evalset characterization covers API contract, component states, responsive/mobile/table usability, loading/empty/error, and typecheck gates.
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
- leaf-backend-contract-eval-template was absorbed after frontend evalset characterization.
- 当前下一问题：OPL connection productionization local implementation.
- 当前下一问题：Portal frontend product evalset gap.
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

- secret hygiene
- legacy scripts archive
- Portal architecture refactor
- OPL connection
- Cloud lane
- frontend/backend product completion
- release readiness
- dependency modernization future gap: Node 24 Active LTS migration readiness and Vite/Vitest modernization readiness only; no dependency upgrade in this branch.

## Historical Execution Line Note

历史记录保留：当前 execution line 的前 5 个 leaf steps 已迁入 `docs/recovery/v22-goal-current.json` 和 git history；本 Markdown 不再维护机器可读 execution manifest。

## Coordination Notes

### 禁止并行写入的区域

- Portal route/app/domain/state refactor overlapping the same route or payload module.
- OPL Gateway/Runtime Bridge connection files.
- Cloud lane authorized create/release and deploy lanes.
- `services/*`, `deploy/*`, `adapters/*`, `.sentrux/*`, `.env.demo.template`, package/dependency files, upstream one-person-lab.

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

B 吸收后 cursor 才能前进。B ff-only 吸收并 push 后，更新 `docs/recovery/v22-goal-current.json` 的 `currentCursor`、`highestPriorityExecutableLeafStep`、`git.originTrunkHead`、`git.branchBaseHead` 和相关 gap 状态；本 Markdown 只同步人类摘要与历史。
