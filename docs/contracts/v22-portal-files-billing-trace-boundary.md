# v22 Portal Files Billing Trace Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第四段：Portal 可展示用户工作空间文件、账单摘要和 session trace metadata。

## Product Boundary

用户主叙事必须是：

- 用户在 Portal 看到工作空间文件。
- 用户在 Portal 看到账单摘要和预扣费/冻结状态。
- 用户在 Portal 看到运行轨迹。
- 用户不需要理解 CVM、COS、K8s 或 TKE。

后台实现可以保留 `resourceBinding`、`providerKeyRef`、`auditTag` 和计费状态字段，但它们只作为平台内部合同、计费和审计边界。

## Canonical State Surface

Portal canonical state 必须能输出：

- `workspaceFiles`
- `outputFiles`
- `artifacts`
- `billingSummary`
- `freeze`
- `preauth`
- `sessionTraceMetadata`
- `managedEnvironment`
- `resourceBinding`

workspace file reference 和 artifact reference 是公开文件引用，不等于内部存储 key、对象 key、本地路径或签名 URL。

## Billing Summary

`billingSummary` 必须区分：

- `balance`：用户余额。
- `frozen`：冻结金额。
- `preauth`：预扣费状态。
- `estimatedUsage`：运行中的估算用量。
- `pendingReconciliation`：pending reconciliation / T+1 核对状态。
- `releaseStopBillingStatus`：尚未释放时必须为 `none`。

本合同不写正式价格，不把云成本价当 MedOPL 售卖价。

## Trace Metadata Whitelist

`sessionTraceMetadata` 只能包含：

- `sessionId`
- `workspaceId`
- `resourceBindingId`
- `providerKeyRef`
- artifact refs
- timestamps
- `status`
- `auditTag`

不得包含：

- raw prompt
- raw API key
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- storage key / object key / local path / signed URL

Langfuse 只作为后续 trace metadata source，不进入 MVP 主产品叙事。

## Non-goals

- 不改 frontend。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
