# OPL SaaS Vibe Coding 工作约定

本文档定义 platform-v22 的日常开发分支、探索、落地和清理规则。platform-v22 是 MedOPL OPL SaaS 的新 canonical trunk；platform-v21 是 legacy recovery/reference worktree，仅用于按域取证、迁移判断和边界校验。

MedOPL 的当前产品主线是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 科研工作台。用户购买套餐、计算能力、存储容量和运行环境；平台负责开通、隔离、计费、审计和释放。

## Canonical Trunk

- platform-v22 是新的 canonical trunk，所有正式产品语义、正式文档和正式入口以 v22 为准。
- platform-v21 是 legacy recovery/reference worktree，不是继续叠加功能的主线，也不是整包搬迁来源。
- `main` 和 `recovery/*` 这类 trunk 线只接收已经收敛的正式变更，不接收半成品探索、脏实验或路线未定的代码。
- 一个核心域只能有一个正式入口。并行入口只能存在于 `spike/*` 探索中，不能进入 trunk。

## 分支规则

### 想法不确定时：开 `spike/*`

`spike/*` 用于验证形状、边界和产品判断。

示例：

- `spike/module-catalog-shape`
- `spike/session-run-ui`
- `spike/billing-plan-model`

`spike/*` 可以快，可以脏，可以丢弃。`spike/*` 的结论必须被整理成明确判断后，才能通过新的 `feat/*` 干净落地。`spike/*` 不直接合并进 platform-v22 trunk。

### 方向确定后：从 v22 trunk 开 `feat/*`

`feat/*` 用于正式落地一个已经明确的产品意图。

示例：

- `feat/session-run-timeline`
- `feat/workspace-artifact-browser`
- `feat/billing-plan-v1`

一个 `feat/*` 可以跨前端、后端、文档和测试，但只能服务一个产品意图。`feat/*` 必须从最新 v22 trunk 新开，并以当前主线边界重落，不从旧 worktree 整包复制。

### 路线替换时：必须跟 `cleanup/*`

任何 pivot 都必须同时带 cleanup/delete 计划。路线替换不能只新增新入口、新模型或新链路，也必须删除或归档被替代路径。

示例：

- `feat/platform-provisioned-resource-model`
- `cleanup/remove-user-owned-primary-path`

cleanup 计划必须写清楚：

- 被替代的入口、文档、测试、脚本或配置。
- 哪些内容删除，哪些内容迁移，哪些内容只归档为参考。
- trunk 合入前如何证明只剩一个正式入口。

## v21 资产处理规则

旧 v21 内容不能整包搬进 v22，只能按域裁定：

- `keep`：符合 v22 主线，可以重落或迁入。
- `migrate`：有价值，但必须改边界、命名或合同后进入 v22。
- `delete`：属于旧路线，不进入 v22。
- `archive`：只保留为历史参考，不参与产品主线。

裁定必须基于当前 v22 产品真相：平台开通、客户专属隔离、平台计费审计、clean upstream OPL、Portal/Gateway/Adapter/Runtime Agent 公开边界。

## 禁止事项

- 不把 `user_owned` 解释成用户自带 CVM、COS、K8s 或用户配置云资源；它只能作为 legacy alias。
- 不把旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 扩散成 v22 主产品叙事。
- 不修改 one-person-lab upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。
- 不把 raw provider API key、bearer token、launchToken、runtimeToken 写入前端持久化、全局 JS state、日志、evidence 或 git。
- 未经单独授权，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。

## 合入标准

进入 platform-v22 trunk 的变更必须满足：

- 产品叙事与 `platform-provisioned / customer-dedicated` 一致。
- 主链路保持 `Portal -> OPL Web Gateway -> clean upstream OPL Web -> Portal OPL Adapter / Runtime Agent -> platform-provisioned compute/storage/runtime -> Billing/Audit/Admin`。
- 每个核心域只有一个正式入口。
- spike 结论已经通过 `feat/*` 干净重落。
- pivot 已经带 cleanup/delete 计划。
- 旧 v21 资产已经按 `keep`、`migrate`、`delete`、`archive` 裁定。
- 验证只运行本次授权范围内的本地检查。
