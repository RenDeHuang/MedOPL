# MedOPL v22 Legacy Cleanup Backlog

本 backlog 从 `docs/recovery/repo-zoning.md` 的 Zone 2/Zone 3 候选中拆出后续专题清退队列。它不授权本分支删除、移动或修改实现。

## Execution Model

- cleanup 分支 1：建立裁定台账。
- cleanup 分支 2-N：按专题清退。
- 每个专题先定义 smoke/gate，再执行 rewrite、migrate 或 delete；strict monolith cleanup 不再把旧壳或旧脚本作为完成态保留。
- strict monolith policy: old public tombstone => delete; archive legacy tests => delete; compat alias => delete; old deploy/adapters/infra assets => delete unless proven active v22 surface.
- 每个专题必须经过 B review 后才能吸收到 `recovery/platform-v22-trunk`。
- smoke = prove the intended v22 path still works。
- gate = prevent the retired legacy meaning from returning。

每个专题分支必须声明：

- 本专题只清退哪一个 legacy 语义。
- 本专题强化哪一个 v22 真相。
- 本专题禁止恢复哪些术语、入口、兼容层或默认脚本。
- 本专题修改范围和不修改范围。
- 本专题验收命令。

## Cleanup Slices

| order | slice | suggested_branch | primary_zone | action | hold_point |
| --- | --- | --- | --- | --- | --- |
| 1 | Default Entry Legacy Narrative | `cleanup/v22-default-entry-legacy-narrative` | Zone 1/2 | rewrite | completed on cleanup/v22-default-entry-legacy-narrative after contract-conflict, legacy-script, and observability/billing gates were absorbed. |
| 2 | user_owned Primary Path Retirement | `cleanup/v22-retire-user-owned-primary-path` | Zone 2 | delete | Portal 当前 user-owned alias、route shell、fixture、copy、test anchor 必须清退。 |
| 3 | resource-order Primary Path Retirement | `cleanup/v22-retire-resource-order-primary-path` | Zone 2 | delete/migrate | managed environment/resource binding 替代路径完整后，旧 route/domain/store/schema/test anchor 必须清退。 |
| 4 | Legacy Script Delete Boundary | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | Zone 2/3 | delete | legacy scripts 不再作为 active repo 历史证据保留。 |
| 5 | OpenCost and Langfuse Primary Narrative Retirement | `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement` | Zone 2/3 | rewrite/delete | sanitized trace metadata boundary remains active; old OpenCost/Langfuse compose/deploy/infra assets are delete targets. |
| 6 | Env Template Default Entry | `cleanup/v22-env-template-default-entry` | Zone 2 | rewrite | completed on cleanup/v22-env-template-default-entry; B must acknowledge workflow gate path-level secret_like_path_changed. |
| 7 | Portal Code Map and Layering | `refactor/v22-portal-code-map-and-layering` | Zone 1/2 | rewrite | 只在旧语义收口后做 app/state/routes/integrations 分层重构。 |

## Slice 1: Default Entry Legacy Narrative

目标：清理默认入口中的旧主叙事，让 README、product、architecture 和默认启动说明只表达 v22 托管科研工作台。

建议 smoke/gate：

- `scripts/smoke-test-v22-default-entry-narrative-gate.mjs`

检查要点：

- `README.md`、`docs/product.md`、`docs/architecture.md` 不把 MedOPL 写成云资源控制台。
- 默认入口只指向 Portal、OPL entry/preflight、v22 contracts 和 v22 recovery。
- v19/v20/v21/live-test 不作为默认验证入口。
- completed on cleanup/v22-default-entry-legacy-narrative：默认入口清退 v19 appliance、`user_owned`、旧 runner/provisioner、OpenCost/Langfuse 主叙事，以及 `deploy/*` / `adapters/*` 默认接线。
- `.env.demo.template` 因 secret-like path gate 不在本 slice 写入清退；后续需要单独授权分支 `cleanup/v22-env-template-default-entry` 处理默认 env 叙事。

## Slice 1b: Env Template Default Entry

目标：清退 `.env.demo.template` 中的旧 runner/K8s/OpenCost/Langfuse 默认主叙事，让 tracked template 只保留 v22 Portal/Gateway/Runtime Bridge 本地模板配置。

建议 smoke/gate：

- `scripts/smoke-test-v22-env-template-default-entry.mjs`

检查要点：

- `.env.demo.template` 不含真实 secret-like value。
- `.env.demo.template` 不含旧 `MED_AUTOSCIENCE_RUNNER_*`、`med-autoscience-runner`、`K8S_NAMESPACE`、`resource-provisioner`、`user_owned` 或 `resource-order` 默认项。
- OpenCost 不作为 billing truth；Langfuse 只能作为 optional sanitized trace attachment，且默认值为空。
- completed on cleanup/v22-env-template-default-entry：本 slice 显式授权修改 `.env.demo.template`，并由 gate 执行 content-level secret scan。
- workflow gate `secret_like_path_changed` disposition：`.env.demo.template` 会触发路径级 fail-closed blocker；B 吸收前需明确接受本分支授权和内容级 secret scan 证据。

## Slice 2: user_owned Primary Path Retirement

目标：把 `user_owned` / `user-owned` 从 active repo 清退，禁止作为主产品路径、alias、route shell、copy、fixture 或测试锚点继续扩写。

建议 smoke/gate：

- `scripts/smoke-test-v22-retire-user-owned-primary-path.mjs`

检查要点：

- Portal 默认配置不再是 `user_owned`。
- 普通用户页面不展示用户自配云资源。
- 新代码不得新增 `user-owned` route/domain/store 作为正式入口。
- completed on cleanup/v22-retire-user-owned-primary-path：Portal 默认 runtime 收敛到 `platform_provisioned`；strict monolith cleanup 继续删除剩余 route shell、registration、copy、fixture 和测试锚点。

