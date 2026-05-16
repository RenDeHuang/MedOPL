# MedOPL v22 Product

MedOPL v22 是 One Person Lab 的开箱即用 SaaS 托管科研工作台，面向 AI 小白科研用户，采用 `platform-provisioned / customer-dedicated` OPL SaaS 产品语义，不是云资源控制台，不是用户自配云资源。用户通过 `portal.medopl.cn` 登录账号，查看余额、充值状态、计算资源、套餐、工作空间、文件空间、账单、文件状态和 gflabtoken 模型调用密钥已绑定/未绑定状态；Portal 普通登录和普通入口不输入 gflabtoken API Key。用户从 Portal “进入 OPL 工作台”或访问 `/opl/entry/preflight`，输入或确认 gflabtoken API Key，并进入 clean One Person Lab upstream OPL Web 工作。

## 当前产品定位

- 用户不需要懂 CVM、COS、K8s。
- 用户不直接配置云资源，不走用户自配云资源默认路径。
- 平台管理自己的 TKE 和存储资源池。
- 用户可以选择套餐、计算资源和文件空间。
- 平台负责开通、隔离、计费、审计、冻结保护、释放和清理。
- 普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。
- 租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## 工作台资源开通模型

工作台资源是用户可选开通能力，不是默认强制提供。

- 已开通计算资源且文件空间可用的用户可以使用 OPL 工作台跑任务。
- 未开通计算资源的用户可以拥有账号、充值、查看 Portal 状态，并可在 OPL entry/preflight 完成或确认 gflabtoken 模型调用密钥绑定状态，但不能跑托管计算任务。
- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。
- 套餐、计算资源和文件空间都必须绑定到 tenant、user、workspace、resource binding、billing account 和 audit 边界。

## API Token 业务

MedOPL 的 OpenAI-compatible API 中转站 base URL 是：

```text
https://gflabtoken.cn/v1
```

商业目标之一是销售 token/API 使用额度。gflabtoken.cn 网站本身不进入 MedOPL 用户主流程；MedOPL 只使用用户提供的 gflabtoken API Key。`portal.medopl.cn` 登录不需要 gflabtoken API Key；Portal 只展示 gflabtoken 模型调用密钥已绑定/未绑定状态，不提供普通登录或普通入口输入。`opl.medopl.cn` entry/preflight 需要输入或确认 gflabtoken API Key；已绑定时显示“已绑定”，不要求重复输入。raw API Key 只能进入后端密钥边界。前端最多保留一次性输入态、`providerKeyRef` 和 bound status。

前端不能把 raw API Key、bearer token、launchToken、runtimeToken 写入 sessionStorage、localStorage、global JS state、log、evidence 或 git。

## 资源套餐

当前套餐：

| 套餐 | 计算资源 | 文件空间 | 任务并发 |
| --- | --- | --- | --- |
| 基础套餐 | 2c / 4GB | 10GB 文件空间 | 1 个任务并发 |
| Pro 套餐 | 8c / 16GB | 100GB 文件空间 | 2 个任务并发 |

扩展能力：

- 叠加计算资源。
- 叠加存储容量。
- 自定义规格：CPU、内存、文件空间和任务并发数。

所有叠加和自定义资源都必须进入 billing、quota、audit 边界，不能描述成用户自己配置 CVM、COS、K8s。

## 资源绑定

开通计算资源和存储资源后，每个资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

Portal 必须能展示用户的计算资源、套餐、工作空间、文件空间、账单和 gflabtoken 模型调用密钥已绑定/未绑定状态。

## 核心用户 loop

1. 平台创建一个账号。
2. 给账号充值额度。
3. 用户登录 `portal.medopl.cn`。
4. Portal 展示 gflabtoken 模型调用密钥已绑定/未绑定状态，但不提供普通登录或普通入口输入。
5. 用户在 `opl.medopl.cn` entry/preflight 输入或确认 gflabtoken API Key；已绑定时显示“已绑定”。
6. 用户选择是否开通计算资源和文件空间。
7. 如开通，用户选择基础套餐、Pro 套餐、叠加资源或自定义规格。
8. 平台在后台资源池里给用户准备可组合资源，计算资源与文件空间可独立保留或释放。
9. Portal 展示用户的计算资源、套餐、工作空间、文件空间和账单状态。
10. 开通后开始预扣费或冻结金额。
11. 用户从 Portal “进入 OPL 工作台”或 `/opl/entry/preflight` 进入 clean One Person Lab upstream OPL Web 工作。
12. 两条入口最终收敛到同一套 Gateway / preflight / launch 逻辑；one-person-lab 保持 clean upstream，不修改源码，不 import 内部模块。
13. 用户可以发送消息、上传文件、跑任务、下载输出文件。
14. Portal 可以看到工作空间文件、账单和 session trace metadata。
15. 如果余额不足，Portal 提示将消耗冻结金额。
16. 余额或冻结金额不足时，停止新任务和计算资源续用，但不得把释放计算资源自动写成删除文件空间。
17. 释放计算资源只停止计算计费和任务续用；删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
18. 文件空间进入保护期或不可用时，新任务不能依赖该文件空间。

## Trace Metadata

v22 只定义 trace metadata boundary。Portal 只保留必要元数据用于轨迹跟踪、审计和排障，不泄露 raw prompt、raw API Key、secret、token 或可还原敏感内容。

Langfuse 可以作为后续 trace metadata 来源，但不是当前主产品叙事。Langfuse 具体接入后续单独设计。

## Upstream OPL

One Person Lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

v22 不修改 upstream 源码。upstream 更新后，平台拉取更新，并通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和必要的内部 anti-corruption mapping 适配。
