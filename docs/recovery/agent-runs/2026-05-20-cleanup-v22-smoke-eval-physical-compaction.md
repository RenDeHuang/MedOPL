# Agent Run: cleanup/v22-smoke-eval-physical-compaction

## leaf_id

`cleanup-v22-smoke-eval-physical-compaction`

## goal

压缩 v22 smoke/eval 文件面：全量审计 `scripts/**`、classification、manifest、contracts/recovery 引用链，清退可证明有替代入口的重复脚本，建立本 leaf 的机器 gate 和留痕。

## model

总控 / 集成：`gpt-5.4`

## subagents_and_models

- smoke/eval 分类与 suite 审计：`gpt-5.4`
- smoke/eval 引用链审计：`gpt-5.4`
- contracts/recovery smoke/eval 边界审计：`gpt-5.4`
- scripts duplicate/retire candidates 审计：`gpt-5.4`

## branch

`cleanup/v22-smoke-eval-physical-compaction`

## base_trunk_head

`686254e487503d0d1422133a2a2fe888c1f04040`

## commit_sha

`pending_B_review`

## branch_override_id

`smoke-eval-physical-compaction`

## contract_subscription

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/v22-agent-first-development-loop.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`

## allowed_write_scope

- `docs/recovery/v22-smoke-eval-physical-compaction-index.md`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-smoke-eval-physical-compaction.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs`
- `scripts/smoke-test-v22-repo-governance-physical-compaction.mjs`
- `scripts/v22-smoke-classification.mjs`
- deletion-only: `scripts/check-portal-copy.mjs`
- deletion-only: `scripts/check-one-person-lab-upstream-clean.mjs`
- deletion-only: `scripts/smoke-test-workspace-storage-routes-contract.mjs`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 `services/*` 业务代码。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不 build/push/kubectl/deploy/live-test。
- 不实现 PostgreSQL/Redis。
- 不改 Portal UI。

## implementation_summary

- 新增 smoke/eval physical compaction index。
- 新增 smoke/eval physical compaction gate。
- 为 cleanup 分支新增 branch override，避免误跑 PostgreSQL/Redis 当前业务 leaf。
- 将新 gate 加入 `local-contract` suite 和 smoke classification。
- 物理删除 3 个无 active suite/manifest 调用且已有替代 gate 的重复脚本。
- 更新 repo governance gate/index，把这 3 个脚本从 blocked candidate 转为 retired。
- 将原 `check-one-person-lab-upstream-clean.mjs` 的 `.runtime/one-person-lab-upstream` clean 检查迁入 repo governance gate；仅在本地 checkout 存在时读取 `git status --short`，不提交 `.runtime`。

## eval_first_changes

- `scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs`
- `docs/recovery/v22-agent-verify-manifest.json` branch override
- `scripts/v22-smoke-classification.mjs` category entry

## blocker_review_and_fix_log

- `v22-agent-workflow.mjs` 仍被 docs/contracts/smoke 引用，本轮不删。
- `sync-workspace-file-to-minio.ps1` 仍被 Portal config 引用，本轮不删。
- `check-one-person-lab-upstream-clean.mjs` 删除前需要迁移真实检查逻辑；已迁入 `scripts/smoke-test-v22-repo-governance-physical-compaction.mjs`。
- `smoke-test-workspace-storage-routes-contract.mjs` 旧断言会公开 `storageKey`，与 v22 脱敏合同冲突；替代入口采用 v22 public-response/file-space gates。
- `local-contract` baseline 在本分支最初失败，因为 goal-state gate 不认识该 cleanup branch；通过 manifest branch override 修正，不改 current cursor。
- 本 leaf 不新增产品合同；`v22-smoke-eval-boundary.md` 已覆盖长期语义。

## verification_commands

- `node scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs`
- `node scripts/smoke-test-v22-repo-governance-physical-compaction.mjs`
- `node scripts/smoke-test-v22-smoke-classification-gate.mjs`
- `node scripts/smoke-test-v22-smoke-eval-boundary.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts`
- added-lines secret value scan

## b_review_result

`pending_B_review`

## runtime_notes

本分支不启动 UI、本地服务、PostgreSQL、Redis、OPL、真实云或 deploy runtime。

## non_goals

- 未实现 PostgreSQL/Redis。
- 未改服务业务代码。
- 未接真实云。
- 未读取 secret。
- 未修改 upstream。
- 未改 Portal UI。

## next_leaf

`leaf-portal-postgres-redis-local-production-data-closure`
