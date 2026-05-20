# Agent Run: cleanup/v22-tests-taxonomy-hard-retirement

## meta

- schema_version: 1
- leaf_id: cleanup-v22-tests-taxonomy-hard-retirement
- run_kind: cleanup
- status: pending_b_review
- model: gpt-5.4
- branch: cleanup/v22-tests-taxonomy-hard-retirement
- base_trunk_head: 69c08908b84f68e252884fa532c5aef71ef4230e
- commit_sha: pending_B_review
- absorbed_commit: none
- supersedes: none
- superseded_by: none
- branch_override_id: tests-taxonomy-hard-retirement

## goal

按 tests/smoke 纵向 slice 做硬清退：把所有 v22 repo-local eval 从 `scripts/smoke-test-v22-*` 物理迁入 `tests/**`，把分类权威从 `scripts/v22-smoke-classification.mjs` 改为 `scripts/v22-test-classification.mjs`，并让 `scripts/` 只保留 runner、classifier、workflow 和 support utilities。本分支不保兼容层、不双轨、不恢复旧 smoke 入口。

## subagents_and_models

- Anscombe: `gpt-5.4`，只读审计 tests/smoke/eval 引用链、manifest 命令、旧脚本路径和迁移后 import 风险；不写文件、不提交、不 push。

## contract_subscription

- `AGENTS.md`
- `docs/active/README.md`
- `docs/README.md`
- `tests/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/agent-runs/schema.md`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `tests/health/health-check-v22-smoke-classification-gate.mjs`
- `tests/health/health-check-v22-smoke-eval-boundary.mjs`

## allowed_write_scope

- `AGENTS.md`
- `README.md`
- `DESIGN.md`
- `docs/**/*.md`
- `docs/recovery/*.json`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-tests-taxonomy-hard-retirement.md`
- `tests/README.md`
- `tests/**/*.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-agent-workflow.mjs`
- delete: `scripts/smoke-test-v22-*.mjs`
- delete: `scripts/v22-smoke-classification.mjs`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 upstream。
- no build/deploy/kubectl/live-test。
- 不修改 `services/*` 业务代码。
- 不修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不 build/deploy/kubectl/live-test。
- 不执行 git push、ff-only absorb 或 merge trunk。
- 不实现 PostgreSQL/Redis local production data layer。
- 不实现 admin business closure。
- 不改 Figma Portal UI 视觉、布局、信息架构。
- 不增加 legacy smoke compatibility wrapper。

## implementation_summary

- 将 154 个既有 `scripts/smoke-test-v22-*.mjs` 迁到 `tests/**`，并新增 1 个 hard-retirement gate；当前 v22 repo-local eval 总数为 155。
- 将 `scripts/v22-smoke-classification.mjs` 重命名为 `scripts/v22-test-classification.mjs`，分类统计为 health-check 6、smoke-golden 11、contract-local 28、local-regression 62、future-authorized 48、retired 0。
- 更新 `scripts/v22-verify.mjs`、`scripts/v22-workflow-gate.mjs`、manifest、合同文档、recovery 文档和 tests README，使活跃执行入口全部指向 `tests/**`。
- 修正迁移后的相对 import，确保 `tests/smoke/*`、`tests/regression/*/*`、`tests/future-authorized/cloud/*` 和 `tests/contract/runtime-bridge/*` 都能从新目录解析 repo 内模块。
- 新增 `tests/contract/contract-test-v22-tests-taxonomy-hard-retirement.mjs`，验证旧 scripts eval 入口不存在、classification 与 tracked tests 文件一致、manifest 不执行旧路径、agent-run 留痕存在且禁区未触碰。
- 更新 `docs/active/README.md` 与 `tests/README.md`，把 tests taxonomy 写成当前真相而不是未来 skeleton。

## eval_first_changes

- 先新增 hard-retirement branch override 和 classification entry，使 `tests-taxonomy-hard-retirement` gate 能表达本分支验收条件。
- 在 gate 中先断言旧 `scripts/smoke-test-v22-*` 和 `scripts/v22-smoke-classification.mjs` 不得存在，再迁移文件和 runner 引用。
- 本分支不新增业务实现 eval；只改变 eval 文件归属、分类权威和执行入口。

## blocker_review_and_fix_log

- blocker: 迁移后多个 eval 文件仍使用原 `../services`、`../docs`、`../../../../../scripts` 相对路径。fix: 按新 tests 目录深度修正 import。
- blocker: 历史 docs 和 gate 中存在 `node scripts/smoke-test-v22-*` 活跃入口。fix: 活跃命令改为 `node tests/**/smoke-test-v22-*.mjs`；剩余旧路径只允许作为 retired pattern 或负向断言。
- blocker: `tests/README.md` 初始仍写 skeleton 和旧 classification 文件名。fix: 更新为 active tests taxonomy 和当前统计。
- blocker: `docs/active/README.md` 初始仍写 tests 尚未迁入。fix: 改为 tests 已承载 repo-local eval，剩余债务是文件名前缀语义。

## verification_commands

- `node tests/contract/contract-test-v22-tests-taxonomy-hard-retirement.mjs`
- `node tests/health/health-check-v22-smoke-classification-gate.mjs`
- `node tests/health/health-check-v22-smoke-eval-boundary.mjs`
- `node tests/contract/contract-test-v22-agent-run-record-gate.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts`
- forbidden path diff scan
- added-lines secret value scan

## b_review_result

pending_B_review

## post_absorb_verification

not_applicable_yet

## runtime_notes

本分支没有启动 Portal、OPL Gateway、Runtime Bridge、PostgreSQL、Redis、真实云或 deploy runtime；没有读取 secret；没有执行 build/deploy/kubectl/live-test；没有写 `.runtime` evidence。

## non_goals

- 不实现 PostgreSQL/Redis local production data closure。
- 不实现 admin 全业务闭环。
- 不接真实云、不执行 deploy 或 live-test。
- 不修改 services 业务代码。
- 不把 155 个 repo-local eval 都改名为 smoke。
- 不清退 `docs/specs/**` 或 `docs/recovery/**` 的 machine-boundary 文件。
- 不改 Portal Figma UI 视觉、布局或信息架构。

## next_leaf

B 窗口 fresh review / ff-only absorb / push 后，下一刀建议继续沿纵向 slice 做 `cleanup/v22-test-filename-semantic-retirement`，把非 smoke eval 的 `smoke-test-v22-*` 文件名前缀改成 `eval-test-v22-*` 或仓库确认的新命名；业务 cursor 仍是 `leaf-portal-postgres-redis-local-production-data-closure`。
