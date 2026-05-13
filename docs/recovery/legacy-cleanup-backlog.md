# MedOPL v22 Legacy Cleanup Backlog

本 backlog 从 `docs/recovery/repo-zoning.md` 的 Zone 2/Zone 3 候选中拆出后续专题清退队列。它不授权本分支删除、移动或修改实现。

## Execution Model

- cleanup 分支 1：建立裁定台账。
- cleanup 分支 2-N：按专题清退。
- 每个专题先定义 smoke/gate，再执行 rewrite、tombstone、archive 或 delete。
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
| 2 | user_owned Primary Path Retirement | `cleanup/v22-retire-user-owned-primary-path` | Zone 2 | tombstone/delete | 需先确认 Portal 当前 user-owned alias 是否仍被 smoke 引用。 |
| 3 | resource-order Primary Path Retirement | `cleanup/v22-retire-resource-order-primary-path` | Zone 2 | tombstone/delete | 需先确认 managed environment/resource binding 替代路径完整。 |
| 4 | Legacy Script Archive Boundary | `cleanup/v22-legacy-script-archive-boundary` | Zone 2/3 | archive/rewrite | 需避免和 cloud-lane 正在改的 v22 smoke suite 冲突。 |
| 5 | OpenCost and Langfuse Primary Narrative Retirement | `cleanup/v22-observability-billing-primary-narrative` | Zone 2/3 | rewrite/archive | 需保持 sanitized trace metadata boundary。 |
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

目标：把 `user_owned` / `user-owned` 收敛为 legacy alias 或 tombstone，禁止作为主产品路径继续扩写。

建议 smoke/gate：

- `scripts/smoke-test-v22-retire-user-owned-primary-path.mjs`

检查要点：

- Portal 默认配置不再是 `user_owned`。
- 普通用户页面不展示用户自配云资源。
- 新代码不得新增 `user-owned` route/domain/store 作为正式入口。
- 若旧 route 暂保留，只能返回 tombstone、removed 或 legacy alias，不做兼容翻译。

## Slice 3: resource-order Primary Path Retirement

目标：把 `resource-order` 从主产品叙事退场，开通路径收敛到 managed environment、resource binding、billing 和 audit。

建议 smoke/gate：

- `scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`

检查要点：

- Portal 导航不链接 `resource-order` 主路径。
- 新开通路径走 managed environment / resource binding。
- 旧 prepare-run 或 resource-order public flow 只能 tombstone 或 legacy internal fence。
- 新 smoke 不依赖 resource-order 作为默认成功路径。

## Slice 4: Legacy Script Archive Boundary

目标：让 v19/v20/v21/live-test 脚本从默认 AI 上下文退场，只作为历史证据或授权 canary 参考。

建议 smoke/gate：

- `scripts/smoke-test-v22-legacy-script-archive-boundary.mjs`

检查要点：

- MVP suite 只串 v22 默认 smoke。
- `scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/smoke-test-v21-*` 不进入默认 suite。
- `scripts/live-test-*` 必须标记为授权外部操作，不可默认运行。
- 无 v22 前缀但仍有价值的 smoke 必须迁名或在台账中标明 archive/rewrite。

## Slice 5: OpenCost and Langfuse Primary Narrative Retirement

目标：防止 OpenCost/Langfuse 恢复成主产品事实源。Langfuse 只能是 sanitized observability attachment，OpenCost 不能是当前主账单事实源。

建议 smoke/gate：

- `scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs`

检查要点：

- Langfuse 不是 Portal、billing、artifact 或 run 的 canonical source。
- `trace.medopl.cn` 只能作为后续 ops/observability surface。
- OpenCost 只作历史或后续授权运维参考，不是当前主账单事实源。
- 普通用户页面不把 OpenCost/Langfuse 展示成核心产品能力。

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
- 真正 delete/tombstone 分支必须等 B review 判定相关 feature/cloud/portal 分支已吸收或放弃。
