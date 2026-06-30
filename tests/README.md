# MedOPL v22 Tests

Owner: `MedOPL`
Purpose: `product_validation_taxonomy`
State: `active`

`tests/**/*.mjs` 是 v22 repo-local eval 文件族，不再混放在 `scripts/`。测试围绕 active platform、product contracts、frontend/backend/runtime behavior、release boundary、cloud authorization、hygiene 和 golden path 组织；tests 是证据 consumer/gate，不是产品 truth owner。

## Lane Selection

测试选择遵循 `Test Policy -> Discovery -> Preflight -> Run -> Report/Completion Gate`，不把所有问题都塞进同一套大回归里：

- **Test Policy**：machine policy 定义 changed-file surface、environment、authorization、cannot-claim 和默认命令升级规则；Markdown 只做人读导航。
- **Discovery**：runner 先消费 changed files 和 policy path / match rules，动态归类 main / targeted / authorized 候选面；surface metadata、contract refs、entry kind 和 authorization boundary 当前仍由 registry / manifest gate 校验，后续可继续并入 policy。
- **Preflight**：本轮只接受本地全动态测试系统。先执行 `npm run test:run-plan -- --dry-run --json`，读取 `changedFiles`、`matchedSurfaces`、`environments`、`authorizedEnvironments`、`reasons`、`recommendedCommands`、`authorizedCommands`、`preflight` 和 `cannotClaim`，确认 runner 只生成本地推荐命令，不自动升级到授权命令。
- **Run**：确认计划后执行 `npm run test:run-plan`，runner 只执行 `recommendedCommands`。不自动执行 `authorizedCommands`，不执行 cloud/live/deploy/kubectl，也不把 future authorized profile 当作当前已完成入口。
- **Report/Completion Gate**：计划输出里的 report、`cannotClaim` 和 preflight 结果都是完成判断的一部分；没有这些信息，不能声称闭环或 production readiness。
- **Production Receipt Gate**：authorized command 即使执行成功，也必须写入 receipt manifest；manifest 只放 receipt 指针和摘要，不放 raw cloud payload、日志、截图、上传文件或 artifact。`contracts/medopl-production-receipt-boundary.json` 和 `tests/release/release-test-v22-production-receipt-boundary.mjs` 决定 production complete 是否可声明。
- **Landing Gate**：每个 gap 可以 push feature branch 到 GitHub；feature branch push 只代表远端 review / backup，不代表 trunk landed。trunk landing 按 `current truth -> vision gap -> lane owner/consumer -> worktree branch -> implement -> run-plan -> targeted gates -> verify/review/bloat -> commit -> push feature branch -> ff-only merge trunk -> push trunk -> post-push verify -> tombstone cleanup` 执行。`ff-only merge trunk` 和 `push trunk` 必须先有 fresh landing gate；真实云、secret、provider call、kubectl、deploy、build/push 和 live-test 仍走授权包和 receipt。
- **Development Admission Gate**：`npm run slice:start -- --execute --slice-id <slice-id> --slice-type <product|automation|cloud|cleanup> --owner-surface <owner>` 写入 `.runtime/slices/<slice-id>/slice.json`。后续 `npm run gate:review -- --slice-id <slice-id>` 和 `npm run repo:bloat -- --diff --slice-id <slice-id>` 消费该 admission，自动拦截本轮 diff 的越界 owner path、新增顶层 `scripts/v22-*.mjs`、新增 `tests/health/*.mjs`、未准入 contract、cloud surface 越权和超线文件继续增长。默认 product slice 必须复用现有 runner/test lane，不能为了单个产品 gap 横向扩控制面。

- **scoped profile**：小修、复现问题和单 surface 调试先用 `npm run test:run-plan -- --profile scoped --files <path> --dry-run --json` 和 `npm run test:run-plan -- --profile scoped --files <path>`。`--profile scoped` 只推荐 changed-file surface 命中的 targeted commands，不自动加入 main lane、fast lane 或 lane registry gate；它不能替代 review、landing、release 或 deploy 证明。
- **changed-surface profile**：默认 review / landing 计划仍用 `--profile changed-surface`。它保留 main lane、fast lane、lane registry gate 和 changed-file surface targeted commands，用于把局部修复带回 trunk 前的常规验证。
- **full-local profile**：大改动、release candidate、deploy 前本地证明使用 `--profile full-local`。它在 changed-surface 基础上叠加 local regression 和 local release-candidate commands；它仍然不是 production、真实云、kubectl、build/push 或 live-test 授权。

