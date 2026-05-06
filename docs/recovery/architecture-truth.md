# platform-v22 Architecture Truth

platform-v22 的架构真相是：Portal 提供托管科研工作台控制面，OPL Web Gateway 接入 clean upstream OPL Web，Portal OPL Adapter / Runtime Agent 连接平台管理的 TKE/存储资源池，并把所有 runtime、compute、storage 纳入 tenant binding、billing、quota、audit 和 admin 边界。

## 架构定位

MedOPL 是 `platform-provisioned / customer-dedicated` 托管科研工作台，不是云资源控制台。用户不直接配置 CVM、COS、K8s。平台管理自己的 TKE 和存储资源池，向租户提供可选开通的托管 runtime、计算和存储能力。

## 主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Portal OPL Adapter / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## 边界职责

### Portal

Portal 是 SaaS 控制面，负责用户和租户、充值、API key 绑定状态、runtime 开通选择、资源套餐、workspace 状态、账单、冻结金额、审计和管理员治理。

Portal 展示的是托管科研工作台资源状态，不展示云资源控制台式 CVM/COS/K8s 配置界面。

### OPL Web Gateway

OPL Web Gateway 是 `opl.medopl.cn` 的正式入口。它把平台身份、workspace 上下文、runtime availability、resource binding 和 adapter 接入传给 upstream OPL Web，不把 Portal 逻辑写进 upstream。

### clean upstream OPL Web

one-person-lab upstream OPL Web 必须保持 clean：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。upstream 更新后，平台拉取更新，并通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。

### Portal OPL Adapter / Runtime Agent

Portal OPL Adapter / Runtime Agent 是运行集成边界。它只能在租户已开通 runtime 且资源绑定有效时调度托管 runtime 任务。

它负责：

- 校验 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。
- 连接 platform-managed TKE/storage resource pools。
- 记录 run status、artifact index 和必要 session trace metadata。
- 阻止未开通 runtime 的租户运行托管 runtime 任务。

### Platform Resource Pools

平台资源池由平台管理，包括 TKE 和存储资源池。runtime、compute、storage 以托管能力形式分配给租户，不暴露为用户自配云资源。

默认基础套餐：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

叠加计算、叠加存储和自定义套餐都必须进入 billing、quota、audit 边界。

### Billing/Quota/Audit/Admin

Billing/Quota/Audit/Admin 是资源治理边界。开通 runtime、compute、storage 后开始预扣费或冻结金额。余额不足时，Portal 必须提示将消耗冻结金额。冻结保护期是 7 天；7 天后清理对应数据和资源。用户删除或释放资源后，扣费停止。

## Token Provider Boundary

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

raw API key 只能进入后端密钥边界。前端最多保留一次性输入态、`providerKeyRef` 和 bound status，不能把 raw API key、bearer token、launchToken 或 runtimeToken 写入 sessionStorage、localStorage、global JS state、log、evidence 或 git。

## Trace Metadata Boundary

Portal 可以保留 session trace metadata，用于轨迹跟踪、审计和排障。metadata 不能包含 raw prompt、API key、secret、token 或可还原敏感内容。

Langfuse 只作为后续可能的 trace metadata 来源，不是当前 v22 主产品叙事。具体接入必须单独设计。

## 单入口规则

一个核心域只能有一个正式入口：

- 用户和租户控制面：Portal。
- OPL Web 工作入口：OPL Web Gateway。
- Upstream OPL：clean upstream OPL Web 公开边界。
- 运行集成：Portal OPL Adapter / Runtime Agent。
- 资源能力：platform-managed TKE/storage resource pools。
- 治理能力：Billing/Quota/Audit/Admin。

任何第二入口、新旧双入口或并行主路径只能存在于 `spike/*`，不能进入 v22 trunk。进入 `feat/*` 前必须收敛为一个正式入口。

## 操作边界

未获单独授权时，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。普通文档收敛和本地验证不能顺手触发真实资源动作。
