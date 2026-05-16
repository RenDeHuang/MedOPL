# platform-v22 Product Truth

platform-v22 是 MedOPL 的 canonical trunk。本文件只记录当前 v22 产品真相。

## 产品定位

MedOPL 是面向小白科研用户的 `platform-provisioned / customer-dedicated` 托管 OPL 工作台，不是云资源控制台。用户通过 Portal 购买和使用科研工作台能力，不需要懂 CVM、COS、K8s，也不直接配置云资源。

MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台。它不重做 OPL chatbot，不成为独立科研聊天产品；它把 clean upstream OPL 变成开箱即用、可购买、可管理、可计费、可审计、可释放的托管服务。用户购买的是托管 OPL 科研工作台服务，Portal 负责让用户知道自己买的是什么服务、工作台是否可用、还缺哪一步、下一步点哪里、文件/任务/结果在哪里，以及费用状态是否正常。

平台管理自己的 TKE 和存储资源池。账号可以在工作空间下选择套餐、计算资源和文件空间；平台负责资源开通、隔离、计费、审计、释放和清理。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## 工作台资源是可选能力

计算资源和文件空间不是默认强制提供能力。

- 账号在工作空间下开通计算资源且文件空间可用后，才能使用平台托管计算资源跑任务。
- 未开通计算资源时，账号可以充值、查看 Portal 状态和 OPL entry/preflight provider key 绑定状态，但不能跑托管计算任务。
- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 计算资源和存储资源都必须绑定到账号、工作空间和内部治理边界，不能存在无归属资源。

## 当前主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## Upstream OPL

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码。upstream 更新后，平台拉取更新，并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 适配。

## API Token 业务

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。portal.medopl.cn 登录不需要 gflabtoken API Key。opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。

Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。raw API Key 只能进入后端密钥边界；前端最多保留一次性输入态、`providerKeyRef` 和 bound status。raw API Key、bearer token、launchToken、runtimeToken 不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git，不能返回前端、不能写日志、不能进 git。

## 资源套餐

当前套餐：

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

扩展能力：

- 可以叠加计算资源。
- 可以叠加存储容量。
- 可以自定义规格：CPU、内存、文件空间和任务并发数。
- 所有叠加和自定义资源都必须进入 billing、quota、audit 边界。
- 资源套餐不能描述成用户自己配置 CVM、COS、K8s。

## 资源绑定

开通计算资源和存储资源后，所有资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

## 核心用户 loop

1. 平台创建一个账号。
2. 给账号充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户进入 `opl.medopl.cn`；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
5. API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。
6. 用户选择是否开通计算资源和文件空间。
7. 如开通，用户选择基础套餐、Pro 套餐、叠加资源或自定义规格。
8. 平台在自己的 TKE/存储资源池里开通可组合资源，计算资源与文件空间可独立保留或释放。
9. Portal 展示账号的计算资源、文件空间、工作空间和资源绑定状态。
10. 开通资源后开始预扣费或冻结金额。
11. 用户通过 clean upstream OPL Web 工作。
12. 用户可以发送消息、上传文件、跑任务、下载输出文件。
13. Portal 可以看到 workspace 文件、账单和 session trace metadata。
14. 如果余额不足，Portal 提示将消耗冻结金额。
15. 余额或冻结金额不足时，停止新任务和计算资源续用，但不得把释放计算资源自动写成删除文件空间。
16. 释放计算资源只停止计算计费和任务续用；删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
17. 文件空间进入保护期或不可用时，新任务不能依赖该文件空间。

## Trace Metadata

v22 主线只定义 trace metadata boundary。Portal 只保留必要元数据用于轨迹跟踪、审计和排障，不泄露 raw prompt、API key、secret 或 token。

Langfuse 可以作为后续 session trace metadata 来源，但不是当前主产品叙事。Langfuse 具体接入必须后续单独设计。

## 非主线内容

- `user_owned` 不保留为兼容入口；不能在新代码、新文档、新测试和默认产品叙事中解释成用户自带云资源。
- 旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 不是 platform-v22 主产品叙事。
- 这些旧资产不进入 v22 主产品叙事，只能在单独授权下作为旧栈审查对象或迁移参考。
