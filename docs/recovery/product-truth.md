# platform-v22 Product Truth

platform-v22 是 MedOPL 的 canonical trunk。本文件只记录当前 v22 产品真相。

## 产品定位

MedOPL 是面向小白科研用户的 `platform-provisioned / customer-dedicated` 托管 OPL 工作台，不是云资源控制台。用户通过 Portal 购买和使用科研工作台能力，不需要懂 CVM、COS、K8s，也不直接配置云资源。

平台管理自己的 TKE 和存储资源池。用户或租户可以选择开通托管 runtime、计算和存储资源；平台负责资源开通、租户隔离、计费、审计、释放和清理。

## Runtime 是租户可选能力

托管 runtime 不是默认强制提供能力。

- 租户开通 runtime 后，才能使用平台托管 runtime 跑任务。
- 租户不开通 runtime 时，可以有账号、充值、查看 Portal 状态和 OPL entry/preflight provider key 绑定状态，但不能跑托管 runtime 任务。
- runtime、compute、storage 都必须绑定到租户名下，不能存在无归属资源。

## 当前主链路

```text
Portal
  -> OPL Web Gateway
  -> clean upstream OPL Web
  -> Portal OPL Adapter / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## Upstream OPL

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码。upstream 更新后，平台拉取更新，并通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。

## API Token 业务

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。portal.medopl.cn 登录不需要 gflabtoken API Key。opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。

Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。raw API Key 只能进入后端密钥边界；前端最多保留一次性输入态、`providerKeyRef` 和 bound status。raw API Key、bearer token、launchToken、runtimeToken 不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git，不能返回前端、不能写日志、不能进 git。

## 资源套餐

默认基础套餐：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

扩展能力：

- 可以叠加计算资源。
- 可以叠加存储容量。
- 可以自定义套餐。
- 所有叠加和自定义资源都必须进入 billing、quota、audit 边界。
- 资源套餐不能描述成用户自己配置 CVM、COS、K8s。

## 资源绑定

开通 runtime、compute、storage 后，所有资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

## 核心用户 loop

1. 平台创建一个用户或租户用户。
2. 给用户或租户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户进入 `opl.medopl.cn`；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
5. API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。
6. 用户选择是否开通托管 runtime。
7. 如开通，用户选择基础套餐、叠加资源或自定义套餐。
8. 平台在自己的 TKE/存储资源池里给租户开通对应资源。
9. Portal 展示租户的 runtime、计算、存储、workspace 和资源绑定状态。
10. 开通资源后开始预扣费或冻结金额。
11. 用户通过 clean upstream OPL Web 工作。
12. 用户可以发送消息、上传文件、跑任务、下载输出文件。
13. Portal 可以看到 workspace 文件、账单和 session trace metadata。
14. 如果余额不足，Portal 提示将消耗冻结金额。
15. 冻结保护期是 7 天；7 天后清理对应数据和资源。
16. 用户删除或释放资源后，扣费停止。

## Trace Metadata

v22 主线只定义 trace metadata boundary。Portal 只保留必要元数据用于轨迹跟踪、审计和排障，不泄露 raw prompt、API key、secret 或 token。

Langfuse 可以作为后续 session trace metadata 来源，但不是当前主产品叙事。Langfuse 具体接入必须后续单独设计。

## 非主线内容

- `user_owned` 只能作为 legacy alias，不能在新代码、新文档、新测试和默认产品叙事中解释成用户自带云资源。
- 旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 不是 platform-v22 主产品叙事。
- 这些旧资产不进入 v22 主产品叙事，只能在单独授权下作为旧栈审查对象或迁移参考。
