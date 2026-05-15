# MedOPL v22 Physical Legacy File Retirement Inventory

## Inventory Declaration

- branch: `cleanup/v22-physical-legacy-goal`
- model: `gpt-5.4`
- inventory_status: strict_monolith_cleanup_in_progress
- physical_delete_batch_status: strict_monolith_retirement_in_progress
- agent_run_mode: strict_monolith_legacy_retirement
- run_manifest: `docs/recovery/physical-legacy-file-retirement-run-manifest.json`
- goal: 物理删除 goal
- purpose: 本导台固定 strict monolith cleanup 的旧文件物理退役入口；git history 已足够保存历史，active repo 不再保留旧兼容面、旧测试、旧 deploy/adapters/infra 资产或旧 public 退役壳。
- boundary: 本次用户已授权删除旧 public tombstone、v19/v20/v21 legacy smoke、旧 user-owned/resource-order 兼容面，以及不属于 v22 active surface 的旧 deploy/adapters/infra 资产；仍禁止 secret、live cloud、live-test、build/push/kubectl、真实 DB migration execution、`.sentrux/*` 和 upstream 修改。

decision values: `delete`, `migrate`, `retain_active_v22`, `blocker`
physical_delete_status values: `not_started`, `deleted`, `migrated_to_active_v22`, `retained_active_v22`, `blocked`

## Policy

本导台服务于 strict monolith cleanup。agent 必须先读取 goal、导台和 inventory gate，再选择一个 slice。每刀都要先 RED gate、用 `rg` / import scan 证明删除对象不属于 active v22 reference，再执行删除，再 GREEN gate，再 writeback。

next_slice queue:

1. `slice-a-strict-monolith-policy`
2. `slice-b-user-owned-resource-order-compat-delete`
3. `slice-c-legacy-script-delete`
4. `slice-d-retired-adapter-deploy-infra-delete`
5. `slice-e-legacy-schema-store-retirement`

batch mode 由 run manifest 固定。agent 可以在同一个 cleanup 分支连续执行 queue 中的 slice，但必须 one commit per slice。B may absorb the whole batch after all slice gates pass。

- `delete`: 无 active v22 reason 的旧模块、接口、测试、脚本、public 退役壳、旧部署资产或旧兼容面必须物理删除。
- `migrate`: 仍有业务价值的项必须先改名、改边界、改合同并进入 v22 active surface；旧命名旧边界随后删除。
- `retain_active_v22`: 仅允许明确属于 active v22 Portal/Gateway/Runtime Bridge 或 billing/trace metadata implementation boundary 的文件保留，并必须写出 reason。
- `blocker`: 只有触发硬停止条件时使用，例如需要 secret、live cloud、live-test、build/push/kubectl、真实 DB migration execution、`.sentrux/*`、upstream 修改，或删除会破坏当前 v22 active 主线。
- 后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续。

## Bootstrap Inventory

