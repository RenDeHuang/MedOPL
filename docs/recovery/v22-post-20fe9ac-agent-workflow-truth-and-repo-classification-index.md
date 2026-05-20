# v22 Post-20fe9ac Agent Workflow Truth and Repo Classification Index

本索引记录 `cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification` 的 A 窗口裁定。它不是新产品合同，不改变业务 cursor，不实现 PostgreSQL/Redis，不接真实云；它只补 `20fe9ac` 的 post-absorb 证据、记录 A/B 边界偏差、固定全仓分类结论，并收紧 detached trunk 验证语义。

Layer authority phrase: `contracts / truth / index / eval / agent-runs`.

## 基线

- base trunk: `20fe9ac2f4a8b94a0281032e44592c820ac7502c`
- accepted absorbed commit: `20fe9ac2f4a8b94a0281032e44592c820ac7502c`
- trace absorbed commit: `49b99d6739fff6f033118b009c36b53d29c675a5`
- current cursor: `leaf-portal-postgres-redis-local-production-data-closure`
- branch: `cleanup/v22-post-20fe9ac-agent-workflow-truth-and-repo-classification`
- risk class: `local_doc_eval`

## Workflow Truth

`20fe9ac` 的内容被接受，并已进入 `origin/recovery/platform-v22-trunk`。该提交完成 contract / smoke / eval / index compaction：补总索引、补 gate、扩展 smoke/eval 元数据、记录上一轮 smoke/eval physical compaction 的 post-absorb 事实。

持续验证规则：20fe9ac must remain an ancestor of `origin/recovery/platform-v22-trunk`，而不是要求当前 trunk 永远等于 `20fe9ac`。该 post-absorb trace leaf 已由 B 吸收并 push 到 `49b99d6739fff6f033118b009c36b53d29c675a5`；后续 trunk 前进时，本 gate 只验证历史吸收事实仍在 trunk 祖先链上，避免历史 gate 阻塞后续主线。

本轮同时记录流程偏差：`20fe9ac` 的 absorb/push 动作由 authoring conversation 执行，而不是独立 B 窗口执行。该偏差不改变代码内容裁定，但必须进入 agent-run 证据。恢复后的规则为：

- A window：从最新 trunk 开分支，完成合同订阅、eval-first、实现/清退、验证、commit、B-review packet。
- B window：fresh review、ff-only absorb、push、post-push verification。
- A 不再执行 absorb/push；B 不做大功能开发。

## Subagent Audit

| Scope | Model | Result |
| --- | --- | --- |
| `docs/contracts/**` | `gpt-5.4-mini` | 43 个合同 Markdown 文件均不是 delete-ready；12 个 future-authorized / 阶段合同是 retire-candidate，但仍承担授权边界。 |
| `docs/recovery/**` | `gpt-5.4-mini` | recovery 层稳定分为 truth / index / agent-runs / blocked-retain / retire-candidate；无 delete-ready。 |
| `scripts/**` | `gpt-5.4-mini` | 149 个 `smoke-test-v22-*` 均已分类；只有 health-check 和 smoke-golden 是 smoke，其余是 eval / future-authorized / wrapper / gate-self-test。 |
| reference chain | `gpt-5.4-mini` | 所有可疑 retire 候选仍有活引用；替代权威已存在但旧引用未迁完，因此无 delete-ready。 |

## 分类裁定

| Layer | 当前权威 | Decision |
| --- | --- | --- |
| contracts | `AGENTS.md`, `docs/contracts/README.md`, `docs/contracts/v22-*.md` | keep / blocked-retain；无 delete-ready。 |
| truth | `docs/product.md`, `docs/architecture.md`, `docs/recovery/product-truth.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/v22-truth-freeze.md`, `docs/recovery/status-matrix.md`, `docs/recovery/mvp-contract-acceptance.md` | keep。 |
| index | `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, compaction indexes | keep；本文件加入治理索引层。 |
| eval | `scripts/v22-verify.mjs`, `scripts/v22-test-classification.mjs`, `tests/**/*.mjs` | keep / blocked-retain；无 delete-ready。 |
| agent-runs | `docs/recovery/agent-runs/*` | keep；补 `20fe9ac` post-absorb 与 A/B 边界偏差。 |

## Delete-Ready

无。

删除条件仍保持四项同时满足：

1. 已有替代 truth / index / eval。
2. 所有引用已迁移。
3. 有 gate 防止旧叙事恢复。
4. 不触碰 forbidden surface，不删除 current truth、B review 证据或 future-authorized 云边界。

## Blocked Retain Summary

本轮确认以下组仍是 blocked-retain，不物理删除：

- `docs/recovery/active-surface.md`
- `docs/recovery/archive-policy.md`
- `docs/recovery/decisions.md`
- `docs/recovery/legacy-cleanup-backlog.md`
- `docs/recovery/system-domain-truth-layer-matrix.md`
- `docs/recovery/v22-agent-first-development-loop.md`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/v22-product-goal.md`
- `docs/recovery/v22-program-board.md`
- `docs/recovery/v22-program-status-table.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `scripts/v22-agent-workflow.mjs`
- `scripts/sync-workspace-file-to-minio.ps1`
- `tests/contract/contract-test-v22-mvp-contract-suite.mjs`
- `tests/health/health-check-v22-workflow-gate.mjs`

## Gate Tightening

- `tests/contract/contract-test-v22-goal-state-consistency.mjs` now treats detached runtime as target trunk only when `git branch --show-current` is empty and `HEAD == origin/recovery/platform-v22-trunk`.
- Detached HEAD that is not exactly origin trunk remains fail-closed.
- New gate: `tests/contract/contract-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs`.

## Non-Goals

- 未实现 PostgreSQL/Redis。
- 未实现 admin business closure。
- 未接真实云。
- 未读取 secret。
- 未修改 upstream。
- 未 build/deploy/kubectl/live-test。
- 未改 Portal UI。
- 未物理删除仍有活引用的合同、recovery 文档或 eval 脚本。
