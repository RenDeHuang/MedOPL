# OPL SaaS Vibe Coding 工作约定

本文档定义 platform-v22 的日常开发分支、探索、落地和清理规则。platform-v22 是 MedOPL OPL SaaS 的新 canonical trunk；platform-v21 是 legacy recovery/reference worktree，仅用于按域取证、迁移判断和边界校验。

MedOPL 的当前产品主线是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 科研工作台。用户购买套餐、计算能力、存储容量和运行环境；平台负责开通、隔离、计费、审计和释放。

## 阶段感知开工

v22 的完成阶段会变化。每个分支开工前必须读取：

- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/contracts/README.md`
- 本次订阅的合同文件

开工声明必须写明：基于当前阶段，本分支做什么、不做什么、订阅哪些合同、需要哪些授权边界和验收命令。Agent 不得根据过期聊天记忆判断当前阶段。

当前默认开发动作只包括本地合同、Portal、Gateway / Runtime Bridge 小闭包和本地 smoke。真实云、真实部署、真实账单核对、真实 Langfuse、真实 upstream 生产接入不属于默认动作，必须单独授权。

## Canonical Trunk

- platform-v22 是新的 canonical trunk，所有正式产品语义、正式文档和正式入口以 v22 为准。
- platform-v21 是 legacy recovery/reference worktree，不是继续叠加功能的主线，也不是整包搬迁来源。
- `main` 和 `recovery/*` 这类 trunk 线只接收已经收敛的正式变更，不接收半成品探索、脏实验或路线未定的代码。
- 一个核心域只能有一个正式入口。并行入口只能存在于 `spike/*` 探索中，不能进入 trunk。

## 分支规则

### 想法不确定时：开 `spike/*`

`spike/*` 用于验证形状、边界和产品判断。

示例：

- `spike/module-catalog-shape`
- `spike/session-run-ui`
- `spike/billing-plan-model`

`spike/*` 可以快，可以脏，可以丢弃。`spike/*` 的结论必须被整理成明确判断后，才能通过新的 `feat/*` 干净落地。`spike/*` 不直接合并进 platform-v22 trunk。

### 方向确定后：从 v22 trunk 开 `feat/*`

`feat/*` 用于正式落地一个已经明确的产品意图。

示例：

- `feat/session-run-timeline`
- `feat/workspace-artifact-browser`
- `feat/billing-plan-v1`

一个 `feat/*` 可以跨前端、后端、文档和测试，但只能服务一个产品意图。`feat/*` 必须从最新 v22 trunk 新开，并以当前主线边界重落，不从旧 worktree 整包复制。

### 路线替换时：必须跟 `cleanup/*`

任何 pivot 都必须同时带 cleanup/delete 计划。路线替换不能只新增新入口、新模型或新链路，也必须删除或归档被替代路径。

示例：

- `feat/platform-provisioned-resource-model`
- `cleanup/remove-user-owned-primary-path`

cleanup 计划必须写清楚：

- 被替代的入口、文档、测试、脚本或配置。
- 哪些内容删除，哪些内容迁移，哪些内容只归档为参考。
- trunk 合入前如何证明只剩一个正式入口。

## 标准开工流程

1. 从最新 `recovery/platform-v22-trunk` 新开 `feat/*`、`cleanup/*` 或 `spike/*`。
2. 声明本分支意图。
3. 声明订阅合同包。
4. 用户审阅新增、修改或冲突合同。
5. 写或更新 smoke。
6. 实现最小改动。
7. 跑最小验证。
8. 提交 commit。
9. 交给窗口 B 审计。
10. B 无 blocker 时 `ff-only` 合入 trunk。
11. B push GitHub。

## 本地 workflow gate

`scripts/v22-workflow-gate.mjs` 是本地可执行的合同优先工作流检查器，只输出模板和检查结果，不自动修改、不自动合并、不自动 push。

开工时可运行：

```bash
node scripts/v22-workflow-gate.mjs start --type portal-ui
```

审计时可运行：

```bash
node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk
```

B push 前 checkpoint 可运行：

```bash
node scripts/v22-workflow-gate.mjs checkpoint
```

当前内置合同包类型包括 `portal-ui`、`gateway`、`runtime`、`langfuse-trace`、`resource-billing`、`tencent-quote` 和 `cleanup`。gate 只检查 git diff、路径、remote URL 和推荐验证命令；它不读取 secret 内容，不执行 build/push/kubectl/live-test，也不调用真实云 API。

`scripts/v22-agent-workflow.mjs` 是 A/B/C 本地 workflow orchestrator，只生成任务包和下一步建议，不自动 merge、不自动 push、不启动 tmux、不读 secret、不调用真实云、不执行 build/push/kubectl/live-test。

```bash
node scripts/v22-agent-workflow.mjs start --type <cleanup|portal-ui|resource-billing|contract|ops-console>
node scripts/v22-agent-workflow.mjs review-pack --branch <branch> --base recovery/platform-v22-trunk
node scripts/v22-agent-workflow.mjs c-qa-pack --surface <resources|workspace|trace|billing|overview>
node scripts/v22-agent-workflow.mjs checkpoint-pack
node scripts/v22-agent-workflow.mjs next --state <json>
```

## Owner worktree / long autonomy 纪律

- 主工作区只用于规划、B 审计、ff-only merge、checkpoint、push、清理。
- A/C/D 只要会写文件，默认必须在独立 git worktree。
- 一个 worktree 只承载一条 active lane。
- lane 完成后走 verify -> B review -> absorb or abandon -> cleanup。
- tmux pane/session 只是执行面，不是 truth。
- truth 必须进入 repo-tracked contracts/docs/scripts/tests。
- 不提交 tmux session、agent 对话、临时日志、本地状态。

## 分支开工声明模板

```text
分支：
feat/v22-xxx

意图：
本分支只解决 xxx。

订阅合同：
- docs/contracts/v22-mvp-managed-opl-loop.md
- docs/contracts/xxx.md
- docs/recovery/status-matrix.md
- docs/recovery/active-surface.md

本次会修改：
- xxx

本次不修改：
- deploy/*
- adapters/*
- .sentrux/*
- one-person-lab upstream
- 真实云资源

污染防护：
- 不恢复旧路线
- 不泄露 secret
- 不绕过合同
- 不引入新主入口
- 不让 Langfuse/OpenCost/runner/provisioner 成为主产品叙事

验收：
- node scripts/xxx.mjs
- npm --prefix services/portal run check
- npm --prefix services/portal run frontend:typecheck
```

## A/B/C 窗口流程

- 窗口 A 负责开发：从最新 trunk 开 `feat/*` 或 `cleanup/*`，只做一个明确意图，按“合同 -> smoke -> 实现 -> 验证 -> commit”推进。
- 窗口 B 负责审计、合并和 push：B 不做大功能开发，只检查合同一致性、污染风险、secret hygiene、验证结果和工作区状态；无 blocker 时才 `ff-only` 合回 trunk 并 push GitHub。
- 窗口 C 负责独立并行任务：只做互不冲突的文档、合同、结构修复或 cleanup；合并前必须基于最新 trunk 重放或 rebase，并交给 B 审。

## B 窗口审计 checklist

B 合并前必须检查：

- 工作区是否干净。
- 分支是否只服务一个明确意图。
- 合同订阅是否完整。
- 新增、修改或冲突合同是否经过用户确认。
- smoke 是否覆盖本次边界。
- 是否存在产品叙事污染、旧路线污染、upstream 污染、secret 污染、合同污染或 trunk 污染。
- 是否触碰未授权路径或操作。
- 最小验证是否通过。
- 是否可以 `ff-only` 合入 trunk。

## v21 资产处理规则

旧 v21 内容不能整包搬进 v22，只能按域裁定：

- `keep`：符合 v22 主线，可以重落或迁入。
- `migrate`：有价值，但必须改边界、命名或合同后进入 v22。
- `delete`：属于旧路线，不进入 v22。
- `archive`：只保留为历史参考，不参与产品主线。

裁定必须基于当前 v22 产品真相：平台开通、客户专属隔离、平台计费审计、clean upstream OPL、Portal/Gateway/Adapter/Runtime Agent 公开边界。

## 禁止事项

- 不把 `user_owned` 解释成用户自带 CVM、COS、K8s 或用户配置云资源；它只能作为 legacy alias。
- 不把旧 `med-autoscience-runner`、`resource-provisioner`、K8s Job、OpenCost、Langfuse 扩散成 v22 主产品叙事。
- 不修改 one-person-lab upstream 源码，不在 upstream 目录写 Portal、Gateway、Adapter 代码，不 import upstream 内部模块。
- 不把 raw provider API key、bearer token、launchToken、runtimeToken 写入前端持久化、全局 JS state、日志、evidence 或 git。
- 未经单独授权，不运行 build/push、kubectl、live-test、真实云资源操作，也不修改 `.sentrux/*`。

## 合入标准

进入 platform-v22 trunk 的变更必须满足：

- 产品叙事与 `platform-provisioned / customer-dedicated` 一致。
- 主链路保持 `Portal -> OPL Web Gateway -> clean upstream OPL Web -> Portal OPL Adapter / Runtime Agent -> platform-provisioned compute/storage/runtime -> Billing/Audit/Admin`。
- 每个核心域只有一个正式入口。
- spike 结论已经通过 `feat/*` 干净重落。
- pivot 已经带 cleanup/delete 计划。
- 旧 v21 资产已经按 `keep`、`migrate`、`delete`、`archive` 裁定。
- 验证只运行本次授权范围内的本地检查。

## 最小验证命令

默认最小验证：

```bash
node scripts/smoke-test-v22-mvp-contract-suite.mjs
npm --prefix services/portal run check
npm --prefix services/portal run frontend:typecheck
```

涉及结构变更时补充：

```bash
sentrux check .
```

涉及 Gateway / Runtime Bridge 时补充：

```bash
node scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs
node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs
```

涉及 Langfuse / trace 时补充：

```bash
node scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs
```

涉及腾讯云 quote provider 时补充对应 v22 quote provider smoke。真实腾讯云 API、真实云资源、deploy、build/push、kubectl 和 live-test 必须单独授权。
