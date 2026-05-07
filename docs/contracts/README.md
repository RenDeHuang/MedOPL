# v22 合同索引

本文件是 MedOPL v22 合同目录/合同树索引，只用于帮助开发者理解现有 contract-level 边界。

它不代表真实云资源、Gateway、Runtime Bridge 或 one-person-lab upstream 已全部打通；也不代表真实价格审批、真实上线部署、真实账单核对或真实 trace source 已完成。

## v22 主合同

- [v22-mvp-managed-opl-loop.md](./v22-mvp-managed-opl-loop.md): MVP 托管 OPL 用户闭环主合同，定义从平台创建用户、充值、登录 Portal、在 OPL entry/preflight 输入或确认 gflabtoken 模型调用密钥、开通托管运行环境、进入 OPL 科研工作台、产出文件到释放环境和审计的 contract-level 主路径。portal.medopl.cn 登录不需要 gflabtoken API Key；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md): Portal SaaS、OPL Web、平台运维视图/运维面的共享界面合同，固定普通用户中文产品语言、OPL 双入口、运维可见边界、多租户后台边界和腾讯云分账标签边界。路径 1：从 Portal SaaS 后台进入；路径 2：直接访问 OPL 工作台；两条路径最终进入同一套 Gateway / preflight / launch 逻辑。

## 用户闭环段合同

- pricing snapshot: [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)
- user credit provider key: [v22-user-credit-provider-key-boundary.md](./v22-user-credit-provider-key-boundary.md)
- managed environment open: [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- opl work message file run: [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)
- runtime bridge session/run/file/providerKeyRef: [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- portal files billing trace: [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- release stop billing audit: [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)

## 共享边界合同

- token/provider key: [v22-token-provider-boundary.md](./v22-token-provider-boundary.md), [v22-user-credit-provider-key-boundary.md](./v22-user-credit-provider-key-boundary.md), [v22-opl-entry-preflight-auth-boundary.md](./v22-opl-entry-preflight-auth-boundary.md)。API Key 输入框放在 OPL 登录页密码下面；Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段；gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- resource plan: [v22-resource-plan-boundary.md](./v22-resource-plan-boundary.md)
- tenant/resource binding: [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-managed-environment-open-boundary.md](./v22-managed-environment-open-boundary.md)
- billing freeze/preauth: [v22-billing-freeze-boundary.md](./v22-billing-freeze-boundary.md), [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)
- trace metadata: [v22-trace-metadata-boundary.md](./v22-trace-metadata-boundary.md), [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md), [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)
- Langfuse 观测附件: [v22-langfuse-observability-metadata-boundary.md](./v22-langfuse-observability-metadata-boundary.md)。该合同只定义 sanitized trace/session metadata 边界，不代表 Langfuse 部署、ClickHouse、真实 API key 或真实 trace source 已接入。
- runtime bridge session/run/file/providerKeyRef: [v22-runtime-bridge-session-run-file-provider-keyref-boundary.md](./v22-runtime-bridge-session-run-file-provider-keyref-boundary.md)
- upstream one-person-lab clean boundary: [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md), [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。upstream 目录只读/clean；Portal / Gateway / Runtime / Langfuse / 腾讯云逻辑不得写进 upstream；只能通过 Gateway、Adapter、Runtime Agent、公开 API/CLI 或反向代理边界接入。OPL Gateway 本地 proxy 通过 `OPL_UPSTREAM_URL` 显式接入 clean upstream；未配置时返回 `opl_upstream_url_required`，不兜底到旧 v19/v20/v21 direct path 或硬编码 upstream。
- pricing snapshot: [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)

## 界面/运维合同

- 普通用户 Portal 中文产品语言: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-portal-files-billing-trace-boundary.md](./v22-portal-files-billing-trace-boundary.md)
- OPL Web entry/preflight: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-opl-entry-preflight-auth-boundary.md](./v22-opl-entry-preflight-auth-boundary.md), [v22-upstream-opl-boundary.md](./v22-upstream-opl-boundary.md), [v22-opl-work-message-file-run-boundary.md](./v22-opl-work-message-file-run-boundary.md)。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight；/internal/opl/auth/login 只能是 internal implementation path，不是用户入口。Gateway local proxy 只注入 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL；raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query 或浏览器持久化存储。
- 平台运维可见边界: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-release-stop-billing-audit-boundary.md](./v22-release-stop-billing-audit-boundary.md)
- 腾讯云分账标签后台边界: [v22-saas-portal-opl-ops-surface-boundary.md](./v22-saas-portal-opl-ops-surface-boundary.md), [v22-tenant-resource-binding-boundary.md](./v22-tenant-resource-binding-boundary.md), [v22-pricing-snapshot-boundary.md](./v22-pricing-snapshot-boundary.md)

## 相关合同

- [v22-canonical-user-loop.md](./v22-canonical-user-loop.md): canonical user loop 的早期/共享参考合同，阅读时以 v22 主合同和各段边界合同为当前执行入口。
