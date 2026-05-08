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

## File Space Management Surface

文件空间属于 workspace，和运行环境生命周期分离。托管运行环境释放、停止计费和审计不等于立即清空文件空间。

Portal workspace payload 可以输出 `fileSpace` 业务视图：

- `capacityGb` / `usedGb`
- `retentionDays: 7`
- `currentFolderRef`
- `folders`: `folderRef`、`name`、`parentFolderRef`、`path`、`status`
- `files`: `fileRef`、`name`、`folderRef`、`kind`、`source`、`runId`、`sessionId`、`artifactRef`、`sizeBytes`、`status`、`deletedAt`、`retentionUntil`
- `selectedFileRefs`
- `actions`
- `deletePolicy`

普通删除不需要二次确认，删除后进入 7 天保护期。永久删除和清空文件空间需要二次确认。输出文件必须继续通过 `runId`、`sessionId` 和 `artifactRef` 关联运行轨迹。

`fileSpace` 只表达 Portal 用户文件空间管理合同，不执行真实 COS 操作，不返回内部存储 key、对象 key、本地路径、签名 URL、云厂商凭据或 raw provider key。

本分支允许最小 Portal frontend 文件空间展示，用于呈现文件空间、文件夹、输入文件、输出文件、运行轨迹、保护期、批量下载和批量删除入口；真实 COS API、signed URL、拖拽、文件预览、协作权限、真实生命周期 worker 和 OPL Web 内部文件选择器深度接入仍需后续单独授权。

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

- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
