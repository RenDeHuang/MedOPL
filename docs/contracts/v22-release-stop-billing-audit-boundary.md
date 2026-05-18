# v22 Release Stop Billing Audit Boundary Contract

本合同定义 MedOPL v22 MVP 闭环最后一段：用户停止使用 / 释放托管运行环境后，停止扣费，进入 120min 停止计费确认，并在 T+1 进入审计状态。

## Product Boundary

用户主叙事必须是：

- 用户停止使用 / 释放托管运行环境。
- 扣费停止。
- Portal 显示停止计费确认状态。
- Portal 显示审计状态。
- 用户不需要理解 CVM、COS、K8s 或 TKE。

后台实现可以保留 `resourceBinding`、`billingStoppedAt`、`billingStopConfirmBy`、`auditTag` 和审计状态字段，但这些只属于平台内部合同、计费和审计边界。

## Release Flow

- 未开通托管运行环境时不能释放，返回 `managed_environment_required`。
- 已释放环境不能重复释放，返回 `managed_environment_already_released`。
- 释放请求必须显式包含 `workspaceId`。
- `resourceBinding` 状态按合同记录：
  - `release_requested`
  - `billing_stop_confirming`
  - `billing_stopped`
  - `audit_pending`
  - T+1 后进入 `audit_ready` 或 `audited`
- `billingStoppedAt` 必须等于 `releasedAt`。
- `billingStopConfirmBy` 必须等于 `releasedAt + 120min`。
- T+1 审计准备时间必须等于 `releasedAt + 1 day`。

本轮不执行真实资源删除，不调用真实云 API，只表达平台内部合同/状态闭环。

## Billing Summary

`billingSummary` 必须区分：

- `active billing`
- `stop billing confirming`
- `billing stopped`
- `audit pending`
- `audited`

释放后不再新增运行计费；新的 run 必须被 managed environment gate 拦截。

## File Protection

释放后 workspaceFiles 和 artifacts 必须进入保护/清理边界：

- 状态为 `retention_protected`。
- 保留公开 file reference / artifact reference。
- 不立即硬删除。
- 后续清理必须走审计边界。

## Security Boundary

API response 和 canonical state 不得泄露：

- raw API key
- raw prompt
- `resourceBinding` / `resourceBindingId` / `billingAttributionId` 等后台归因原值
- `launchToken`
- `runtimeToken`
- 内部存储密钥
- storage key / object key / local path / signed URL

## Non-goals

- 不改 frontend。
- 不改 OPL Gateway。
- 不改 Runtime Bridge。
- 不改 deploy、`.sentrux` 或 `adapters`。
- 不修改 one-person-lab upstream。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。
