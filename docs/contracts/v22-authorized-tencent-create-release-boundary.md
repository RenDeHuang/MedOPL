# v22 Authorized Tencent Create/Release Boundary

本合同定义 v22 `authorized Tencent create/release` 的授权边界。它描述 MedOPL 后续在用户明确授权后，如何把工作台资源计划映射到腾讯云资源创建、释放、记账和审计。

本合同只定义授权边界，不执行真实创建或释放；当前不得读取 secret，不调用真实腾讯云 API，不创建、绑定、释放真实资源，不真实扣费。

## Product Model

用户购买和管理的是“工作台资源”，不是云资源控制台对象。

用户可见套餐必须使用产品语言：

- 基础科研环境：2 核 / 4GB 内存 / 10GB 文件空间。
- 进阶科研环境：8 核 / 16GB 内存 / 100GB 文件空间。
- 自定义 CPU、内存、文件空间和并发数。

工作台资源展示字段包括：套餐、计算规格、文件空间、并发数、状态、预计费用、释放策略和审计状态。普通用户可以理解自己购买了多少计算和存储，但不得管理 CVM、COS、K8s、TKE、kubeconfig、bucket、object key、VPC 或安全组。

## Runtime Reuse

一个 workspace 可以开通一个托管运行环境。多个任务可以复用同一个托管运行环境。

`runId` 是任务级成本标签，可为空。纯 API 对话、文件空间保留、托管环境 idle、7 天保护期存储和 workspace 基础存储成本都可能没有单个 `runId`。无 `runId` 的成本必须至少绑定 `tenantId`、`workspaceId`、`resourceBindingId` 或 `environmentId`。

并发和队列必须作为套餐能力展示给用户：

- 基础科研环境默认 1 个运行任务。
- 进阶科研环境默认 2 个运行任务。
- 自定义环境按 CPU、内存、文件空间和并发数估算。

超过并发上限的任务进入队列，用户看到“排队中 / 等待资源 / 运行中 / 已完成 / 失败”等产品状态，不看到 Kubernetes scheduler 或节点池细节。

## Internal Tencent Mapping

内部真实执行阶段可以把工作台资源映射到：

- TKE shared cluster。
- namespace / quota。
- node pool class。
- COS 文件空间。
- COS prefix 是内部实现。
- 可选 CBS / CFS / pod ephemeral scratch，仅作为运行时内部实现，不作为用户购买的文件空间主叙事。

MVP 默认是平台共享 TKE 集群，多租户通过 namespace、quota、labels、network policy 和资源标签隔离。普通 CPU 任务可以共享通用 node pool class；GPU 或高规格环境可映射到独立 node pool class；专属节点池属于后续高级隔离套餐。

## Create/Release State Machine

授权创建和释放必须使用稳定状态机：

计划中 -> 待授权 -> 准备中 -> 可用 -> 释放中 -> 已释放

失败态：

- 准备失败待处理。
- 释放失败待审计。

进入真实创建前必须满足：

- 用户明确授权。
- 余额、冻结金额或 quota 满足本次计划。
- `resourceBindingId`、`environmentId`、`tenantId`、`workspaceId`、`serverPlanId` 和 `resourceOrderId` 已确定。
- readonly quote 和 dry-run plan 已生成。
- secret boundary 已授权，且 SecretId / SecretKey / kubeconfig 只进入后端 secret boundary。
- billing tags 完整。

缺少任一条件必须阻断真实创建，不能使用默认值、隐式兜底或历史任务推断。

## Billing Tags

所有真实腾讯云资源必须带 MedOPL 分账标签。当前 T+1 账单标签集合为：

```json
{
  "resourceOrderId": "order id",
  "runId": "run id or null",
  "serverPlanId": "starter_2c4g_10gb or pro_8c16g_100gb or custom",
  "tenantId": "tenant id",
  "workspaceId": "workspace id",
  "resourceBindingId": "resource binding id",
  "environmentId": "environment id"
}
```

`runId` 可以为空，但 `tenantId`、`workspaceId`、`resourceBindingId` 和 `environmentId` 不得为空。标签缺失、标签与 resource binding 不一致、或资源无法归属到 tenant/workspace 时，真实 create path 必须阻断或进入审计失败。

