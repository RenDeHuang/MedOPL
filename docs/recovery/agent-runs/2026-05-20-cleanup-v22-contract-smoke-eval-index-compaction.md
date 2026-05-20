# Agent Run: cleanup/v22-contract-smoke-eval-index-compaction

## leaf_id

`cleanup-v22-contract-smoke-eval-index-compaction`

## goal

全量审计并收紧 v22 的合同、truth/index、smoke/eval 和 agent-run 关系：不硬删仍被引用的文件，明确 blocked 清退顺序，补 post-absorb trace truth，并用机器 gate 防止 contracts、smoke、eval、index 再次混成阶段故事。

## model

总控 / 集成：`gpt-5.4`

## subagents_and_models

- Wegener：`gpt-5.4`，只读审计 `docs/contracts/**` 的长期合同、merge/rename/retire candidates 和阻塞引用。
- Kierkegaard：`gpt-5.4`，只读审计 `docs/recovery/**` 与根级治理文档的 truth/index/agent-runs/stage-history 分类。
- Gauss：`gpt-5.4`，只读审计 `scripts/**`、smoke/eval 分类、suite wrapper 与 future-authorized 语义。
- Laplace：`gpt-5.4`，只读审计合同、recovery、scripts 候选文件的引用链和可删阻塞。

## branch

`cleanup/v22-contract-smoke-eval-index-compaction`

## base_trunk_head

`422547d2ed61c7ecc231e07e1d9b1214dc5df715`

## commit_sha

`pending_B_review`

## contract_subscription

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-smoke-eval-physical-compaction-index.md`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`

## allowed_write_scope

- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/v22-contract-smoke-eval-index-compaction-index.md`
- `docs/recovery/v22-smoke-eval-physical-compaction-index.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-smoke-eval-physical-compaction.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-smoke-eval-index-compaction.md`
- `scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs`
- `scripts/smoke-test-v22-smoke-classification-gate.mjs`
- `scripts/smoke-test-v22-smoke-eval-boundary.mjs`
- `scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs`
- `scripts/v22-smoke-classification.mjs`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 upstream。
- 不修改 `services/*` 业务代码。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不 build/push/kubectl/deploy/live-test。
- 不实现 PostgreSQL/Redis。
- 不实现 admin business closure。
- 不改 Portal UI 视觉、布局、信息架构。
- 不物理删除仍被当前合同、recovery 权威页、smoke/eval gate 或服务配置引用的文件。

## implementation_summary

- 新增 contract/smoke/eval/index compaction index，记录 42 份合同、149 个 v22 eval、truth/index/agent-run 的当前归属和 blocked 清退顺序。
- 扩展 smoke/eval 合同和分类元数据：新增 `entryKind` 与 `authorization`，把 `atomic`、`suite-wrapper`、`gate-self-test` 和 `none` / `future-authorized` 分开。
- 新增 compaction gate，验证当前没有可安全物理删除的大块文件、blocked candidates 仍存在且已记录、cloud future-authorized 不进入默认授权、上一 smoke/eval cleanup 已补吸收事实。
- 更新 smoke classification / boundary gate，防止 suite wrapper 被误当成业务 eval，防止 `local/readonly/dry-run` 文件名掩盖 future-authorized 授权边界。
- 补 `cleanup/v22-smoke-eval-physical-compaction` agent-run 的 B review / absorbed / pushed 事实。

## eval_first_changes

- RED: 新增 `scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs` 前，classification 已登记新 gate 时 `smoke-classification-gate` 失败，暴露“分类有、文件不存在”的悬空状态。
- GREEN target: 新 gate、索引、manifest override、agent-run、smoke/eval 元数据和 previous post-absorb truth 同时成立。

## blocker_review_and_fix_log

- contracts auditor 确认当前 42 份 v22 合同里没有可直接删的合同；`admin-ops-console`、`user-credit-provider-key`、`billing-freeze` 是 merge-candidate，但引用未迁。
- recovery auditor 确认 truth 已集中，但根级治理文档和阶段板仍引用 cloud onboarding / program board / `v22-agent-workflow.mjs`，不能直接删。
- scripts auditor 确认 148 个既有 v22 eval 全部分类；本分支新增 1 个治理 gate 后总数为 149。`mvp-contract-suite` 是 legacy wrapper，不能直接删。
- reference-chain auditor 确认 `scripts/sync-workspace-file-to-minio.ps1` 仍被 `services/portal/src/config/portal-config.mjs` 挂载；删除必须另开 service cleanup leaf。
- 本轮决定不做物理删除，避免破坏 gate 或误改授权边界。

## verification_commands

- `node scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs`
- `node scripts/smoke-test-v22-smoke-classification-gate.mjs`
- `node scripts/smoke-test-v22-smoke-eval-boundary.mjs`
- `node scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs`
- `node scripts/smoke-test-v22-agent-run-record-gate.mjs`
- `node scripts/smoke-test-v22-agent-verify-entrypoint.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery docs/contracts scripts`
- added-lines secret value scan

## b_review_result

`pending_B_review`

## runtime_notes

本分支不启动 UI、本地服务、PostgreSQL、Redis、OPL、真实云或 deploy runtime。

## non_goals

- 未实现 PostgreSQL/Redis。
- 未实现 admin business closure。
- 未接真实云。
- 未读取 secret。
- 未修改 upstream。
- 未 build/deploy/kubectl/live-test。
- 未改 Portal UI。
- 未物理删除仍有强引用的合同、recovery 文档或 eval 脚本。

## next_leaf

`leaf-portal-postgres-redis-local-production-data-closure`
