# MedOPL v22 Tests

Owner: `MedOPL`
Purpose: `tests_taxonomy_truth`
State: `active`

`tests/**/*.mjs` 是 v22 repo-local eval 文件族，不再混放在 `scripts/`。只有 `tests/health/*` 与 `tests/smoke/*` 的 golden path 可以被称为 smoke；其余属于 contract、regression 或 future-authorized eval。

## Taxonomy

- `tests/health/`: 最小健康和仓库纪律 gate。
- `tests/smoke/`: 用户主线 golden smoke。
- `tests/contract/`: 本地合同和治理 eval。
- `tests/regression/portal/`: Portal regression eval。
- `tests/regression/opl/`: OPL / Gateway regression eval。
- `tests/regression/runtime-bridge/`: Runtime Bridge regression eval。
- `tests/future-authorized/cloud/`: future-authorized cloud boundary eval；不授权真实云。
- `tests/fixtures/v22/`: 机器 cursor 和 verify manifest。

## Cleanup Lifecycle Gate Policy

`tests/contract/` 承载治理闭环 gate。生命周期 gate 必须验证：

- docs taxonomy 不恢复旧 contracts 目录、旧 recovery 目录或 root stage docs。
- `docs/active/README.md`、`docs/specs/README.md`、`docs/policies/README.md`、`docs/history/README.md` 和 `tests/README.md` 均声明 OPL-style cleanup lifecycle。
- 已通过 landing gate 的 cleanup 记录不能长期停在 `ready_for_landing_review`。
- 当前业务 cursor 仍由 `tests/fixtures/v22/goal-current.json` 表达。
- verify manifest 必须把 cleanup lifecycle gate 纳入 `current` 和 `local-contract`。

新增测试必须先选定 taxonomy 目录；不能为了便利新增 `scripts/smoke-test-*` 或把所有 repo-local eval 叫 smoke。

`docs/README.md` 必须把本文件作为 lifecycle taxonomy 的验证入口之一；docs 负责解释 truth，tests/fixtures/manifest 负责防止 truth、cursor、history 和 eval 漂移。

## Test Lane Registry

`scripts/v22-test-classification.mjs` 是显式 test lane registry。每个 `tests/**/*.mjs` 文件必须登记 lane、tier、surface、entryKind、authorization、contract refs 和 verify suites；不得再靠文件名或目录启发式推断测试分类。

Registry coverage gate 是 `node tests/contract/contract-test-v22-test-lane-registry.mjs`。该 gate 必须确认：

- every `tests/**/*.mjs` file outside fixtures appears exactly once in `TEST_LANE_REGISTRY`;
- every registered test has at least one verify suite;
- every registry entry uses allowed lane/tier/surface/entryKind/authorization values;
- every registry entry references the single specs truth `docs/specs/README.md`.

## Active Test Lifecycle

active test 必须有 lane owner。每个 `tests/**/*.mjs` 都必须通过 registry 声明 `ownerSurface` 和 `lifecycleRole`，并且 active test 必须证明 current owner surface。

允许的 `lifecycleRole` 只有：

- `current-owner`: 证明当前产品、runtime、source、docs 或 workflow owner 的行为。
- `negative-retirement-guard`: 防止旧入口、旧兼容语义、secret/cloud/deploy 越界或 taxonomy 漂移复活。
- `suite-wrapper`: 只包装 active registered tests，不能包装不存在的旧路径。
- `future-authorized-boundary`: 只表达 future-authorized 边界，不授权真实云执行。

旧 alias / wrapper / facade / compat-only test 迁完 caller 后直接删除。historical proof / closeout evidence 不作为 active test 保留。duplicate aggregate test 必须合并或删除。history 只保摘要，git history 保细节。

Test lifecycle cleanup gate 是 `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`。该 gate 必须确认：

- every active test has `ownerSurface` and an allowed `lifecycleRole`;
- forbidden active roles such as historical-proof, compat-only, alias-only, wrapper-only, and closeout-evidence-only cannot appear;
- suite-wrapper entries remain active registered tests;
- the zero-compat active surface gate remains in health and local-contract.

## Docs Gate Boundary

Docs gates must verify structure, owner boundaries, file existence, retired-path protection, manifest consistency and closeout state. They must not assert prose wording as machine truth beyond stable owner/purpose/state/machine-boundary markers that protect taxonomy drift.

README-only taxonomy 是结构约束，不代表文档文本本身是机器接口。需要稳定机器判断时，必须新增 fixture schema、test lane registry、source contract 或 runner behavior；不能让 Markdown 章节标题成为默认 API。

## Runner Boundary

默认验证入口：

```bash
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
```

`scripts/` 只保 runner/classifier/workflow gate，以及仍被 services 引用的 workspace-to-minio sync helper；新增 repo-local eval 必须放到 `tests/**`。
