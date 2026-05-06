# platform-v22 Recovery Decisions

本文档记录 platform-v22 canonical trunk 的当前决策。

## D001: platform-v22 是 MedOPL canonical trunk

platform-v22 是 MedOPL 托管 OPL 科研工作台的 canonical trunk。正式产品语义、正式入口和正式合同以 v22 为准。

## D002: MedOPL 不是云资源控制台

MedOPL 面向小白科研用户。用户通过 Portal 和 OPL Web 使用托管科研工作台，不需要懂 CVM、COS、K8s，也不直接配置云资源。

## D003: 平台管理 TKE 和存储资源池

平台管理自己的 TKE 和存储资源池。runtime、compute、storage 是平台向租户提供的托管能力，不是用户自配云资源。

## D004: Runtime 是租户可选开通能力

托管 runtime 不是默认强制提供。租户开通 runtime 后才能使用平台托管 runtime 跑任务；租户不开通 runtime 时，可以有账号、充值、绑定 API key，但不能跑托管 runtime 任务。

## D005: 所有资源必须绑定租户和治理边界

runtime、compute、storage 必须绑定到 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。v22 不允许无归属资源。

## D006: 默认套餐和扩展能力固定进入 v22 truth

v22 默认基础套餐是：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

v22 支持叠加计算、叠加存储和自定义套餐。所有叠加和自定义资源都必须进入 billing、quota、audit 边界。

## D007: API token 业务使用 gflabtoken 中转站

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。raw API key 只能进入后端密钥边界；前端最多保留一次性输入态、`providerKeyRef` 和 bound status。

## D008: 前端不得持久化密钥和运行 token

raw API key、bearer token、launchToken、runtimeToken 不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git。

## D009: one-person-lab upstream 必须保持 clean

one-person-lab upstream 地址是：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。

## D010: 主链路固定

v22 主链路是：

```text
Portal -> OPL Web Gateway -> clean upstream OPL Web -> Portal OPL Adapter / Runtime Agent -> platform-managed TKE/storage resource pools -> Billing/Quota/Audit/Admin
```

## D011: 核心用户 loop 固定

v22 用户 loop 包括账号/租户创建、充值、登录 `portal.medopl.cn`、绑定 gflabtoken API key、选择是否开通 runtime、选择套餐、平台开通资源、预扣费或冻结金额、进入 `opl.medopl.cn` 工作、查看文件/账单/session trace metadata、余额不足提示、7 天冻结保护、释放后停止扣费。

## D012: Billing freeze 是产品边界

开通资源后开始预扣费或冻结金额。余额不足时，Portal 提示将消耗冻结金额。冻结保护期是 7 天；7 天后清理对应数据和资源。用户删除或释放资源后，扣费停止。

## D013: Trace 只保留必要 metadata

Portal 可以保留必要 session trace metadata 用于轨迹跟踪、审计和排障。metadata 不能泄露 raw prompt、API key、secret、token 或可还原敏感内容。

## D014: Langfuse 不是当前主产品叙事

Langfuse 可以作为后续 trace metadata 来源，但当前 v22 主线只定义 trace metadata boundary。Langfuse 具体接入必须后续单独设计。

## D015: spike 探索，feat 落地

想法不确定时开 `spike/*`。方向确定后，从 v22 trunk 新开 `feat/*` 干净重落。`main` 和 `recovery/*` trunk 不接收半成品探索。

## D016: 每次 pivot 必须带 cleanup/delete 计划

路线替换不能只新增新路径。每次 pivot 必须写明旧入口、旧文档、旧测试、旧脚本或旧配置如何处理，并通过 `cleanup/*` 删除、迁移或归档被替代路径。

## D017: 一个核心域只能有一个正式入口

Portal、OPL Web Gateway、clean upstream OPL Web、Portal OPL Adapter / Runtime Agent、platform-managed TKE/storage resource pools、Billing/Quota/Audit/Admin 各自承担唯一正式入口。并行入口只能用于探索，不能进入 v22 trunk。

## D018: 未授权不执行真实资源操作

普通文档收敛、本地检查和代码重构不得运行 build/push、kubectl、live-test、真实云资源操作，也不得修改 `.sentrux/*`。这些动作必须单独授权。

## D019: 现有仓库按域分类，不把旧文件当垃圾

platform-v22 不是空仓。现有文件必须先按域裁定为 `keep`、`migrate`、`delete` 或 `archive`，再进入后续 cleanup。盘点和分类不等于删除或搬目录。

## D020: v22 可继续使用的 canonical 主干

以下现有路径是 v22 可继续使用的主干：

- Identity / Auth / Tenant：Portal auth、provider secret、tenant scope、store schema 和 OPL Gateway auth bridge。
- Portal Web：Portal frontend router/layout/views，以及 Portal API、OPL launch、lab package、workspace storage routes。
- OPL Web Gateway：`services/opl-web-gateway/src/*`。
- OPL Adapter / Runtime Agent：`services/opl-runtime-bridge/src/server.mjs`、launch/run/message/state-store/provider-secret/ACP runtime 相关模块。
- Workspace / Artifact：workspace storage domain、routes、upload/download handlers 和 internal file index。
- Session / Run：OPL launch service、session trace payload/domain、runtime run/message/artifact trace stores。
- Billing / Usage / Freeze：wallet ledger、lab billing policy、billing payload/client/frontend、billing aggregator。
- Resource Plan / Tenant Binding：server plans、platform-provisioned resources、user resource bindings、resource views。
- Admin / Ops：admin routes、admin payloads 和 admin frontend views。
- Scripts / Contracts：`docs/contracts/v22-*.md` 和直接验证 v22 billing/resource/tenant/freeze 边界的 smoke contracts。

## D021: user_owned 只能是 legacy alias

`PRODUCT_RUNTIME_MODE=user_owned`、`user-owned` 路由、`user-owned` domain/store 和所有带 user-owned 的脚本只能作为 legacy alias 或历史合同参考。新代码、新文档、新测试和默认产品叙事不得把它解释成用户自带 CVM、COS、K8s 或用户配置云资源。

## D022: 旧 resource-order/provisioner 路线必须迁移或归档

`resource-order*`、`resource-provisioner-client` 和旧 provisioning service 有迁移价值，但不能继续作为 v22 正式产品入口。它们必须收敛到 tenant resource binding、billing account、quota、audit tag / cost allocation tag 语义。

## D023: 旧 runner/provisioner/K8s/OpenCost/Langfuse 不进入 v22 主线

`adapters/med-autoscience-runner/`、`adapters/resource-provisioner/`、旧 K8s Job/RBAC/manifests、OpenCost、Langfuse 全栈部署和相关 live scripts 只能作为 legacy/reference 或单独授权的旧栈审查对象。它们不进入 v22 主产品叙事。

## D024: Deploy 和 live scripts 只能作为授权边界内资产

`deploy/tke-package` 的核心 manifests 和 render scripts 可以作为 v22 交付参考，但 build/push、kubectl、live-test 和真实云资源操作必须单独授权。历史 rendered 包、compose 旧栈、runner/provisioner Dockerfile 和 live-test 脚本不作为普通本地验证入口。

## D025: delete 是后续 cleanup 目标

本次分类中的 `delete` 表示后续 cleanup/delete 计划目标，不表示当前删除文件。任何删除必须在单独 cleanup 分支中执行，并证明 v22 只剩一个正式入口。
