# platform-v22 Recovery Decisions

本文档记录 platform-v22 canonical trunk 的当前决策。

## D001: platform-v22 是 MedOPL canonical trunk

platform-v22 是 MedOPL 托管 OPL 科研工作台的 canonical trunk。正式产品语义、正式入口和正式合同以 v22 为准。

## D002: MedOPL 不是云资源控制台

MedOPL 面向小白科研用户。用户通过 Portal 和 OPL Web 使用托管科研工作台，不需要懂 CVM、COS、K8s，也不直接配置云资源。

## D003: 平台管理 TKE 和存储资源池

平台管理自己的 TKE 和存储资源池。计算资源和文件空间是平台向账号工作空间提供的托管能力，不是用户自配云资源。普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## D004: 工作台资源是账号工作空间可选开通能力

计算资源和文件空间不是默认强制提供。账号在工作空间下开通计算资源且文件空间可用后，才能使用平台托管计算资源跑任务；未开通计算资源时，可以有账号、充值和 OPL entry/preflight provider key 绑定状态，但不能跑托管计算任务。

## D005: 所有资源必须绑定账号工作空间和治理边界

计算资源和存储资源必须绑定到 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。v22 不允许无归属资源。

## D006: 默认套餐和扩展能力固定进入 v22 truth

v22 套餐是：

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

v22 支持叠加计算、叠加存储和自定义规格。自定义规格支持 CPU、内存、文件空间和任务并发数。所有叠加和自定义资源都必须进入 billing、quota、audit 边界。

## D007: API token 业务使用 gflabtoken 中转站

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。portal.medopl.cn 登录不需要 gflabtoken API Key；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。API Key 输入框放在 OPL 登录页密码下面；已绑定用户可以看到“已绑定”，不要求重复输入。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。raw API Key 只能进入后端密钥边界；前端最多保留一次性输入态、`providerKeyRef` 和 bound status。

## D008: 前端不得持久化密钥和运行 token

raw API Key、bearer token、launchToken、runtimeToken 不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git，不能返回前端、不能写日志、不能进 git。

## D009: one-person-lab upstream 必须保持 clean

one-person-lab upstream 地址是：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway、Runtime Bridge 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 Gateway、Runtime Bridge、Runtime Agent、API/CLI 等公开边界适配。

## D010: 主链路固定

v22 主链路是：

```text
Portal -> OPL Web Gateway -> clean upstream OPL Web -> Runtime Bridge / Runtime Agent -> platform-managed TKE/storage resource pools -> Billing/Quota/Audit/Admin
```

## D011: 核心用户 loop 固定

v22 用户 loop 包括账号创建、充值、登录 `portal.medopl.cn`、在 `opl.medopl.cn` 登录 / 进入 OPL 工作台时输入或确认 gflabtoken API Key、选择是否开通计算资源和文件空间、选择基础套餐 / Pro 套餐 / 自定义规格、平台开通可组合资源、预扣费或冻结金额、进入 OPL 工作台工作、查看文件/账单/session trace metadata、余额不足提示、计算释放和文件空间保护期分离、释放计算资源后停止计算扣费。

## D012: Billing freeze 是产品边界

开通资源后开始预扣费或冻结金额。余额不足时，Portal 提示将消耗冻结金额。工作空间是业务容器。计算资源可独立开通、扩容、缩容、释放。存储资源 / 文件空间可独立开通、扩容、删除。释放计算资源不删除文件空间。释放计算资源不让文件空间进入 7 天保护期。删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。计算资源已释放但文件空间仍保留，是合法状态。文件空间进入保护期或不可用时，新任务不能依赖该文件空间。

## D013: Trace 只保留必要 metadata

Portal 可以保留必要 session trace metadata 用于轨迹跟踪、审计和排障。metadata 不能泄露 raw prompt、API key、secret、token 或可还原敏感内容。

## D014: Langfuse 不是当前主产品叙事

Langfuse 可以作为后续 trace metadata 来源，但当前 v22 主线只定义 trace metadata boundary。Langfuse 具体接入必须后续单独设计。

## D015: spike 探索，feat 落地

想法不确定时开 `spike/*`。方向确定后，从 v22 trunk 新开 `feat/*` 干净重落。`main` 和 `recovery/*` trunk 不接收半成品探索。

