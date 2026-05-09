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

## 阶段状态

- v22 当前阶段以 `docs/recovery/mvp-contract-acceptance.md`、`docs/recovery/status-matrix.md` 和 `docs/contracts/README.md` 为准；不得根据过期聊天记忆判断当前阶段。
- 新开发必须先读取当前阶段文档、合同索引和本次订阅合同，再声明分支意图、合同订阅包、授权边界和验收命令。
- 阶段推进后优先更新 recovery 阶段文档；本文件只保留稳定纪律，不写死会随阶段变化的完成状态。

## 合同订阅制度

- 任何正式开发开始前，必须先声明本分支订阅的合同包。合同包至少包含主合同、本次相关分支合同、本次相关边界合同和 recovery 约束文档。
- 新增合同、修改合同、合同冲突、主叙事变化、授权边界变化，必须先让用户审阅确认，再写 smoke 或实现。
- 合同审阅必须确认：范围是否正确、边界是否正确、非目标是否完整、验收条件是否可验证、是否存在污染风险。

## Discovery/Canary 工作纪律

- 边界先行 -> 探索/canary -> 修正边界 -> 正式实现 -> B 吸收。
- 未知外部系统接入先走 Discovery/Canary lane。
- canary 必须有用户授权边界。
- canary 输出只进 .runtime，不进 git。
- canary 可以验证真实 SDK/云/服务，但不得自动变成 production dependency。
- canary 发现的事实必须回写 contracts/status/decisions。
- production implementation 必须基于已验证事实。
- B 只吸收 productionized 分支，不吸收未清理 canary 临时代码。
- Portal、Cloud、OPL sync 三条 program 都适用。

## A/B/C 窗口职责

- 窗口 A 是开发窗口：从最新 `recovery/platform-v22-trunk` 新建 `feat/*` 或 `cleanup/*` 分支，只做一个明确意图，按“合同 -> smoke -> 实现 -> 验证 -> commit”推进。
- 窗口 B 是审计 / 合并 / push 窗口：复审 A 的分支，检查合同一致性、污染风险、secret hygiene、验证结果和工作区状态。B 不做大功能开发；无 blocker 时才 `ff-only` 合回 `recovery/platform-v22-trunk` 并 push GitHub。
- 窗口 C 是并行工作窗口：只做互不冲突的独立任务，例如文档 cleanup、结构修复、合同梳理。C 合并前必须基于最新 trunk 重放或 rebase，并交给 B 审。

## 污染防护

- 产品叙事污染：不得把 MedOPL 讲回云资源控制台、CVM/COS/K8s 用户自配。
- 旧路线污染：不得恢复 `user_owned`、`resource-order`、旧 runner/provisioner、OpenCost/Langfuse 主叙事为主线。
- upstream 污染：不得修改 one-person-lab upstream、import upstream 内部模块，或把 Portal/Gateway/Adapter/Runtime 代码写进 upstream。
- secret 污染：不得让 raw API key、token、kubeconfig、SecretId/SecretKey、SSH private key、`.env` 进入日志、evidence、git 或 GitHub。
- 合同污染：不得绕过合同实现；不得让 smoke 用默认值、隐式兜底或伪通过掩盖真实缺参。
- trunk 污染：不得让 spike 半成品、未验证代码、真实云操作副作用或未 cleanup 的旧入口进入 `recovery/platform-v22-trunk`。

## 必须先和用户讨论的情况

- 产品方向不清、合同之间冲突、主叙事变化或授权边界变化。
- 需要读取 secret、执行真实云操作、修改 upstream、触碰 `deploy/*` / `.sentrux/*` / `adapters/*`。
- 需要 build/push、kubectl、live-test 或其他会影响真实外部系统的操作。
- 需要退役旧路线，或实现范围超过当前分支意图。
