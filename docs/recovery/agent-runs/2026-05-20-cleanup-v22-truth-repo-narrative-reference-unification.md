# Agent Run: cleanup/v22-truth-repo-narrative-reference-unification

## leaf_id

`cleanup-v22-truth-repo-narrative-reference-unification`

## goal

阅读全文档和脚本，按 `contracts / truth / index / eval / agent-runs` 五层权威归类，修正 root governance 中把 cloud onboarding board / program board / `v22-agent-workflow.mjs` 作为 current truth 的旧叙事，补 `49b99d` post-absorb 留痕，并用 gate 固定“当前无 delete-ready，先迁引用再物理清退”的事实。

## model

总控 / 集成：`gpt-5.4`

## subagents_and_models

- Raman：`gpt-5.4`，只读审计 root governance docs。
- Kepler：`gpt-5.4`，只读审计 `docs/contracts/**`。
- Feynman：`gpt-5.4`，只读审计 `docs/recovery/**`。
- Averroes：`gpt-5.4`，只读审计 `scripts/**`、smoke/eval/classification/manifest 引用链。

## branch

`cleanup/v22-truth-repo-narrative-reference-unification`

## base_trunk_head

`49b99d6739fff6f033118b009c36b53d29c675a5`

## commit_sha

`d35d65ed94cef7fac0493c21643e36a690f57e4c`

## absorbed_commit

`d35d65ed94cef7fac0493c21643e36a690f57e4c`

## contract_subscription

- `AGENTS.md`
- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- `docs/status.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/vibe-coding.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-smoke-eval-boundary.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `docs/recovery/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification-index.md`
- `docs/recovery/v22-contract-smoke-eval-index-compaction-index.md`
- `scripts/v22-verify.mjs`
- `scripts/v22-smoke-classification.mjs`
- `scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs`
- `scripts/smoke-test-v22-long-term-governance-surfaces.mjs`

## allowed_write_scope

- `docs/status.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/vibe-coding.md`
- `docs/recovery/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification-index.md`
- `docs/recovery/v22-truth-repo-narrative-reference-unification-index.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.md`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-truth-repo-narrative-reference-unification.md`
- `scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs`
- `scripts/smoke-test-v22-long-term-governance-surfaces.mjs`
- `scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs`
- `scripts/smoke-test-v22-agent-verify-entrypoint.mjs`
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
- 不物理删除仍被引用的合同、recovery 文档或 eval 脚本。
- A 窗口不 ff-only absorb，不 git push。

## implementation_summary

- 收敛 `docs/status.md`：人读状态入口保留，机器 current truth 改指 `v22-goal-current.json`，验证入口改指 `v22-agent-verify-manifest.json` / `scripts/v22-verify.mjs`。
- 收敛 `docs/invariants.md`：长期不变量不再绑定 cloud onboarding board 为 current truth。
- 收敛 `docs/decisions.md`：不再声明 active program 是 `v22-cloud-onboarding`；cloud onboarding 降为 future-authorized lane。
- 收敛 `docs/vibe-coding.md`：保留 cloud workflow 合同引用，但把 `scripts/v22-agent-workflow.mjs` 明确降为 blocked-retain / retire-candidate，不是默认验证入口。
- 修复 post-20fe9ac gate：用 `git merge-base --is-ancestor` 验证 `20fe9ac` 和 `49b99d` 在当前 trunk 祖先链上，不再要求当前 origin trunk 等于历史 `20fe9ac`。
- 新增本轮分类索引和 gate，机器验证全文分类、root governance 口径、blocked-retain、无 delete-ready、branch override 和禁区 diff。

## eval_first_changes

- RED: `node scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs` 在 trunk 已前进到 `49b99d` 后失败，错误为 `origin_trunk_must_be_accepted_20fe9ac_for_this_post_absorb_leaf`。
- GREEN target: `20fe9ac` 和 `49b99d` 必须是当前 `origin/recovery/platform-v22-trunk` 祖先。
- RED: 新 gate `node scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs` 先失败于缺 agent-run record。
- GREEN target: 新增本 agent-run record，并接入 classification / manifest / agent-verify-entrypoint。

## blocker_review_and_fix_log

- root governance auditor 确认 `docs/status.md`、`docs/invariants.md`、`docs/decisions.md`、`docs/vibe-coding.md` 仍有旧 active cloud/program/workflow 口径，建议收敛为五层权威。
- contracts auditor 确认 43 个合同文件没有 delete-ready；`v22-admin-ops-console-boundary.md` 只是最强候选，但引用未迁完。
- recovery auditor 确认 53 个 recovery 文件没有 delete-ready；`49b99d` 缺显式 recovery 留痕，且 post-absorb trace leaf 需要闭合。
- scripts auditor 确认 162 个 scripts 文件没有 delete-ready；`v22-agent-workflow.mjs` 和 cloud onboarding CO-* family 是 blocked-retain / retire-candidate。
- 本轮不物理删除文件，只迁口径和 gate；下一轮若要删除，必须先完成引用迁移 gate。

## verification_commands

- `node scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs`
- `node scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs`
- `node scripts/smoke-test-v22-long-term-governance-surfaces.mjs`
- `node scripts/smoke-test-v22-smoke-classification-gate.mjs`
- `node scripts/smoke-test-v22-agent-verify-entrypoint.mjs`
- `node scripts/smoke-test-v22-agent-run-record-gate.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs README.md AGENTS.md scripts`
- added-lines secret value scan

## b_review_result

`passed / ff-only absorbed / pushed`

## post_absorb_verification

post_absorb_verification:

- B window verified `cleanup/v22-truth-repo-narrative-reference-unification` from base `49b99d6739fff6f033118b009c36b53d29c675a5`.
- B window ff-only absorbed commit `d35d65ed94cef7fac0493c21643e36a690f57e4c` into `recovery/platform-v22-trunk`.
- B window pushed `origin/recovery/platform-v22-trunk` to `d35d65ed94cef7fac0493c21643e36a690f57e4c`.
- B window reran `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`.
- B window reran `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`.
- B window reran `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`.
- B window reran `git diff --check`.
- B window confirmed forbidden diff was empty.
- B window confirmed added-lines secret scan found discipline text only and no secret values.

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
- 未物理删除文件。

## next_leaf

`leaf-portal-postgres-redis-local-production-data-closure`