- **main lane**：默认主线 gate，base 承接健康、烟测和契约验证；回归由相关 surface 或 full/local RC 触发。
- **targeted lane**：按 discovery 命中的变更面选最小相关测试面，前端、后端、runtime、release、hygiene / policy 等都应先从对应目录和 runner 入口下手。
- **full/local RC lane**：用于发布前或大改动的本地 RC 证明，覆盖 main lane，并叠加与本次变更相关的 targeted lane。
- **authorized lane**：只在显式授权边界内运行，面向受控 cloud / provider / dry-run / readonly diagnostics；它不是 production 证明，也不自动获得真实云执行权限。

开发者不应在没有筛选的情况下直接跑“全部测试”来代替判断。小修和问题复现先显式指定 `--profile scoped --files <path>`，查看 `changedFiles`、`matchedSurfaces`、`environments`、`authorizedEnvironments`、`reasons`、`recommendedCommands`、`authorizedCommands`、`preflight` 和 `cannotClaim` 后再执行 scoped run-plan。正式 review / landing 前回到 `--profile changed-surface`，发布或大改动时再升级到 `--profile full-local` 或 full/local RC lane。local / full / RC 只说明本地或受控环境通过，不能 claim production。authorized cloud lane 也只覆盖授权包内的边界，不等于真实云授权，更不会被 runner 自动执行。

## Taxonomy

- `tests/product/`: MedOPL product profile、commercial package、active platform 和 product contract eval。
- `tests/frontend/`: Portal UI route/page-state、frontend API client 和 browser-facing behavior eval。
- `tests/backend/`: Go control-plane API、route coverage、Postgres/data-plane 和 billing ledger eval。
- `tests/runtime/`: Runtime Bridge、Gateway、clean upstream OPL boundary 和 artifact/session/run eval。
- `tests/release/`: release boundary、claim boundary、evidence redaction 和 cannot-claim eval。
- `tests/hygiene/`: repo hygiene、secret hygiene、line budget、policy/discovery guard 和 runner sanity gate。
- `tests/health/`: 最小健康 gate，长期应收敛到 `tests/hygiene/` 或 thin suite。
- `tests/smoke/`: 用户主线 golden smoke。
- `tests/contracts/`: true API/schema/runtime/data/release contract eval；tests 是 gate/consumer，不是 truth owner。
- `tests/governance/`: 已清退；不得新增。旧治理测试要么删除，要么迁到明确 owner 目录（product/release/hygiene/backend/runtime/cloud/contracts/health）。
- `tests/suites/`: suite wrapper，只包装 active registry entries 或 explicit high-risk override entries。
- `tests/regression/portal/`: Portal regression eval。
- `tests/regression/opl/`: OPL / Gateway regression eval。
- `tests/regression/runtime-bridge/`: Runtime Bridge regression eval。
- `tests/local-rc/`: 用户显式授权的 local release-candidate eval lane 占位；当前没有 active `.mjs` eval。未来恢复 local RC 必须通过新授权 package 注册，不能复用历史测试入口。
- `tests/cloud/`: future-authorized cloud boundary eval；只保留少数授权边界、dry-run/redaction 和 readonly diagnostics owner，不授权真实云，且不进入默认 `current` verify。
- `tests/fixtures/v22/`: 机器 cursor 和 verify manifest。

## Retired Governance Boundary

`changes/` 已退役，不再是测试、开发或 closeout 的默认入口。不得新增 `changes/active/**` 或 `changes/archive/**`，也不得让 default verify 依赖 change package lifecycle。旧治理测试已从 `tests/governance/` 清退；长期约束必须下沉到 product contracts、release boundary、hygiene gate、source behavior 或 runner behavior。

新增测试必须先选定 product/frontend/backend/runtime/release/cloud/hygiene/support 目录；不能为了便利新增 `scripts/smoke-test-*` 或把所有 repo-local eval 叫 smoke。

`docs/README.md` 必须把本文件作为 lifecycle taxonomy 的验证入口之一；docs 负责解释 truth，tests/fixtures/manifest 负责防止 truth、cursor、history 和 eval 漂移。

## Policy And Discovery

`scripts/v22-test-policy.mjs`、`scripts/v22-test-classification.mjs` 和相关 fixture / manifest / runner 行为共同定义测试机器边界。当前 `test:plan` / `test:run-plan` 由 policy 消费 changed files 和 path / match rules，生成 discovery 结果、lane 候选和 plan 命令；test file metadata、contract refs、entry kind、suite membership 和 authorization boundary 仍由 classification registry / manifest gate 校验。Policy coverage gate 负责确认 registry lane/category/surface 可以映射到当前 policy surface，避免两套分类漂移。

