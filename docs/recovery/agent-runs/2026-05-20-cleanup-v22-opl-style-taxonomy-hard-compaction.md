# Agent Run: cleanup/v22-opl-style-taxonomy-hard-compaction

## meta

- schema_version: 1
- leaf_id: cleanup-v22-opl-style-taxonomy-hard-compaction
- run_kind: cleanup
- status: pending_b_review
- model: gpt-5.4
- branch: cleanup/v22-opl-style-taxonomy-hard-compaction
- base_trunk_head: 77b1614d06b68601a6f9a573911511e4c8545026
- commit_sha: pending_B_review
- absorbed_commit: none
- supersedes: none
- superseded_by: none
- branch_override_id: opl-style-taxonomy-hard-compaction

## goal

按 OPL-style lifecycle taxonomy 推进硬清退：把当前产品、架构、source surface 真相压缩到唯一人读 current truth `docs/active/README.md`，把 `docs/product/README.md`、`docs/runtime/README.md`、`docs/source/README.md` 降为视角入口，并在引用迁移后物理清退首批 recovery truth 文件。

## subagents_and_models

- Lagrange: `gpt-5.4`，只读审计 truth/current/product/runtime/source 文件，裁定可吸收和可删除对象。
- Leibniz: `gpt-5.4`，只读审计 contracts/specs 引用链，裁定合同 leaf 是否可删。
- Locke: `gpt-5.4`，只读审计 delivery/policies/history/agent-runs，裁定 evidence 和 history 边界。
- Halley: `gpt-5.4`，只读审计 tests/scripts 分类和迁移风险。

## contract_subscription

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/agent-runs/schema.md`

## allowed_write_scope

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/specs/README.md`
- `docs/vibe-coding.md`
- `docs/recovery/repo-zoning.md`
- `docs/recovery/v22-agent-first-development-loop.md`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/agent-runs/2026-05-20-cleanup-v22-opl-style-taxonomy-hard-compaction.md`
- `tests/contract/contract-test-v22-opl-style-taxonomy-hard-compaction.mjs`
- `tests/contract/contract-test-v22-docs-taxonomy-skeleton.mjs`
- `tests/contract/contract-test-v22-contract-eval-compaction.mjs`
- `tests/contract/contract-test-v22-contract-smoke-eval-index-compaction.mjs`
- `tests/contract/contract-test-v22-default-entry-narrative-gate.mjs`
- `tests/regression/opl/regression-test-v22-gflabtoken-entry-contract.mjs`
- `tests/regression/opl/regression-test-v22-opl-dual-entry-contract.mjs`
- `tests/contract/contract-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs`
- `tests/contract/contract-test-v22-product-goal-harness.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-real-resource-contract-alignment.mjs`
- `tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`
- `tests/contract/contract-test-v22-truth-freeze-physical-retirement.mjs`
- `scripts/v22-agent-workflow.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`
- delete: `docs/recovery/product-truth.md`
- delete: `docs/recovery/architecture-truth.md`
- delete: `docs/recovery/active-surface.md`

## forbidden_scope

- 不读取 secret。
- 不调用真实云。
- 不修改 upstream。
- 不 build/deploy/kubectl/live-test。
- 不修改 `services/*`、`deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- 不实现 PostgreSQL/Redis production data layer。
- 不实现 admin/business closure。
- 不改 Figma Portal UI 视觉、布局、信息架构。
- 不 push、不 merge trunk、不执行 ff-only absorb。

## implementation_summary

- 将 `docs/active/README.md` 扩展为唯一人读 current truth，吸收产品定位、资源生命周期、7 天保护期、套餐、gflabtoken、Portal canonical data、PostgreSQL/Redis 方向、object/blob plane、OPL upstream、active source surface 和 cannot-claim。
- 将 `docs/product/README.md`、`docs/runtime/README.md`、`docs/source/README.md` 改为视角入口，统一指向 `docs/active/README.md`，不再复制 current truth。
- 将活跃脚本、manifest、合同索引和 workflow 包中的旧 recovery truth 引用迁移到 `docs/active/README.md`。
- 物理清退 `docs/recovery/product-truth.md`、`docs/recovery/architecture-truth.md`、`docs/recovery/active-surface.md`。
- 新增 hard-compaction gate，验证旧 truth 文件不存在、活跃引用迁移完成、manifest 不再引用旧路径、branch override 不误跑 PostgreSQL/Redis 当前业务 leaf。

## eval_first_changes

- 新增 `tests/contract/contract-test-v22-opl-style-taxonomy-hard-compaction.mjs`。
- 将 hard-compaction gate 加入 `scripts/v22-test-classification.mjs`。
- 将 hard-compaction gate 加入 `docs/recovery/v22-agent-verify-manifest.json` 的 branch override 与 local-contract suite。
- 调整 `tests/contract/contract-test-v22-docs-taxonomy-skeleton.mjs`，只在原 skeleton 分支执行 diff allowlist；在 trunk/local-contract 语境下只验证 taxonomy 结构不退化。

## blocker_review_and_fix_log

- blocker: 旧 `docs-taxonomy-skeleton` gate 对任意分支强制 skeleton allowlist，会阻断后续硬清退。fix: 只在 `cleanup/v22-docs-taxonomy-skeleton` 分支执行该 diff allowlist。
- blocker: `scripts/**`、manifest 和合同索引仍直接读取 `docs/recovery/product-truth.md`、`docs/recovery/architecture-truth.md`、`docs/recovery/active-surface.md`。fix: 活跃读取路径迁到 `docs/active/README.md`。
- blocker: 历史 agent-run 和 compaction index 仍包含旧路径。fix: hard-compaction gate 将这些保留为历史证据，不把它们视为 current truth 或 active ref。

## verification_commands

- `node tests/contract/contract-test-v22-opl-style-taxonomy-hard-compaction.mjs`
- `node tests/contract/contract-test-v22-docs-taxonomy-skeleton.mjs`
- `node tests/health/health-check-v22-smoke-classification-gate.mjs`
- `node tests/health/health-check-v22-smoke-eval-boundary.mjs`
- `node tests/contract/contract-test-v22-agent-run-record-gate.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts`
- added-lines secret value scan
- forbidden path diff scan

## b_review_result

pending_B_review

## post_absorb_verification

not_applicable_yet

## runtime_notes

本分支没有启动 Portal、OPL Gateway、Runtime Bridge 或真实云资源；没有读取 secret；没有执行 build/deploy/kubectl/live-test；没有写 `.runtime` evidence。

## non_goals

- 不实现 PostgreSQL/Redis local production data closure。
- 不迁移全部 `tests/**/*.mjs` 到 `tests/**`。
- 不删除 42 个 `docs/specs/v22-*` machine-boundary leaf。
- 不删除 `docs/recovery/v22-goal-current.json`、manifest、gap matrix、status matrix 或 agent-run evidence。
- 不修改 services 业务代码。

## next_leaf

本 cleanup 分支交 B fresh review / ff-only absorb / push 后，下一步仍应回到 `leaf-portal-postgres-redis-local-production-data-closure`，除非 B review 发现本次 hard compaction 需要 post-absorb truth 修正。
