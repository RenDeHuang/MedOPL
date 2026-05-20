# Agent Run: cleanup/v22-repo-governance-physical-compaction

## leaf_id

`cleanup-v22-repo-governance-physical-compaction`

## goal

整理仓库治理面，按 `contracts / truth / index / eval / agent-runs` 重新分类，物理清退不属于 v22 active surface 的旧 config/live-operation 残留，建立后续 AI 开发流程规范和可验证 gate。

## model

总控 / 集成：`gpt-5.4`

## subagents_and_models

- contracts / `docs/product.md` / `docs/architecture.md` 全量审计：`gpt-5.4`
- `docs/recovery/**` 全量审计：`gpt-5.4`
- `scripts/**` 全量审计：`gpt-5.4`
- `services/**` 全量审计：`gpt-5.4`
- root / `configs/**` / `.sentrux/**` 全量审计：`gpt-5.4`

## branch

`cleanup/v22-repo-governance-physical-compaction`

## base_trunk_head

`ccf5c3374ad2e1997537579c4b02f29e7c7c4afb`

## commit_sha

`3fa576b8809560629c5a1677ebacae9b76034810`

## absorbed_commit

`3fa576b8809560629c5a1677ebacae9b76034810`

## post_absorb_fix_commit

`b00bb23a6e05ed15d2612e0341664948f682364a`

## contract_subscription

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-truth-freeze.md`
- `docs/recovery/product-truth.md`
- `docs/recovery/architecture-truth.md`

## allowed_write_scope

- `docs/recovery/v22-repo-governance-physical-compaction-index.md`
- `docs/recovery/v22-agent-first-development-loop.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-repo-governance-physical-compaction.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/repo-zoning.md`
- `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`
- deletion-only: `configs/**`
- deletion-only: `scripts/check-production-entry-health.mjs`
- deletion-only: `scripts/check-production-entry-performance.mjs`
- deletion-only: `scripts/update-dnspod-records.mjs`
- deletion-only: `scripts/smoke-test-root-dockerignore.mjs`
- deletion-only: `scripts/fixtures/fake-kubectl-success.cmd`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不 build/push/kubectl/deploy/live-test。
- 不改 Portal UI 视觉、布局、信息架构。
- 不改 `services/*` 业务实现。
- 不实现 PostgreSQL/Redis、admin closure 或真实云能力。

## implementation_summary

- 新增仓库治理物理压缩索引，记录全量审计结果、当前主线、文件职责、删除清单和阻塞清退候选。
- 新增 agent-first 开发流程规范，固定 `goal -> contracts -> truth -> index -> eval-first -> implementation -> verification -> agent-run -> B review -> post-absorb truth`。
- 新增 repo governance gate，机器验证物理清退、分类文件、agent-run 留痕、无 `openspec/` 第二事实源、`.sentrux/**` 未修改、`services/**` 未改。
- 物理删除 `configs/**` 和 5 个非 v22 live/config 残留脚本。
- 为本 cleanup 分支新增 branch override，避免误跑当前 PostgreSQL/Redis 业务 leaf gate。

## eval_first_changes

- 新增 `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`。
- 将该 gate 加入 `scripts/v22-test-classification.mjs`。
- 将该 gate 接入 `docs/recovery/v22-agent-verify-manifest.json` 的 branch override 和 local-contract suite。

## blocker_review_and_fix_log

- `compose.product.yaml` 仍被 default-entry gate 和 recovery zoning 引用，未删除，记录为 blocked-retire-candidate。
- `scripts/v22-agent-workflow.mjs` 仍被 docs/contracts/smoke 引用，未删除，记录为 duplicate-governance-candidate。
- `services/**` 是 active surface，服务内 residue 只记录，不删除。
- `.sentrux/**` 是 forbidden surface，虽然陈旧但未触碰。
- `configs/**` 中含 secret-store 路径名；本分支只做 deletion-only，并通过 workflow gate 限定该 branch 的授权删除范围。

## verification_commands

- `node tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`
- `node tests/health/smoke-test-v22-smoke-classification-gate.mjs`
- `node tests/health/smoke-test-v22-smoke-eval-boundary.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts`
- added-lines secret value scan

## b_review_result

`passed / ff-only absorbed / pushed`

窗口 B 已将 `cleanup/v22-repo-governance-physical-compaction` ff-only 合入 `recovery/platform-v22-trunk` 并 push。吸收提交为 `3fa576b8809560629c5a1677ebacae9b76034810`。

post-push 发现 `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs` 在分支 review 态依赖 `origin...HEAD` deletion-only diff；合入 trunk 后 diff 为空，导致 trunk 上的 local-contract suite 失败。B 追加修复提交 `b00bb23a6e05ed15d2612e0341664948f682364a`，让 gate 同时支持 branch review 态和已吸收 trunk 态。

## post_absorb_verification

- `node tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts services/portal/src`

## runtime_notes

本分支不启动 UI、本地服务、PostgreSQL、Redis、OPL、真实云或 deploy runtime。

## non_goals

- 未实现 PostgreSQL/Redis。
- 未实现 admin business closure。
- 未接真实云。
- 未部署。
- 未读取 secret。
- 未修改 upstream。
- 未改 Portal UI。
- 本分支不修改 upstream，不触碰 one-person-lab upstream 源码。

## next_leaf

`leaf-portal-postgres-redis-local-production-data-closure`
