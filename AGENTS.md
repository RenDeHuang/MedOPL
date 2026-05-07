# Workspace Instructions

- Always respond in 中文。
- 避免采用降级处理、兜底方案、临时补丁、启发式方法、局部稳定化手段，以及非严谨通用算法的后处理补救措施。
- 对于不冲突、可以并行的任务，尽量使用 subagent 提高效率；不再需要的 subagent 要尽快关闭，避免占用 subagent 的席位。
- 以后创建/使用 git worktree 或 Codex native subagent 时，必须显式选择并记录模型；允许使用的模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 浏览网页时，优先使用 `agent-browser` skill。
- 涉及 PDF、图片、Office、网页内容提取时，优先使用官方 `mineru-document-extractor` skill。

## MedOPL v22 工作边界

- `platform-v22` 是 canonical trunk；`recovery/platform-v22-trunk` 是 v22 收敛主线，所有新产品语义以 v22 为准。
- `platform-v21` 是 legacy reference，只能作为历史参考或迁移输入；不得把 v21 的默认叙事、目录边界或旧运行路径扩散成 v22 主线。
- v22 当前产品方向是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台；用户购买套餐、计算能力、存储容量和运行环境，平台负责开通、隔离、计费、审计和释放。
- active surface 仅限：`services/portal`、`services/opl-web-gateway`、`services/opl-runtime-bridge`、`docs/product.md`、`docs/architecture.md`、`docs/contracts/v22-*`、`docs/recovery/*`、`scripts/smoke-test-v22-*`。
- archive/reference surface 包括：`docs/plan/*`、`docs/reports/*`、`docs/releases/*`、`docs/logs/*`、`scripts/smoke-test-v19-*`、`scripts/smoke-test-v20*`、`scripts/live-test-*`、`OPL-v20-商业化产品套餐开发方案.md`。这些只能作为历史证据或迁移参考，不能作为新实现入口。
- delete/cleanup target 包括：`user_owned` primary path、`resource-order` primary path、旧 `med-autoscience-runner`、旧 `resource-provisioner`、OpenCost 主叙事、Langfuse 主产品叙事。它们进入 cleanup 分支处理，不在普通功能分支继续扩写。
- forbidden without explicit authorization：`deploy/*`、`.sentrux/*`、`adapters/*`、one-person-lab upstream、build/push/kubectl/live-test/真实云资源操作。
- `user_owned` 只能作为 legacy alias；新代码、新文档、新测试和默认产品叙事不得把它解释成用户自带 CVM/COS/K8s 或用户配置云资源。
- upstream OPL 必须保持 clean，不修改 upstream 源码，不在 upstream 目录写 Portal/Gateway/Adapter 代码，不 import upstream 内部模块；只能通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。
- raw provider API key 只能进入后端密钥边界；前端最多持有 `providerKeyRef`、bound status 和一次性输入态，不能把 raw key、bearer token、launchToken/runtimeToken 写入 sessionStorage/localStorage、全局 JS state、日志、evidence 或 git。
- build/push、kubectl、live-test、真实云资源操作和 `.sentrux/*` 修改必须单独授权；不得在普通重构、文档收敛或本地 smoke 中顺手执行。
