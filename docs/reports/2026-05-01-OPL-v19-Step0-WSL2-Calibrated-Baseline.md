# OPL v19 Step 0 WSL2 Calibrated Baseline

日期：2026-05-01

工作区：`/home/dev/projects/platform-v19`

分支：`codex/opl-v19`

## 结论

WSL2 工作区已完成接管校准。当前本地分支已经从 `ef4c460` 快进到远端 `a17a246`，并恢复了上一轮缺失的 v19 open items 文档。

`a17a246` 的实际改动是新增：

- `docs/reports/2026-05-01-OPL-v19-Open-Items-Checklist.md`

此前提到的 `2026-05-01-OPL-v19-Open-Items-Checklist.md` 不在 `docs/plan/` 下，而是在 `docs/reports/` 下。

## 校准事实

- 校准前本地 HEAD：`ef4c460 Record v19 commercial readiness without overstating live rollout`
- `git fetch origin --prune` 后发现远端 `origin/codex/opl-v19` 前进到 `a17a246`
- 已执行 fast-forward merge，本地 HEAD 现为 `a17a246 Clarify the remaining v19 commercial gates`
- 本地对象库在 fetch 前没有 `a17a246`
- 本地 reflog 在 fetch 前没有 `a17a246`
- 本地已有 `.runtime/worktrees/v19-*` worktree 中没有这份 2026-05-01 open items 文档

## 未提交变更

当前仍有两类未提交变更：

- `AGENTS.md`：新增模型记录规则，要求创建或使用 git worktree / Codex native subagent 时显式记录模型，允许模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- `docs/plan/2026-05-01-OPL-v19-Live-Gates-Supplement-AI-Dev-Plan.md`：本轮新增的 v19 live gates 补充 AI 开发方案。

未把 `AGENTS.md` 的规则修改混入业务代码修复。

## Subagent 模型记录

本轮已按要求显式选择并记录模型：

- Subagent A：`gpt-5.4`，云上只读状态盘点，只写 `docs/reports/**`
- Subagent B：`gpt-5.4`，`billing-reconcile` P0 修复，只写 billing 相关范围
- Subagent C：`gpt-5.4`，TKE create/delete cleanup gate 准备，只写 TKE gate 相关范围
- Subagent D：`gpt-5.4`，Portal PostgreSQL/Redis restart recovery gate 准备，只写 recovery gate 相关范围
- Subagent E：`gpt-5.3-codex`，Sentrux/结构质量只读预检，已关闭

## 推云准则

当前仍保持 `Do not roll v19`。允许执行受控 live gate 写操作，但不把 v19 主服务整体滚云，直到 P0 证据齐全。

本轮推云准则：

- 维稳为主，不做无证据的正式 rollout。
- 模块间低耦合，模块内高聚合。
- Billing、Provisioner、Portal、Gateway、Runner 各自保持职责边界。
- 没有 live 证据的项目只能标记为未完成。
- 不记录 Secret、API key、token、数据库密码、Redis 密码。
