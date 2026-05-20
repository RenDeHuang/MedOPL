# Agent Run: cleanup/v22-post-absorb-repo-governance-truth

## leaf_id

`cleanup-v22-post-absorb-repo-governance-truth`

## goal

补齐 `cleanup/v22-repo-governance-physical-compaction` 被 B 吸收后的 trace-first 记录，并让 repo governance gate 支持已吸收 trunk 态。

## model

总控 / 实现：`gpt-5.4`

## subagents_and_models

未使用 subagent。本 leaf 很小，只改 post-absorb 留痕和 gate 状态判断。

## branch

`cleanup/v22-post-absorb-repo-governance-truth`

## base_trunk_head

`b00bb23a6e05ed15d2612e0341664948f682364a`

## commit_sha

`pending_B_review`

## contract_subscription

- `AGENTS.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-repo-governance-physical-compaction.md`

## allowed_write_scope

- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-repo-governance-physical-compaction.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-post-absorb-repo-governance-truth.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `tests/contract/contract-test-v22-repo-governance-physical-compaction.mjs`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 `services/*` 业务代码。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不 build/push/kubectl/deploy/live-test。
- 不实现 PostgreSQL/Redis。
- 不改 Portal UI。

## implementation_summary

- 将 repo governance physical compaction 的 agent-run 从 `pending_B_review` 更新为已 B review、ff-only absorbed、pushed。
- 记录吸收提交 `3fa576b8809560629c5a1677ebacae9b76034810`。
- 记录 trunk-safe 修复提交 `b00bb23a6e05ed15d2612e0341664948f682364a`。
- 调整 repo governance gate，使其同时支持 A 分支 pending 态和 trunk absorbed 态。
- 新增本 post-absorb leaf 的 agent-run record。

## eval_first_changes

- 更新 `tests/contract/contract-test-v22-repo-governance-physical-compaction.mjs`，不再强制 agent-run 必须包含 `pending_B_review`，而是要求存在 pending 或 absorbed evidence。
- 新增 branch override，确保本 cleanup 分支只运行 post-absorb truth/gate 验证，不误跑 PostgreSQL/Redis leaf。

## blocker_review_and_fix_log

- B 吸收后发现 repo governance gate 在 trunk diff 为空时仍按 branch review 态检查 deletion-only diff。该问题已在 `b00bb23a6e05ed15d2612e0341664948f682364a` 修复。
- 本分支不继续扩大 smoke/eval 物理压缩范围；该事项仍应进入后续 `cleanup/v22-smoke-eval-physical-compaction`。

## verification_commands

- `node tests/contract/contract-test-v22-repo-governance-physical-compaction.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
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
- 未压缩 smoke/eval 全量文件。
- 未改服务代码。
- 未接真实云。
- 未读取 secret。
- 未修改 upstream。
- 未改 Portal UI。

## next_leaf

`cleanup/v22-smoke-eval-physical-compaction`
