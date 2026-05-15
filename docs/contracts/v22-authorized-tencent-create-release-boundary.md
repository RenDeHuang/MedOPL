# v22 Authorized Tencent Create/Release Boundary

本合同定义 v22 `authorized Tencent create/release` 的授权边界。它描述 MedOPL 后续在用户明确授权后，如何把工作台资源计划映射到腾讯云资源创建、释放、记账和审计。

本合同只定义授权边界，不执行真实创建或释放；当前不得读取 secret，不调用真实腾讯云 API，不创建、绑定、释放真实资源，不真实扣费。

## Product Model

用户购买和管理的是“工作台资源”，不是云资源控制台对象。用户购买的是计算资源套餐和工作台能力，不是节点、节点池或云控制台资源。

用户可见套餐必须使用产品语言：

- 基础套餐：2c / 4GB / 10GB 文件空间，默认 1 个任务并发。
- Pro 套餐：8c / 16GB / 100GB 文件空间，默认 2 个任务并发。
- 自定义规格：CPU、内存、文件空间和任务并发数。

工作台资源展示字段包括：套餐、计算资源、文件空间、任务并发、状态、预计费用、释放策略和审计状态。普通用户可以理解自己购买了多少计算和存储，但不得管理 CVM、COS、K8s、TKE、kubeconfig、bucket、object key、VPC 或安全组。

普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额。租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段。

## Task Concurrency And Resource Reuse

一个工作空间可以绑定一组工作台资源。多个任务可以复用同一组计算资源。并发口径统一为任务并发，session 只是访问、运行或观测上下文，不是任务并发。

`runId` 是任务级成本标签，可为空。纯 API 对话、文件空间保留、计算资源 idle、7 天保护期存储和工作空间基础存储成本都可能没有单个 `runId`。无 `runId` 的成本必须在内部归属上完整绑定 `tenantId`、`workspaceId`、`resourceBindingId` 和 `environmentId`。

并发和队列必须作为套餐能力展示给用户：

- 基础套餐默认 1 个任务并发。
- Pro 套餐默认 2 个任务并发。
- 自定义规格按 CPU、内存、文件空间和任务并发数估算。
- 5 个必须写成任务并发，不是 session 并发。

超过并发上限的任务进入队列，用户看到“排队中 / 等待资源 / 运行中 / 已完成 / 失败”等产品状态，不看到 Kubernetes scheduler 或节点池细节。

## Internal Tencent Mapping

内部真实执行阶段可以把工作台资源映射到：

- TKE shared cluster。
- namespace / quota。
- node pool class。
- COS 文件空间。
- COS prefix 是内部实现。
- 可选 CBS / CFS / pod ephemeral scratch，仅作为运行时内部实现，不作为用户购买的文件空间主叙事。

MVP 默认使用已有平台共享 TKE 集群，不默认创建新 TKE 集群。多租户通过 namespace、quota、labels、network policy 和资源标签隔离。普通 CPU 任务可以共享通用 node pool class；GPU 或高规格环境可映射到独立 node pool class；专属节点池属于后续高级隔离套餐。

标准套餐使用共享用户计算池 + workspace namespace ResourceQuota / LimitRange / admission policy。`starter_2c4g_10gb`、`pro_8c16g_100gb` 和叠加计算默认都是 `shared_quota`：用户 A 和用户 B 可以在同一个共享用户计算池运行 workload，但必须落在各自 namespace、resourceBinding、quota、limit 和 admission policy 内。超过 compute allocation 的 workload 必须 fail-closed，不得自动扩容并由平台垫付，也不得借用其他用户 allocation。

计算升级必须先完成 Portal 套餐变更、冻结金额或余额校验、cloud operation 和审计记录，然后 Package C 才能更新 compute allocation、ResourceQuota / LimitRange / admission policy，并在需要时做池级容量补足。高级客户需要更强隔离时，专属计算池属于高级隔离套餐，内部 isolation mode 可以是 `dedicated_node_pool` 或 `dedicated_node`；普通用户仍看到“专属计算资源 / 高级隔离套餐”，不是节点池。

“加计算”必须明确为以下一种或多种授权动作，不能隐式推断：

- 提高 workspace namespace quota。
- 调整已授权 node pool desired capacity。
- 绑定更高 workload class。
- 追加已审查的计算资源绑定记录。

任何 TKE node pool 扩缩容、namespace/quota 变更或 kubectl/deploy 动作都是真实副作用，必须单独授权并串行执行。

## Create/Release State Machine

授权创建和释放必须使用稳定状态机：

计划中 -> 待授权 -> 准备中 -> 可用 -> 释放中 -> 已释放

失败态：

- 准备失败待处理。
- 释放失败待审计。

进入真实创建前必须满足：