| path_or_group | legacy_family | current_zone | current_role | inbound_refs | default_suite_ref | public_surface | schema_or_migration_risk | deploy_or_external_risk | decision | physical_delete_status | required_gate | deletion_branch | stop_condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `services/portal/src/routes/resource-order.routes.mjs` | resource-order | Zone 2 | old public/internal route retired shell | route runtime registration and retirement gate | no default success path | yes | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --portal` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | public retired shell and route registration deleted in slice-b |
| `services/portal/src/routes/user-owned-resource.routes.mjs` | user-owned | Zone 2 | old public route retired shell | route runtime registration and retirement gate | no default success path | yes | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --portal` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | public retired shell and route registration deleted in slice-b |
| `services/portal/src/domain/user-owned-resources.mjs` | user-owned | Zone 2 | fail-closed retired domain helper | retirement gate only before physical deletion | no | no | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs` | `cleanup/v22-physical-legacy-goal` | completed_by_first_delete_slice |
| `services/portal/src/state/portal-user-owned-resource-store.mjs` | user-owned | Zone 2 | fail-closed retired store | retirement gate only before physical deletion | no | no | no | no | `delete` | `deleted` | `scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs` | `cleanup/v22-physical-legacy-goal` | completed_by_first_delete_slice |
| `services/portal/src/state/portal-resource-order-store.mjs` | resource-order | Zone 2 | retired store API surface | retirement and characterization gates | no | no | yes | no | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --schema` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete with runtime/store/schema chain cleanup |
| `services/portal/src/state/portal-store-schema.mjs` resource-order schema fragments | resource-order | Zone 2 | legacy schema facts | schema and persistence code | no | no | yes | no | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --schema` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete schema fragments without executing DB migration |
| `services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs` resource-order helpers | resource-order | Zone 2 | historical snapshot writer helpers | persistence code and characterization gate | no | no | yes | no | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --schema` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete snapshot helpers without executing DB migration |
| `scripts/smoke-test-v19-*` | legacy-scripts | Zone 3 | legacy smoke family | static scan found no active/default/workflow refs; old scripts only | no | no | no | possible live assumptions in individual files | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --scripts` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old smoke family |
| `scripts/smoke-test-v20*` | legacy-scripts | Zone 3 | legacy smoke family | static scan found no active/default/workflow refs; old scripts only | no | no | no | possible live assumptions in individual files | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --scripts` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old smoke family |
| `scripts/smoke-test-v21-*` | legacy-scripts | Zone 3 | legacy smoke family | static scan found no active/default/workflow refs; old scripts only | no | no | no | possible live assumptions in individual files | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --scripts` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old smoke family |
| `scripts/live-test-*` | legacy-live-tests | Zone 3 | physically deleted authorized legacy live-test family | static scan found no active/default/workflow refs before deletion; archive docs and old scripts only | no | no | no | yes | `delete` | `deleted` | `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` | `cleanup/v22-physical-legacy-batch-run` | completed_by_authorized_live_test_physical_delete |
| `infra/opencost/**` | OpenCost | Zone 4 | retired infrastructure/ops asset | not default billing truth | no | no | no | yes | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old OpenCost infra asset |
| `compose.langfuse.yaml` | Langfuse | Zone 3 | old compose asset | no active runtime import found | no | no | no | possible external service assumptions | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old Langfuse compose asset |
| `services/portal/src/integrations/langfuse-trace-client.mjs` | Langfuse | Zone 2 | optional sanitized observability client | active import from `services/portal/src/app/portal-runtime-clients.mjs`; v22 Langfuse contract smoke imports sanitized projection adapter | yes | no | no | possible external service assumptions | `retain_active_v22` | `retained_active_v22` | `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs` | none; active trace metadata boundary remains | active sanitized trace metadata implementation boundary |
| `services/opl-runtime-bridge/src/langfuse-publisher.mjs` | Langfuse | Zone 2 | optional sanitized observability publisher | active import from `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`; publisher stays behind sanitized optional attachment boundary | no | no | no | possible external service assumptions | `retain_active_v22` | `retained_active_v22` | `scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs` | none; active trace metadata boundary remains | active sanitized trace metadata implementation boundary |
| `adapters/resource-provisioner/**` | resource-provisioner | Zone 4 | old adapter implementation | not active v22 entry | no | no | no | yes | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old adapter asset |
| `adapters/med-autoscience-runner/**` | med-autoscience-runner | Zone 4 | old runner adapter implementation | not active v22 entry | no | no | no | yes | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old adapter asset |
| `deploy/tke-package/**` and old runner/provisioner deploy assets | deploy-legacy | Zone 4 | old deploy and rendered historical assets | not active v22 Package D Dockerfile surface | no | possible | possible | yes | `delete` | `not_started` | `scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets` | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | delete old deploy assets while retaining active v22 local Dockerfiles |

## Agent Notes

- First delete slice completed: retired user-owned domain/store are physically deleted; strict monolith slice-b deletes the old public route shell as well.
- strict monolith truth writeback: in progress on `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement`. v19/v20/v21 smoke families, public retired route shells, compat aliases, old deploy/adapters/infra assets, and resource-order schema/store remnants are now delete targets rather than retained completion states.
- active v22 retention truth: `deploy/local/dockerfiles/portal.Dockerfile`, `deploy/local/dockerfiles/opl-web-gateway.Dockerfile`, `deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile`, `adapters/billing-aggregator/**`, `services/portal/src/integrations/langfuse-trace-client.mjs`, and `services/opl-runtime-bridge/src/langfuse-publisher.mjs` have active v22 reasons and are not legacy delete targets in this slice.
- hard blockers remain: secret, live cloud, live-test execution, build/push/kubectl, real DB migration execution, `.sentrux/*`, upstream writes, or any deletion that breaks active Portal/Gateway/Runtime Bridge主线.