T+1 账单用于对账和审计，不作为实时扣费来源。Portal 实时展示仍以费用估算、余额、冻结金额和预计消耗为准。T+1 结果只能用于账单校准、异常审计、补扣或退还依据。

## Authorized Plan Shape

后续授权执行前，Portal / 运维审计可以消费的计划对象必须保持业务字段边界：

```json
{
  "workspaceResource": {
    "planName": "进阶科研环境",
    "cpuCores": 8,
    "memoryGb": 16,
    "fileSpaceGb": 100,
    "concurrency": 2
  },
  "createReleaseState": "待授权",
  "billingTags": {
    "resourceOrderId": "order id",
    "runId": null,
    "serverPlanId": "pro_8c16g_100gb",
    "tenantId": "tenant id",
    "workspaceId": "workspace id",
    "resourceBindingId": "resource binding id",
    "environmentId": "environment id"
  },
  "fileSpacePolicy": {
    "storageModel": "workspace 文件空间",
    "retentionDays": 7,
    "ordinaryDeleteRequiresConfirmation": false,
    "permanentDeleteRequiresConfirmation": true
  }
}
```

该对象不得包含真实云资源 ID、CVM 实例、COS bucket、TKE 集群、kubeconfig、objectKey、signedUrl 或 secret。

## File Space Contract

文件空间和运行环境生命周期分离。

运行环境释放后，文件空间可以继续保留。文件空间属于 workspace，不属于单个 run；输出文件可以带 `runId`，但仍进入 workspace 文件空间。

Portal 文件空间必须支持：

- 创建文件夹。
- 重命名文件夹。
- 删除文件夹。
- 上传文件到指定文件夹。
- 移动文件或文件夹。
- 选择文件作为 OPL 对话或任务输入。
- 批量下载。
- 批量删除。
- 查看输入文件和输出文件来源。

内部可以用 COS prefix 表达文件夹；普通用户 payload 不得暴露 COS bucket、objectKey、storageKey、localPath、signedUrl 或 provider 内部存储字段。

## Delete And Retention Policy

普通删除不需要二次确认。删除后文件进入 7 天保护期，Portal 必须提示：

- 删除后 7 天内可恢复或联系平台处理。
- 7 天后自动清理，不可恢复。
- 保护期内文件仍可能占用文件空间容量或产生存储费用。

永久删除或清空文件空间需要二次确认。永久删除和清空属于高风险操作，必须写入审计记录。

删除和清理是异步动作。Portal 可以展示“待清理 / 清理中 / 已删除 / 清理失败待审计”，不得承诺秒级物理删除。

## Release Semantics

释放托管运行环境不等于立即删除文件。

释放流程必须：

1. 检查是否存在运行中任务。
2. 如有运行中任务，提示先停止任务或等待任务结束。
3. 停止新任务进入环境。
4. 释放计算资源。
5. 停止计算计费。
6. 文件进入保留、保护或清理策略。
7. 写入 T+1 对账和审计记录。

释放失败必须进入“释放失败待审计”，并保留 resourceBindingId、environmentId、billing tags、失败原因和人工处理入口。

## Secret Boundary

SecretId / SecretKey / kubeconfig 只进入后端 secret boundary。不得进入：

- Portal payload。
- 前端状态。
- URL。
- 日志。
- evidence。
- git。
- GitHub。
- one-person-lab upstream。

真实执行必须另开 feat/* 并单独授权。授权必须明确允许读取哪个 secret 边界、调用哪些腾讯云 API、创建或释放哪些资源、验证范围是什么。

## Forbidden User-Facing Language

普通用户主界面不得把 CVM、COS、K8s、TKE、Kubernetes、节点池、kubeconfig、bucket、object key、VPC 或安全组作为主要操作语言。

允许的用户语言包括：工作台资源、托管运行环境、计算规格、文件空间、文件夹、输入文件、输出文件、预计费用、余额、冻结金额、并发数、队列、释放策略、保护期、审计状态。

## Non-Goals

- 不读取真实 SecretId、SecretKey、kubeconfig、token、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不创建、绑定、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux`、adapters 或 upstream。
- 不改变 Portal 已有 mock/snapshot、readonly quote 和 dry-run plan 实现。
