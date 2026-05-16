# MedOPL v22 Architecture

MedOPL v22 架构围绕 One Person Lab 的开箱即用 SaaS 托管科研工作台组织，采用 `platform-provisioned / customer-dedicated` 产品语义，不是云资源控制台，也不是用户自配云资源。用户在 Portal 和 OPL Web 中使用科研工作台；平台在后台管理 TKE 和存储资源池。

## Canonical Chain

```text
Portal -> OPL Web Gateway -> clean One Person Lab upstream
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## Runtime Gate

runtime 是租户可选开通能力。Runtime Bridge / Runtime Agent 在调度托管 runtime 任务前必须确认：

- tenant 已开通 runtime。
- user 属于该 tenant。
- workspace 属于该 tenant/user。
- resource binding 有效。
- billing account 可用。
- audit tag / cost allocation tag 存在。

未开通 runtime 的租户不能跑托管 runtime 任务。

## Resource Pools

平台管理自己的 TKE 和存储资源池。资源池不作为用户可直接配置的 CVM/COS/K8s 暴露，不形成用户自配云资源入口。

默认基础套餐：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

叠加计算、叠加存储和自定义套餐都必须进入 billing、quota、audit 边界。

## Resource Binding

每个 runtime、compute、storage 资源必须有完整绑定：

```text
tenant
user
workspace
resource binding
billing account
audit tag / cost allocation tag
```

资源生命周期包括开通、展示、预扣费或冻结金额、余额不足提示、7 天冻结保护、清理、释放和停止扣费。

## Token Provider Boundary

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

raw API key 只能进入后端密钥边界。前端最多保留一次性输入态、`providerKeyRef` 和 bound status。前端不得持久化 raw API key、bearer token、launchToken 或 runtimeToken。

## Upstream Boundary

One Person Lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码，不 import upstream 内部模块，不在 upstream 目录写 Portal、Gateway 或 Runtime Bridge 代码。upstream 更新后，平台拉取并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 适配。

## Trace Metadata Boundary

Portal 可以保留必要 session trace metadata，用于轨迹跟踪、审计和排障。metadata 不包含 raw prompt、API key、secret、token 或可还原敏感内容。

Langfuse 只作为后续可能的 trace metadata 来源，不是当前主产品叙事。

## Operation Boundary

未获单独授权时，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。