## Slice 3: resource-order Primary Path Retirement

目标：把 `resource-order` 从主产品叙事退场，开通路径收敛到 managed environment、resource binding、billing 和 audit。

建议 smoke/gate：

- `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`

检查要点：

- Portal 导航不链接 `resource-order` 主路径。
- 新开通路径走 managed environment / resource binding。
- 旧 prepare-run 或 resource-order public flow 不保留为 active route。
- 新 smoke 不依赖 resource-order 作为默认成功路径。
- 第一刀 route success path 清退已处理旧 public/internal/provision/release/freeze/quote/delete-node-pool route 链路；strict monolith cleanup 继续删除剩余 retired shell 和 registration。
- 第二刀 billing/payload 字段 rewrite 只处理 active ledger、binding 和 Portal payload 主归因迁到 `resourceBindingId`、`billingAttributionId`、`workspaceId`、`accountId` / `serverPlanId`；旧标识只能作为 `legacyResourceOrderId` optional、migration-only alias 留在迁移输入，不作为 fixed required tag，也不恢复任何 route success path。
- 第三刀 store health / admin / frontend surface 清退只处理 active admin、module source、store health 和 frontend surface 不再把 resource-order 作为默认展示字段或主归因字段；Admin 对账、health 和 frontend API 类型使用 `resourceBindingId`、`billingAttributionId`、`workspaceId`、`accountId` / `serverPlanId`。本刀不修改 `services/portal/src/state/portal-resource-order-store.mjs`、store schema、Postgres persistence、migrations、seed/migration collection keys，也不恢复任何 route success path。
- 第四刀 store/Postgres/schema characterization 已在 `cleanup/v22-resource-order-store-postgres-schema-eval-shell` 建立静态 gate：`scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs` 钉住 `portal-resource-order-store`、Postgres schema、Postgres snapshot read/write、runtime connection、db delegate、runtime store 和 JSON migration collection 的当前遗留事实；不修改 `services/*`、不连接真实 DB、不运行 migration、不读 secret、不执行 live/cloud/build/kubectl。
- 第四刀 store/Postgres/schema implementation completed on `cleanup/v22-resource-order-store-postgres-schema-implementation`: active runtime no longer wires `portal-resource-order-store` or active Postgres snapshot read/write for `resource_orders` / `resource_order_events`. Strict monolith cleanup now removes retired store, domain family, schema fragments, snapshot helper writers, and JSON migration collections without executing real DB migration.

## Slice 4: Legacy Script Archive Boundary

目标：让 v19/v20/v21/live-test 脚本从 active repo 退场。v19/v20/v21 smoke 不再作为历史证据保留；live-test 只能通过新的 v22 授权 canary 合同重建，不能恢复旧脚本。

建议 smoke/gate：

- `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`

检查要点：

- MVP suite 只串 v22 默认 smoke。
- `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*` 不进入默认 suite，也不留在 active scripts 目录。
- `scripts/live-test-*` 不进入默认 suite；当前物理删除事实由 `slice-authorized-live-test-physical-delete` 单独记录，不属于 Slice 4 archive boundary 本体。
- 无 v22 前缀但仍有价值的 smoke 必须迁名或在台账中标明 archive/rewrite。
- completed on `cleanup/v22-legacy-scripts-archive-eval-shell`: `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs` verifies default README / vibe-coding commands, v22 MVP suite script references, and repo-zoning archive/review-rewrite rows without running live-test, deleting legacy scripts, touching services, or reading secrets.
- follow-up physical delete on `cleanup/v22-physical-legacy-batch-run`: `slice-authorized-live-test-physical-delete` physically deletes `scripts/live-test-*` after explicit user authorization; future real external canary must use a new v22 authorization contract and must not restore the old default entry.

## Slice 5: OpenCost and Langfuse Primary Narrative Retirement

目标：防止 OpenCost/Langfuse 恢复成主产品事实源。Langfuse 只能是 sanitized observability attachment，OpenCost 不能是当前主账单事实源。

建议 smoke/gate：

- `scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs`

检查要点：

- Langfuse 不是 Portal、billing、artifact 或 run 的 canonical source。
- `trace.medopl.cn` 只能作为后续 ops/observability surface。
- OpenCost 只作历史或后续授权运维参考，不是当前主账单事实源。
- OpenCost 旧脚本、旧 compose、旧 infra 不在 active repo 保留。
- 普通用户页面不把 OpenCost/Langfuse 展示成核心产品能力。
- completed by cleanup/v22-cleanup-completion-truth：`scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs` 已证明 Langfuse 只能是 sanitized observability attachment，OpenCost 不得恢复为主产品事实源；strict monolith cleanup 删除旧 OpenCost/Langfuse compose/deploy/infra 资产。

## Gate Pattern

每个专题 gate 应至少包含：

1. 正向检查：v22 替代路径仍存在。
2. 负向检查：旧术语、旧入口或旧默认值不再出现在目标范围。
3. 依赖检查：默认 suite、导航、route 或 docs 不再指向被清退路径。
4. 授权检查：不得触碰 Zone 4，不得读 secret，不得执行真实云、kubectl、build/push 或 live-test。

## Current Hold Points

- cloud-lane 仍在开发，清退线暂不修改 `docs/recovery/cloud-onboarding-*`、cloud-lane v22 smoke suite 或 Portal cloud operation handler。
- portal 分支仍在开发，清退线暂不修改 Portal UI/workbench/frontend implementation。
- 本 backlog 可以先合入 trunk；portal 和 cloud-lane 后续 rebase 只需要吸收 recovery 文档和独立 gate。
- 真正 delete 分支必须等 B review 判定相关 feature/cloud/portal 分支已吸收或放弃。