目录约定可以被 changed-file policy 消费，用来推断普通改动面的推荐 lane；这不再是被禁止的“启发式”。真正需要 fail-closed 的是特殊 case：cloud/live/deploy、production claim、retired/tombstone guard、suite wrapper、future-authorized boundary 和其他不能接受误判的高风险边界，它们必须保留 explicit override 或等价的显式机器声明。

Policy/discovery coverage gate 是 `node tests/health/health-check-v22-test-lane-registry.mjs`。该 gate 必须确认：

- every `tests/**/*.mjs` outside fixtures appears exactly once in the classification registry;
- every active test resolves to at least one verify suite, and every registry lane/category/surface maps to a policy surface;
- every explicit override uses allowed lane/tier/surface/entryKind/authorization values and remains fail-closed;
- policy entries reference root `specs/**` machine owners rather than parsing `docs/specs/README.md` prose.

这里的 policy / manifest / fixture 是机器边界；Markdown 只提供人读导航，不是机器接口。需要稳定分类、授权、override 或 lane 判断时，必须落到 policy、manifest、fixture、source contract 或 runner 行为，不能让 README 章节名承担机器 truth。

## Active Test Lifecycle

active test 必须有 lane owner。每个 `tests/**/*.mjs` 都必须通过 classification registry 或 explicit override 解析出 `ownerSurface` 和 `lifecycleRole`，并且 active test 必须证明 current owner surface。

允许的 `lifecycleRole` 只有：

- `current-owner`: 证明当前产品、runtime、source、docs 或 workflow owner 的行为。
- `negative-retirement-guard`: 防止旧入口、旧兼容语义、secret/cloud/deploy 越界或 taxonomy 漂移复活。
- `suite-wrapper`: 只包装 active registry entries 或 explicit override entries，不能包装不存在的旧路径。
- `real-cloud-readiness-boundary`: 只表达 readonly inventory / readonly diagnostics 的本地 readiness gate；真实 provider evidence 只能写入 `.runtime` 或外部临时状态，不进 git，不授权 secret、真实云、deploy、kubectl 或 live-test。
- `future-authorized-boundary`: 只表达 explicit authorization fail-closed、runner dry-run/redaction 和 readonly diagnostics boundary；不授权真实云执行，不能保留 historical proof / closeout evidence / production topology 大测试作为 active eval。

旧 alias / wrapper / facade / compat-only test 迁完 caller 后直接删除。historical proof / closeout evidence 不作为 active test 保留。duplicate aggregate test 必须合并或删除。history 只保摘要，git history 保细节。

Test lifecycle cleanup gate 是 `node tests/health/health-check-v22-test-lifecycle-cleanup.mjs`。该 gate 必须确认：

- every active test has registered `ownerSurface` and an allowed `lifecycleRole`;
- forbidden active roles such as historical-proof, compat-only, alias-only, wrapper-only, and closeout-evidence-only cannot appear;
- suite-wrapper entries remain active registry entries or explicit override entries;
- the zero-compat active surface gate remains in health and local-contract.

## Problem-driven Development Lifecycle

问题驱动开发必须走 `observed -> reproducible -> fixed -> institutionalized -> cleared`。问题过程默认留在 issue / `.runtime`，不能把 raw screenshot、trace、debug log、一次性 reproduction payload 或完整 transcript 写成 git truth。

可复现问题必须绑定 `journey_id`、preconditions、steps、expected/actual result、evidence pointer、severity 和 environment；重复问题按 `journey_id + invariant_violated + failure_mode + likely_root_cause` 去重。只有 repeated 或 P0/P1 问题才能升级为 contract/schema/gate/runtime guard。修复 closeout 后长期资产也必须周期性合并、删除或折叠，不能把 closeout evidence-only test 或历史证明作为 active test 保留。

Problem lifecycle gate 是 `node tests/health/health-check-v22-problem-driven-development-lifecycle.mjs`。机器规则归 `contracts/medopl-problem-driven-development-lifecycle-contract.json` 和 `tests/fixtures/v22/agent-verify-manifest.json#/problem_driven_development_lifecycle`；本 README 只做人读导航。

## Product Gate Boundary

Product gates must verify machine contracts, API/schema behavior, page-state matrix coverage, runtime/data/release boundary, retired-path protection, manifest consistency and evidence state. They must not assert prose wording as machine truth beyond stable owner/purpose/state/machine-boundary markers that protect taxonomy drift.

README-only taxonomy 是结构约束，不代表文档文本本身是机器接口。需要稳定机器判断时，必须新增 fixture schema、policy/discovery contract、source contract 或 runner behavior；不能让 Markdown 章节标题成为默认 API。

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
