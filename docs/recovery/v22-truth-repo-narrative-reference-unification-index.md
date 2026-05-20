# v22 Truth Repo Narrative Reference Unification Index

本索引记录 `cleanup/v22-truth-repo-narrative-reference-unification` 的 A 窗口全文档/脚本审计和口径收敛裁定。它不是新产品合同，不改变业务 cursor，不实现 PostgreSQL/Redis，不接真实云；它只把 root governance、contracts、recovery、scripts 四组文件读完后，按 `contracts / truth / index / eval / agent-runs` 五层权威归类，并修正仍把 cloud onboarding board / program board / `v22-agent-workflow.mjs` 当 current truth 的根级叙事。

## 基线

- base trunk: `49b99d6739fff6f033118b009c36b53d29c675a5`
- branch: `cleanup/v22-truth-repo-narrative-reference-unification`
- current cursor: `leaf-portal-postgres-redis-local-production-data-closure`
- risk class: `local_doc_eval`
- total audited tracked files: `259`
- audited line count: `67205`
- root governance docs: `8`
- contract files: `43`
- recovery files: `53`
- script files: `162`
- delete-ready files: `0`

## 模型与 Subagent 审计

- 总控 / 集成：`gpt-5.4`
- root governance docs auditor：`gpt-5.4`
- contracts auditor：`gpt-5.4`
- recovery truth/index auditor：`gpt-5.4`
- scripts smoke/eval auditor：`gpt-5.4`

四个 subagent 都是只读审计：未改文件、未读 secret、未触云、未执行 build/deploy/kubectl/live-test。审计范围覆盖 `AGENTS.md`、`README.md`、`docs/*.md`、`docs/specs/**`、`docs/recovery/**`、`scripts/**`。

## 五层权威

| Layer | 当前权威 | 规则 |
| --- | --- | --- |
| contracts | `AGENTS.md`, `docs/specs/README.md`, `docs/specs/README.md` | 长期不变量、接口边界、授权边界、非目标。 |
| truth | `docs/product.md`, `docs/architecture.md`, `docs/recovery/product-truth.md`, `docs/recovery/architecture-truth.md`, `docs/recovery/v22-truth-freeze.md`, `docs/recovery/status-matrix.md`, `docs/recovery/mvp-contract-acceptance.md` | 当前产品、架构、数据、云、治理事实。 |
| index | `docs/recovery/v22-goal-current.json`, `docs/recovery/v22-agent-verify-manifest.json`, `docs/recovery/v22-current-vs-ideal-gap-matrix.md`, compaction indexes | current cursor、next leaf、allowed files、forbidden surface、verification bundle、cleanup 顺序。 |
| eval | `scripts/v22-verify.mjs`, `scripts/v22-test-classification.mjs`, `tests/**/*.mjs` | 机器验收入口；smoke 只指 health/golden，小范围之外都叫 eval/local-regression/future-authorized。 |
| agent-runs | `docs/recovery/agent-runs/*` | 每一步执行证据、模型、subagent、验证、B review、吸收和未做事项。 |

## Root Governance 裁定

| File | Layer | Decision | Reason |
| --- | --- | --- | --- |
| `AGENTS.md` | truth / discipline | keep | 根治理纪律、授权红线、污染防护。 |
| `README.md` | index | keep | 仓库入口和 active surface 索引。 |
| `docs/product.md` | truth | keep | 产品真相。 |
| `docs/architecture.md` | truth | keep | 架构真相。 |
| `docs/status.md` | truth summary | keep / narrowed | 人读状态入口；机器 truth 已降到 `v22-goal-current.json`。 |
| `docs/invariants.md` | truth | keep / narrowed | 长期不变量；不再绑定 cloud onboarding board 为 current truth。 |
| `docs/decisions.md` | truth | keep / narrowed | 当前有效决策；cloud onboarding 降为 future-authorized lane。 |
| `docs/vibe-coding.md` | workflow discipline | keep / narrowed | agent workflow 纪律；`v22-agent-workflow.mjs` 只保留为 blocked-retain 参考。 |

