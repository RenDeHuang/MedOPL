# Agent Run: Contract Eval Compaction

- leaf_id: cleanup-v22-contract-eval-compaction
- goal: Compact the post-truth-freeze contract/eval surface by replacing misleading old canonical loop naming, recording a contract/eval index, and updating the user-opened storage deletion protection truth.
- model: gpt-5.4
- subagents_and_models:
  - Ampere: gpt-5.4, read-only diff/boundary auditor for allowed scope, storage retention truth, retired naming residue, and governance layer classification.
- branch: cleanup/v22-contract-eval-compaction
- base_trunk_head: dd69e3970a968c2baec031b718cefc18b81c2275
- commit_sha: pending_B_review

## contract_subscription

- AGENTS.md
- docs/contracts/README.md
- docs/contracts/v22-smoke-eval-boundary.md
- docs/contracts/v22-mvp-managed-opl-loop.md
- docs/contracts/v22-saas-control-plane-user-experience-boundary.md
- docs/contracts/v22-resource-plan-boundary.md
- docs/contracts/v22-authorized-tencent-create-release-boundary.md
- docs/recovery/v22-truth-freeze.md
- docs/recovery/product-truth.md
- docs/recovery/architecture-truth.md
- docs/recovery/v22-agent-verify-manifest.json
- scripts/v22-smoke-classification.mjs

## allowed_write_scope

- docs/recovery/v22-contract-eval-compaction-index.md
- docs/recovery/v22-truth-freeze.md
- docs/recovery/product-truth.md
- docs/recovery/architecture-truth.md
- docs/recovery/v22-agent-verify-manifest.json
- docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-eval-compaction.md
- scripts/smoke-test-v22-contract-eval-compaction.mjs
- scripts/smoke-test-v22-mvp-user-loop-contract.mjs
- scripts/smoke-test-v22-canonical-user-loop-contract.mjs deletion/rename only
- scripts/v22-smoke-classification.mjs

## forbidden_scope

- 不调用真实云。
- 不读取 secret。
- 不修改 upstream。
- 不修改 services/* 业务代码。
- 不修改 deploy/*、.sentrux/*、adapters/*、infra/*。
- 不 build/deploy/kubectl/live-test。
- 不改 Figma Portal UI。
- 不实现 PostgreSQL/Redis 或 admin 业务闭环。

## implementation_summary

- 新增 contract/eval compaction index，明确 keep/rename/delete/future-authorized 的裁定规则。
- 将 `smoke-test-v22-canonical-user-loop-contract.mjs` 改名为 `smoke-test-v22-mvp-user-loop-contract.mjs`，保留 golden loop 覆盖但清退旧 canonical 命名。
- 更新 truth freeze、product truth、architecture truth：用户在 Portal 主动开通托管计算资源和文件空间；平台代管底层云资源；用户删除文件空间才进入 7 天保护期；释放计算资源不触发文件空间保护期。
- 新增 compaction gate 并接入 verify manifest branch override。

## eval_first_changes

- RED: `node scripts/smoke-test-v22-contract-eval-compaction.mjs` 初始失败，缺少 `docs/recovery/v22-contract-eval-compaction-index.md`。
- GREEN target: compaction index、MVP loop gate rename、storage deletion truth、manifest override、classification 和 agent-run record 同时成立。

## blocker_review_and_fix_log

- Read-only auditor Ampere returned no blockers.
- Important finding: truth layer still carried physical cleanup history. Fixed by moving retired stage-file evidence into `docs/recovery/v22-contract-eval-compaction-index.md` and tightening `scripts/smoke-test-v22-truth-freeze-physical-retirement.mjs`.
- Important finding: branch override `allowed_files` still carried the retired canonical loop gate. Fixed by moving it to `retired_files` and adding a compaction gate assertion.
- Minor finding: duplicate release-compute storage-retention wording in product truth. Fixed by removing the redundant line.

## verification_commands

- node scripts/smoke-test-v22-contract-eval-compaction.mjs
- node scripts/smoke-test-v22-mvp-user-loop-contract.mjs
- node scripts/smoke-test-v22-smoke-classification-gate.mjs
- node scripts/smoke-test-v22-golden-smoke-suite.mjs
- node scripts/smoke-test-v22-goal-state-consistency.mjs
- node scripts/smoke-test-v22-agent-verify-entrypoint.mjs
- node scripts/smoke-test-v22-product-goal-harness.mjs
- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
- node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json
- node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
- git diff --check -- docs/recovery scripts

## b_review_result

pending_B_review

## non_goals

- 不接真实云。
- 不读取 secret。
- 不修改 upstream。
- 不部署。
- 不改 Portal UI。
- 不实现 PostgreSQL/Redis。

## next_leaf

leaf-portal-postgres-redis-local-production-data-closure remains the next implementation cursor after B review and absorb.
