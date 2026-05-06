# Workspace Instructions

- Always respond in 中文。
- 避免采用降级处理、兜底方案、临时补丁、启发式方法、局部稳定化手段，以及非严谨通用算法的后处理补救措施。
- 对于不冲突、可以并行的任务，尽量使用 subagent 提高效率；不再需要的 subagent 要尽快关闭，避免占用 subagent 的席位。
- 以后创建/使用 git worktree 或 Codex native subagent 时，必须显式选择并记录模型；允许使用的模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 浏览网页时，优先使用 `agent-browser` skill。
- 涉及 PDF、图片、Office、网页内容提取时，优先使用官方 `mineru-document-extractor` skill。

## MedOPL v21 工作边界

- v21 当前产品方向是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台；用户购买套餐、计算能力、存储容量和运行环境，平台负责开通、隔离、计费、审计和释放。
- `user_owned` 只能作为 legacy alias；新代码、新文档、新测试和默认产品叙事不得把它解释成用户自带 CVM/COS/K8s 或用户配置云资源。
- 禁止把旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 扩散成 v21 主产品叙事；这些只能作为历史资产、内部迁移参考或单独授权的旧栈审查对象。
- upstream OPL 必须保持 clean，不修改 upstream 源码，不在 upstream 目录写 Portal/Gateway/Adapter 代码，不 import upstream 内部模块；只能通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配。
- raw provider API key 只能进入后端密钥边界；前端最多持有 `providerKeyRef`、bound status 和一次性输入态，不能把 raw key、bearer token、launchToken/runtimeToken 写入 sessionStorage/localStorage、全局 JS state、日志、evidence 或 git。
- build/push、kubectl、live-test、真实云资源操作和 `.sentrux/*` 修改必须单独授权；不得在普通重构、文档收敛或本地 smoke 中顺手执行。
