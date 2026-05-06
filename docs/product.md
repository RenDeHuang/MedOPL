# MedOPL v22 Product

MedOPL v22 是面向小白科研用户的 `platform-provisioned / customer-dedicated` 托管 OPL 工作台，不是云资源控制台。用户通过 `portal.medopl.cn` 管理账号、充值、API key 绑定、runtime 开通、资源套餐、workspace、账单和文件状态，通过 `opl.medopl.cn` 使用 clean upstream OPL Web 工作。

## 当前产品定位

- 用户不需要懂 CVM、COS、K8s。
- 用户不直接配置云资源。
- 平台管理自己的 TKE 和存储资源池。
- 租户可以选择开通托管 runtime、计算和存储资源。
- 平台负责开通、隔离、计费、审计、冻结保护、释放和清理。

## Runtime 开通模型

runtime 是租户可选开通能力，不是默认强制提供。

- 已开通 runtime 的租户可以使用平台托管 runtime 跑任务。
- 未开通 runtime 的租户可以拥有账号、充值、绑定 API key、查看 Portal 状态，但不能跑托管 runtime 任务。
- runtime、compute、storage 都必须绑定到租户头上，并进入 billing、quota、audit 边界。

## API Token 业务

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。用户绑定 API key 时，raw API key 只能进入后端密钥边界。前端最多保留一次性输入态、`providerKeyRef` 和 bound status。

前端不能把 raw API key、bearer token、launchToken、runtimeToken 写入 sessionStorage、localStorage、global JS state、log、evidence 或 git。

## 资源套餐

默认基础套餐：

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

扩展能力：

- 叠加计算资源。
- 叠加存储容量。
- 自定义套餐。

所有叠加和自定义资源都必须进入 billing、quota、audit 边界，不能描述成用户自己配置 CVM、COS、K8s。

## 资源绑定

开通 runtime、compute、storage 后，每个资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

Portal 必须能展示租户的 runtime、计算、存储、workspace 和资源绑定状态。

## 核心用户 loop

1. 平台创建一个用户或租户用户。
2. 给用户或租户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户绑定 gflabtoken API key。
5. 用户选择是否开通托管 runtime。
6. 如开通，用户选择基础套餐、叠加资源或自定义套餐。
7. 平台在自己的 TKE/存储资源池里给租户开通对应资源。
8. Portal 展示租户的 runtime、计算、存储、workspace 和资源绑定状态。
9. 开通资源后开始预扣费或冻结金额。
10. 用户进入 `opl.medopl.cn`，通过 clean upstream OPL Web 工作。
11. 用户可以发送消息、上传文件、跑任务、下载输出文件。
12. Portal 可以看到 workspace 文件、账单和 session trace metadata。
13. 如果余额不足，Portal 提示将消耗冻结金额。
14. 冻结保护期是 7 天；7 天后清理对应数据和资源。
15. 用户删除或释放资源后，扣费停止。

## Trace Metadata

v22 只定义 trace metadata boundary。Portal 只保留必要元数据用于轨迹跟踪、审计和排障，不泄露 raw prompt、API key、secret、token 或可还原敏感内容。

Langfuse 可以作为后续 trace metadata 来源，但不是当前主产品叙事。Langfuse 具体接入后续单独设计。

## Upstream OPL

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码。upstream 更新后，平台拉取更新，并通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。
