# MedOPL v22 Tests

Owner: `MedOPL`
Purpose: `product_validation_taxonomy`
State: `active`

`tests/**/*.mjs` 是 v22 repo-local eval 文件族，不再混放在 `scripts/`。测试围绕 active platform、product contracts、frontend/backend/runtime behavior、release boundary、cloud authorization、hygiene 和 golden path 组织；tests 是证据 consumer/gate，不是产品 truth owner。

## Lane Selection

测试选择先看改动 surface，再选 lane，不把所有问题都塞进同一套大回归里：

- **main lane**：默认主线 gate，承接健康、烟测、契约和回归的常规验证。
- **targeted lane**：按变更面选最小相关测试面，前端、后端、runtime、release、hygiene / registry 等都应先从对应目录和 runner 入口下手。
- **full/local RC lane**：用于发布前或大改动的本地 RC 证明，覆盖 main lane，并叠加与本次变更相关的 targeted lane。
- **authorized lane**：只在显式授权边界内运行，面向受控 cloud / provider / dry-run / readonly diagnostics；它不是 production 证明，也不自动获得真实云执行权限。

开发者不应在没有筛选的情况下直接跑“全部测试”来代替判断。正式 review 前，至少完成 main lane 加 relevant targeted lane；发布或大改动时，再升级到 full/local RC lane。local / full / RC 只说明本地或受控环境通过，不能 claim production。authorized cloud lane 也只覆盖授权包内的边界，不等于真实云授权。

## Taxonomy

- `tests/product/`: MedOPL product profile、commercial package、active platform 和 product contract eval。
- `tests/frontend/`: Portal UI route/page-state、frontend API client 和 browser-facing behavior eval。
- `tests/backend/`: Go control-plane API、route coverage、Postgres/data-plane 和 billing ledger eval。
- `tests/runtime/`: Runtime Bridge、Gateway、clean upstream OPL boundary 和 artifact/session/run eval。
- `tests/release/`: release boundary、claim boundary、evidence redaction 和 cannot-claim eval。
- `tests/hygiene/`: repo hygiene、secret hygiene、line budget、registry 和 runner sanity gate。
- `tests/health/`: 最小健康 gate，长期应收敛到 `tests/hygiene/` 或 thin suite。
- `tests/smoke/`: 用户主线 golden smoke。
- `tests/contracts/`: true API/schema/runtime/data/release contract eval；tests 是 gate/consumer，不是 truth owner。
- `tests/governance/`: retired governance tests 的临时迁移区，不再新增；保留项必须迁到 product/release/hygiene/backend/runtime/cloud。
- `tests/suites/`: suite wrapper，只包装 active registered tests。
- `tests/regression/portal/`: Portal regression eval。
- `tests/regression/opl/`: OPL / Gateway regression eval。
- `tests/regression/runtime-bridge/`: Runtime Bridge regression eval。
- `tests/local-rc/`: 用户显式授权的 local release-candidate eval lane 占位；当前没有 active `.mjs` eval。未来恢复 local RC 必须通过新授权 package 注册，不能复用历史测试入口。
- `tests/cloud/`: future-authorized cloud boundary eval；只保留少数授权边界、dry-run/redaction 和 readonly diagnostics owner，不授权真实云，且不进入默认 `current` verify。
- `tests/fixtures/v22/`: 机器 cursor 和 verify manifest。

## Retired Governance Boundary

`changes/` 已退役，不再是测试、开发或 closeout 的默认入口。不得新增 `changes/active/**` 或 `changes/archive/**`，也不得让 default verify 依赖 change package lifecycle。旧治理测试只能作为临时迁移对象存在；长期约束必须下沉到 product contracts、release boundary、hygiene gate、source behavior 或 runner behavior。

新增测试必须先选定 product/frontend/backend/runtime/release/cloud/hygiene/support 目录；不能为了便利新增 `scripts/smoke-test-*` 或把所有 repo-local eval 叫 smoke。

`docs/README.md` 必须把本文件作为 lifecycle taxonomy 的验证入口之一；docs 负责解释 truth，tests/fixtures/manifest 负责防止 truth、cursor、history 和 eval 漂移。

## Test Lane Registry

`scripts/v22-test-classification.mjs` 是显式 test lane registry。每个 `tests/**/*.mjs` 文件必须登记 lane、tier、surface、entryKind、authorization、contract refs 和 verify suites；不得再靠文件名或目录启发式推断测试分类。

Registry coverage gate 是 `node tests/governance/governance-test-v22-test-lane-registry.mjs`。该 gate 必须确认：

- every `tests/**/*.mjs` file outside fixtures appears exactly once in `TEST_LANE_REGISTRY`;
- every registered test has at least one verify suite;
- every registry entry uses allowed lane/tier/surface/entryKind/authorization values;
- every registry entry references root `specs/**` machine owners rather than parsing `docs/specs/README.md` prose.

这里的 registry / manifest 是机器边界；Markdown 只提供人读导航，不是机器接口。需要稳定分类、授权或 lane 判断时，必须落到 registry、manifest、fixture、source contract 或 runner 行为，不能让 README 章节名承担机器 truth。

## Active Test Lifecycle

active test 必须有 lane owner。每个 `tests/**/*.mjs` 都必须通过 registry 声明 `ownerSurface` 和 `lifecycleRole`，并且 active test 必须证明 current owner surface。

允许的 `lifecycleRole` 只有：

- `current-owner`: 证明当前产品、runtime、source、docs 或 workflow owner 的行为。
- `negative-retirement-guard`: 防止旧入口、旧兼容语义、secret/cloud/deploy 越界或 taxonomy 漂移复活。
- `suite-wrapper`: 只包装 active registered tests，不能包装不存在的旧路径。
- `real-cloud-readiness-boundary`: 只表达 readonly inventory / readonly diagnostics 的本地 readiness gate；真实 provider evidence 只能写入 `.runtime` 或外部临时状态，不进 git，不授权 secret、真实云、deploy、kubectl 或 live-test。
- `future-authorized-boundary`: 只表达 explicit authorization fail-closed、runner dry-run/redaction 和 readonly diagnostics boundary；不授权真实云执行，不能保留 historical proof / closeout evidence / production topology 大测试作为 active eval。

旧 alias / wrapper / facade / compat-only test 迁完 caller 后直接删除。historical proof / closeout evidence 不作为 active test 保留。duplicate aggregate test 必须合并或删除。history 只保摘要，git history 保细节。

Test lifecycle cleanup gate 是 `node tests/governance/governance-test-v22-test-lifecycle-cleanup.mjs`。该 gate 必须确认：

- every active test has `ownerSurface` and an allowed `lifecycleRole`;
- forbidden active roles such as historical-proof, compat-only, alias-only, wrapper-only, and closeout-evidence-only cannot appear;
- suite-wrapper entries remain active registered tests;
- the zero-compat active surface gate remains in health and local-contract.

## Product Gate Boundary

Product gates must verify machine contracts, API/schema behavior, page-state matrix coverage, runtime/data/release boundary, retired-path protection, manifest consistency and evidence state. They must not assert prose wording as machine truth beyond stable owner/purpose/state/machine-boundary markers that protect taxonomy drift.

README-only taxonomy 是结构约束，不代表文档文本本身是机器接口。需要稳定机器判断时，必须新增 fixture schema、test lane registry、source contract 或 runner behavior；不能让 Markdown 章节标题成为默认 API。

## Runner Boundary

默认验证入口：

```bash
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs active-platform
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
```

`scripts/` 只保 runner/classifier/workflow gate；新增 repo-local eval 必须放到 `tests/**`。