- 用户明确授权。
- 余额、冻结金额或 quota 满足本次计划。
- `resourceBindingId`、`cloudOperationId`、`billingAttributionId`、`environmentId`、`accountId`、`tenantId`、`workspaceId` 和 `serverPlanId` 已确定；旧 resource-order 标识不得作为 v22 fixed required tag、optional tag 或兼容归属 alias。
- readonly quote 和 dry-run plan 已生成。
- secret boundary 已授权，且 SecretId / SecretKey / kubeconfig 只进入后端 secret boundary。
- billing tags 完整。

缺少任一条件必须阻断真实创建，不能使用默认值、隐式兜底或历史任务推断。

## Billing Tags

所有真实腾讯云资源必须带 MedOPL 分账标签。当前 T+1 账单标签集合为：

```json
{
  "resourceBindingId": "resource binding id",
  "cloudOperationId": "cloud operation id",
  "billingAttributionId": "billing attribution id",
  "workspaceId": "workspace id",
  "accountId": "account id",
  "serverPlanId": "starter_2c4g_10gb or pro_8c16g_100gb or custom",
  "tenantId": "tenant id",
  "runId": "run id or null",
  "environmentId": "environment id"
}
```

`runId` 可以为空，但 `accountId`、`workspaceId`、`resourceBindingId`、`cloudOperationId`、`billingAttributionId`、`serverPlanId` 和 `environmentId` 不得为空。标签缺失、标签与 resource binding 不一致、或资源无法归属到 account/workspace 时，真实 create path 必须阻断或进入审计失败。

T+1 账单用于对账和审计，不作为实时扣费来源。Portal 实时展示仍以费用估算、余额、冻结金额和预计消耗为准。T+1 结果只能用于账单校准、异常审计、补扣或退还依据。

## Authorized Plan Shape

后续授权执行前，Portal / 运维审计可以消费的计划对象必须保持业务字段边界：

```json
{
  "workspaceResource": {
    "planName": "Pro 套餐",
    "cpuCores": 8,
    "memoryGb": 16,
    "fileSpaceGb": 100,
    "concurrency": 2
  },
  "createReleaseState": "待授权",
  "billingTags": {
    "resourceBindingId": "resource binding id",
    "cloudOperationId": "cloud operation id",
    "billingAttributionId": "billing attribution id",
    "workspaceId": "workspace id",
    "accountId": "account id",
    "serverPlanId": "pro_8c16g_100gb",
    "tenantId": "tenant id",
    "runId": null,
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

## Portal Canonical Store

Portal canonical truth 存在 PostgreSQL，不存在 Redis、COS 或云标签中。真实 create/release 前必须能写入并审计以下业务记录：

- workspace。
- resource binding。
- file space entitlement。
- compute allocation。
- cloud operation。
- cloud resource projection。
- wallet ledger / freeze。
- billing reconciliation。
- audit event。
- provider secret reference。

Redis 只能作为 queue / lock / session / cache。COS 只保存文件对象。腾讯云 tag / cost allocation 只作为云侧对账证据。

Portal 点击“开通工作台资源”时，必须先写 cloud operation 和审计事件，再进入 dry-run diff 和真实执行授权。真实执行结果必须回写 cloud operation state，不能只靠云侧状态代表 Portal truth。

## File Space Contract

工作空间、计算资源和文件空间生命周期分离。

- 工作空间是业务容器。
- 计算资源可独立开通、扩容、缩容、释放。
- 存储资源 / 文件空间可独立开通、扩容、删除。
- 释放计算资源不删除文件空间。
- 释放计算资源不让文件空间进入 7 天保护期。
- 删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期。
- 计算资源已释放但文件空间仍保留，是合法状态。

计算资源释放后，文件空间可以继续保留。文件空间属于 workspace，不属于单个 run；输出文件可以带 `runId`，但仍进入 workspace 文件空间。

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

释放计算资源不等于删除文件空间。

释放流程必须：

1. 检查是否存在运行中任务。
2. 如有运行中任务，提示先停止任务或等待任务结束。
3. 停止新任务使用该计算资源。
4. 释放计算资源。
5. 停止计算计费。
6. 文件空间保持原存储状态；仅当独立存储删除或欠费保留策略触发时，才进入保护或清理流程。
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

允许的用户语言包括：工作台资源、计算资源、计算规格、文件空间、文件夹、输入文件、输出文件、预计费用、余额、冻结金额、任务并发、队列、释放策略、保护期、审计状态。

## Non-Goals

- 不读取真实 SecretId、SecretKey、kubeconfig、token、SSH private key 或 `.env`。
- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不创建、绑定、释放真实资源。
- 不真实扣费。
- 不运行 build/push/kubectl/live-test。
- 不修改 deploy、`.sentrux`、adapters 或 upstream。
- 不改变 Portal 已有 mock/snapshot、readonly quote 和 dry-run plan 实现。
