# MedOPL v22 Physical Legacy File Retirement Inventory

## Inventory Declaration

- branch: `cleanup/v22-physical-legacy-goal`
- model: `gpt-5.4`
- inventory_status: batch_completed_waiting_b_review
- physical_delete_batch_status: completed_waiting_b_review
- agent_run_mode: physical_delete_goal_driven
- run_manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`
- goal: 物理删除 goal
- purpose: 本导台固定旧文件物理删除的第一批裁定入口，供后续 agent 按 slice 执行 deletion-only 分支。
- boundary: 本导台不授权直接删除；不得跳过导台直接删除。

decision values: `delete`, `keep_tombstone`, `archive_reference`, `migrate`, `forbidden_without_auth`, `needs_schema_drop_leaf`
physical_delete_status values: `not_started`, `deleted`, `kept_tombstone`, `archive_reference`, `migrated`, `blocked_without_auth`, `transferred_to_schema_drop_leaf`

## Policy

本导台服务于物理删除 goal。agent 必须先读取 goal、导台和 inventory gate，再选择一个 slice。inventory gate 只证明裁定覆盖和边界，不执行删除。

next_slice queue:

1. `slice-2-legacy-script-archive-delete-boundary`
2. `slice-3-observability-runner-physical-retirement-boundary`
3. `slice-final-completion-truth-and-temporary-goal-removal`

batch mode 由 run manifest 固定。agent 可以在同一个 cleanup 分支连续执行 queue 中的 slice，但必须 one commit per slice，并且每刀都要先 RED gate、再执行、再 GREEN gate、再 writeback。B may absorb the whole batch after all slice gates pass。

- `delete`: delete candidate 可由后续 deletion-only 分支处理；处理前必须先证明无 active reference。
- `keep_tombstone`: 保留最小 fail-closed 壳，不做兼容翻译。
- `archive_reference`: 只作历史证据或迁移输入，不进入默认 suite 和默认文档。
- `migrate`: 仍有价值，必须迁到 v22 active surface 后再处理旧文件。
- `forbidden_without_auth`: 未单独授权不得修改、删除或执行。
- `needs_schema_drop_leaf`: 数据/schema/migration 专题，不能混入普通删除。

## Bootstrap Inventory

| path_or_group | legacy_family | current_zone | current_role | inbound_refs | default_suite_ref | public_surface | schema_or_migration_risk | deploy_or_external_risk | decision | physical_delete_status | required_gate | deletion_branch | stop_condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `services/portal/src/routes/resource-order.routes.mjs` | resource-order | Zone 2 | old public/internal route 410 tombstone | route runtime registration and retirement gate | no default success path | yes | no | no | `keep_tombstone` | `kept_tombstone` | `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs` | none until explicit public tombstone removal auth | public_tombstone_delete_requires_user_confirmation |
| `services/portal/src/routes/user-owned-resource.routes.mjs` | user-owned | Zone 2 | old public route 410 tombstone | route runtime registration and retirement gate | no default success path | yes | no | no | `keep_tombstone` | `kept_tombstone` | `scripts/smoke-test-v22-retire-user-owned-primary-path.mjs` | none until explicit public tombstone removal auth | public_tombstone_delete_requires_user_confirmation |
| `services/portal/src/domain/user-owned-resources.mjs` | user-owned | Zone 2 | fail-closed retired domain helper | retirement gate only before physical deletion | no | no | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs` | `cleanup/v22-physical-legacy-goal` | completed_by_first_delete_slice |
| `services/portal/src/state/portal-user-owned-resource-store.mjs` | user-owned | Zone 2 | fail-closed retired store | retirement gate only before physical deletion | no | no | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs` | `cleanup/v22-physical-legacy-goal` | completed_by_first_delete_slice |
| `services/portal/src/state/portal-resource-order-store.mjs` | resource-order | Zone 2 | fail-closed retired store API surface | retirement and characterization gates | no | no | possible historical persistence coupling | no | `keep_tombstone` | `kept_tombstone` | `scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs` | none until store/schema split proves safety | active_reference_to_delete_candidate |
| `services/portal/src/state/portal-store-schema.mjs` resource-order schema fragments | resource-order | Zone 2 | migration/schema legacy facts | schema and persistence code | no | no | yes | no | `needs_schema_drop_leaf` | `transferred_to_schema_drop_leaf` | future schema/drop contract gate | `cleanup/v22-physical-schema-drop-resource-order` | schema_or_migration_delete_without_schema_drop_leaf |
| `services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs` resource-order helpers | resource-order | Zone 2 | historical snapshot writer helpers | persistence code and characterization gate | no | no | yes | no | `needs_schema_drop_leaf` | `transferred_to_schema_drop_leaf` | future schema/drop contract gate | `cleanup/v22-physical-schema-drop-resource-order` | schema_or_migration_delete_without_schema_drop_leaf |
| `scripts/smoke-test-v19-*` | legacy-scripts | Zone 3 | historical smoke family | static scan found no active/default/workflow refs; archive docs and old scripts only | no | no | no | possible live assumptions in individual files | `archive_reference` | `archive_reference` | `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` | none in this batch; retained as archive reference | default_suite_references_archive_or_delete_candidate |
| `scripts/smoke-test-v20*` | legacy-scripts | Zone 3 | historical smoke family | static scan found no active/default/workflow refs; archive docs and old scripts only | no | no | no | possible live assumptions in individual files | `archive_reference` | `archive_reference` | `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` | none in this batch; retained as archive reference | default_suite_references_archive_or_delete_candidate |
| `scripts/smoke-test-v21-*` | legacy-scripts | Zone 3 | historical smoke family | static scan found no active/default/workflow refs; archive docs and old scripts only | no | no | no | possible live assumptions in individual files | `archive_reference` | `archive_reference` | `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` | none in this batch; retained as archive reference | default_suite_references_archive_or_delete_candidate |
| `scripts/live-test-*` | legacy-live-tests | Zone 3 | authorized canary/history only | static scan found no active/default/workflow refs; archive docs and old scripts only | no | no | no | yes | `archive_reference` | `blocked_without_auth` | `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` | none without explicit live-test/delete authorization | live_test_delete_requested_without_explicit_authorization |
| `infra/opencost/**` | OpenCost | Zone 4 | infrastructure/ops historical reference | not default billing truth | no | no | no | yes | `forbidden_without_auth` | `blocked_without_auth` | future authorized infra cleanup gate | none without auth | forbidden_path_without_auth |
| `compose.langfuse.yaml` | Langfuse | Zone 3 | historical compose reference | repo-zoning/status-matrix/observability gates record archive truth; no active runtime import found | no | no | no | possible external service assumptions | `archive_reference` | `archive_reference` | `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs` | none in this batch; retained as archive reference | active_recovery_truth_still_mentions_archive_candidate |
| `services/portal/src/integrations/langfuse-trace-client.mjs` | Langfuse | Zone 2 | optional sanitized observability client | active import from `services/portal/src/app/portal-runtime-clients.mjs`; v22 Langfuse contract smoke imports sanitized projection adapter | yes | no | no | possible external service assumptions | `migrate` | `migrated` | `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs` | none in this batch; active trace metadata boundary remains | trace_metadata_boundary_conflict_active_runtime_import_default_suite_dependency |
| `services/opl-runtime-bridge/src/langfuse-publisher.mjs` | Langfuse | Zone 2 | optional sanitized observability publisher | active import from `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`; publisher stays behind sanitized optional attachment boundary | no | no | no | possible external service assumptions | `migrate` | `migrated` | `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs` | none in this batch; active trace metadata boundary remains | trace_metadata_boundary_conflict_active_runtime_import |
| `adapters/resource-provisioner/**` | resource-provisioner | Zone 4 | old adapter implementation | not active v22 entry | no | no | no | yes | `forbidden_without_auth` | `blocked_without_auth` | future authorized adapter cleanup gate | none without auth | forbidden_path_without_auth |
| `adapters/med-autoscience-runner/**` | med-autoscience-runner | Zone 4 | old runner adapter implementation | not active v22 entry | no | no | no | yes | `forbidden_without_auth` | `blocked_without_auth` | future authorized adapter cleanup gate | none without auth | forbidden_path_without_auth |
| `deploy/**` | deploy-legacy | Zone 4 | deploy and rendered historical assets | not ordinary cleanup surface | no | possible | possible | yes | `forbidden_without_auth` | `blocked_without_auth` | future authorized deploy cleanup gate | none without auth | forbidden_path_without_auth |

## Agent Notes

- First delete slice completed: retired user-owned domain/store are physically deleted; the public route tombstone remains.
- slice-2 truth writeback: completed. Static scans found no active/default/workflow refs to v19/v20/v21/live-test script families; v19/v20/v21 smoke families remain archive_reference, and live-test execution and deletion remain blocked without explicit authorization.
- slice-3 truth writeback: completed. `compose.langfuse.yaml` remains archive_reference; `langfuse-trace-client.mjs` and `langfuse-publisher.mjs` remain active trace metadata boundary implementation points and are not physical delete candidates in this batch; adapters/resource-provisioner, adapters/med-autoscience-runner and infra/opencost remain blocked_without_auth.
- final slice truth writeback: completed_waiting_b_review. This batch did not add more deletion in the final slice; remaining blockers are public tombstone auth, schema/drop leaf, forbidden deploy/adapters/infra auth, live-test/delete auth, and Langfuse trace metadata migration boundary.
- Public 410 tombstones remain `keep_tombstone` until the user explicitly confirms the old route no longer needs fail-closed behavior.
- Schema and migration facts remain `needs_schema_drop_leaf`; they are not part of ordinary physical deletion.
- Zone 4 paths are recorded so agents see them, but they remain blocked without separate authorization.