## D016: 每次 pivot 必须带 cleanup/delete 计划

路线替换不能只新增新路径。每次 pivot 必须写明旧入口、旧文档、旧测试、旧脚本或旧配置如何处理，并通过 `cleanup/*` 删除、迁移或归档被替代路径。

## D017: 一个核心域只能有一个正式入口

Portal、OPL Web Gateway、clean upstream OPL Web、Runtime Bridge / Runtime Agent、platform-managed TKE/storage resource pools、Billing/Quota/Audit/Admin 各自承担唯一正式入口。并行入口只能用于探索，不能进入 v22 trunk。

## D018: 未授权不执行真实资源操作

普通文档收敛、本地检查和代码重构不得运行 build/push、kubectl、live-test、真实云资源操作，也不得修改 `.sentrux/*`。这些动作必须单独授权。

## D019: 现有仓库按域分类，不把旧文件当垃圾

platform-v22 不是空仓。现有文件必须先按域裁定为 `keep`、`migrate`、`delete` 或 `archive`，再进入后续 cleanup。盘点和分类不等于删除或搬目录。

## D020: v22 可继续使用的 canonical 主干

以下现有路径是 v22 可继续使用的主干：

- Identity / Auth / Tenant：Portal auth、provider secret、tenant scope、store schema 和 OPL Gateway auth bridge。
- Portal Web：Portal frontend router/layout/views，以及 Portal API、OPL launch、lab package、workspace storage routes。
- OPL Web Gateway：`services/opl-web-gateway/src/*`。
- Runtime Bridge / Runtime Agent：`services/opl-runtime-bridge/src/server.mjs`、launch/run/message/state-store/provider-secret/ACP runtime 相关模块。
- Workspace / Artifact：workspace storage domain、routes、upload/download handlers 和 internal file index。
- Session / Run：OPL launch service、session trace payload/domain、runtime run/message/artifact trace stores。
- Billing / Usage / Freeze：wallet ledger、lab billing policy、billing payload/client/frontend、billing aggregator。
- Resource Plan / Tenant Binding：server plans、platform-provisioned resources、user resource bindings、resource views。
- Admin / Ops：admin routes、admin payloads 和 admin frontend views。
- Scripts / Contracts：`docs/specs/README.md` 和直接验证 v22 billing/resource/tenant/freeze 边界的 smoke contracts。

## D021: user_owned 不保留兼容别名

`PRODUCT_RUNTIME_MODE=user_owned`、`user-owned` 路由、`user-owned` domain/store 和所有带 user-owned 的脚本已被 strict monolith cleanup 裁定为删除目标。新代码、新文档、新测试和默认产品叙事不得把它解释成用户自带 CVM、COS、K8s、用户配置云资源或兼容入口。

## D022: 旧 resource-order/provisioner 路线必须迁移或归档

旧 `resource-order*`、`resource-provisioner-client` 和旧 provisioning service 不能继续作为 v22 正式产品入口。strict monolith cleanup 已物理删除旧 route/domain/store/schema/client wiring；后续如需资源开通能力，必须以 tenant resource binding、billing account、quota、audit tag / cost allocation tag 和 v22 cloud operation contract 重新建边界。

## D023: 旧 runner/provisioner/K8s/OpenCost/Langfuse 不进入 v22 主线

`adapters/med-autoscience-runner/`、`adapters/resource-provisioner/`、旧 K8s Job/RBAC/manifests、OpenCost、Langfuse 全栈部署和相关 live scripts 只能作为 legacy/reference 或单独授权的旧栈审查对象。它们不进入 v22 主产品叙事。

## D024: 旧 deploy 栈不得作为 active v22 交付参考

`deploy/tke-package`、旧 runner/provisioner manifests、旧 rendered 包、旧 compose 栈和旧 live-test 脚本已被 strict monolith cleanup 裁定为删除目标；git history 已足够保存历史。后续如果需要 v22 交付资产，必须在 active v22 Package D / deploy contract 下重新命名、重新建边界，并继续遵守 build/push、kubectl、live-test、真实云资源操作的单独授权要求。

## D025: delete 是后续 cleanup 目标

本次分类中的 `delete` 表示后续 cleanup/delete 计划目标，不表示当前删除文件。任何删除必须在单独 cleanup 分支中执行，并证明 v22 只剩一个正式入口。