## Contracts 裁定

- long-term contracts: keep.
- active MVP/user loop contracts: keep.
- future-authorized/cloud contracts: keep but demoted in index language; they do not authorize real cloud, deploy, kubectl, live-test or secret reads.
- blocked-retain evidence contracts: keep.
- strongest cleanup candidate: `docs/specs/README.md`, but it is not delete-ready because references are not fully migrated.
- delete-ready contracts: `0`.

## Recovery 裁定

- truth files: keep.
- index/current files: keep.
- eval metadata / validation paths / runbooks: keep.
- agent-runs: keep.
- program board, cloud onboarding board/status/matrix, and duplicate governance docs: blocked-retain until references migrate.
- `49b99d6739fff6f033118b009c36b53d29c675a5` is now recorded as the absorbed post-20fe9ac trace commit in the post-20fe9ac agent-run and gate.
- delete-ready recovery files: `0`.

## Scripts / Eval 裁定

- main verification authority: `scripts/v22-verify.mjs` + `docs/recovery/v22-agent-verify-manifest.json`.
- smoke/eval classification authority: `scripts/v22-test-classification.mjs`.
- `scripts/v22-workflow-gate.mjs`: keep as review/checkpoint guard.
- `scripts/v22-agent-workflow.mjs`: blocked-retain / retire-candidate; not current truth, not default eval entrypoint, not auto-merge/push automation.
- cloud onboarding `CO-*` / board family: future-authorized / blocked-retain; not current product cursor.
- delete-ready scripts: `0`.

## 本轮收敛

- `docs/status.md` now points current truth to `v22-goal-current.json`, verification to `v22-agent-verify-manifest.json`, and eval execution to `scripts/v22-verify.mjs`.
- `docs/invariants.md` removes stage-board-as-current-truth wording and records cloud/program boards plus `v22-agent-workflow.mjs` as future-authorized / blocked-retain references.
- `docs/decisions.md` no longer says the active program is `v22-cloud-onboarding`; it records the active cursor and future-authorized cloud lane boundary.
- `docs/vibe-coding.md` keeps the cloud workflow reference required by the cloud workflow contract, but demotes `scripts/v22-agent-workflow.mjs` to blocked-retain / retire-candidate.
- `tests/contract/contract-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs` no longer requires origin trunk to equal historical `20fe9ac`; it verifies `20fe9ac` and `49b99d` remain ancestors of current origin trunk.
- `tests/contract/contract-test-v22-long-term-governance-surfaces.mjs` now verifies `v22-goal-current + v22-agent-verify-manifest + v22-verify` as current entrypoints and blocks old root governance active-cloud wording.

## Blocked Retain

These are still retained until references migrate:

- `docs/recovery/v22-program-board.md`
- `docs/recovery/v22-program-status-table.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `docs/recovery/cloud-onboarding-verification-matrix.md`
- `scripts/v22-agent-workflow.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-agent-workflow-cloud-onboarding.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-board-status.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-cloud-onboarding-absorption-sequence.mjs`
- `tests/future-authorized/cloud/future-authorized-test-v22-cloud-connection-runnable-path.mjs`
- `docs/specs/README.md`
- `docs/specs/README.md`

## Delete-Ready

无。

删除条件仍保持四项同时满足：

1. 替代权威已存在。
2. 所有引用已迁移。
3. gate 已覆盖旧叙事回流。
4. 不触碰 forbidden surface、current truth、future-authorized boundary 或 B review 证据。

## 非目标

- 不实现 PostgreSQL/Redis。
- 不改 `services/*` 业务代码。
- 不接真实云。
- 不读取 secret。
- 不修改 upstream。
- 不 build/deploy/kubectl/live-test。
- 不改 Figma Portal UI。
- 不物理删除仍有活引用的合同、recovery 文档或 eval 脚本。
