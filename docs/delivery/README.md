# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `opl-entry-real-preflight-launch`。pre-cloud 9 个 product slides、本地 RC、golden-path-first-class、golden-path-productization-roadmap、Figma Portal UI absorption、provider key reuse 和 Portal typed API contract 已完成本地闭环；current verify 现在指向产品化第四包，并继续把 golden path health 放在治理护栏之前。真实云、secret、deploy、kubectl、build/push 和 live-test 仍是单独授权边界。

最近 landed 的 `feat/v22-slide-09-precloud-readiness` 已关闭 pre-cloud readiness 本地闭环，并把临时 slide baton 折叠为 history summary；默认 current bundle 仍保留 slide-01 storage regression、slide-02 runtime real API regression、slide-03 account/wallet/billing regression、slide-04 workspace/files regression、slide-05 resource lifecycle regression、slide-06 OPL entry runtime regression、slide-07 run/artifact/trace regression 和 slide-08 admin ops regression 作为防回归命令。

后续真实云工作不得继承 slide authority，也不得跳过产品化路线图；必须先完成或显式调整 OPL entry real state 和 Go control-plane takeover 的 repo-native package，再单独确认真实云授权边界。

## Default Verification

```bash
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```

`golden-path` 是 default verify 的第一产品健康面；`health`、`local-contract`、`review` 和 change package gates 是后续治理护栏。

## Framework Entry Commands

```bash
npm run test:fast
npm run test:lanes
npm run verify:golden-path
npm run test:health
npm run test:smoke
npm run test:contract
npm run test:regression
npm run gate:change
npm run gate:review
npm run closeout:check
```

`test:fast` 是 slide 开发前置防膨胀入口：repo hygiene、repo bloat、line budget、lane registry、product-loop preflight 和 health gate 必须同时通过。`test:lanes` 是测试生命周期入口，专门防止 repo-local eval 游离、重复 wrapper 和 smoke 命名污染。

## Cloud / Deploy Sequence

Cloud delivery must keep this order:

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> readonly inventory
-> authorized create/release
-> authorized deploy
-> canary / QA / status update
```

Readonly and mutation lanes must use separate authorization, secret allowlists, runners and evidence. Evidence with real secrets or live cloud responses stays in `.runtime` and does not enter git.

## Productization Delivery Sequence

Local RC 之后，默认 delivery 不直接跳到真实云。先按下列 package 顺序让用户体验和工程边界闭合：

| Order | Package | Purpose | Default eval boundary |
| --- | --- | --- | --- |
| 1 | `figma-portal-ui-absorption` | 把 Figma Make 的视觉/信息架构吸收到 repo-native Portal frontend。 | closed locally; archived at `changes/archive/2026-05-24-figma-portal-ui-absorption` |
| 2 | `portal-typed-api-contract` | 固定 Portal frontend 与 backend control plane 的 typed JSON/API contract。 | closed locally; archived at `changes/archive/2026-05-24-portal-typed-api-contract` |
| 3 | `provider-key-reuse` | 已绑定用户 `providerKeyRef` 可被 OPL launch/preflight 复用，不要求重复输入 raw key。 | landed locally at `816f7431ad3b5c8c0524b058d11eb08e851b055e` |
| 4 | `opl-entry-real-preflight-launch` | OPL entry UI 读取真实 preflight、launch、providerKeyRef、Gateway readiness 和 fail-closed reason。 | OPL entry runtime regression, golden path suite |
| 5 | `go-control-plane-takeover` | Go 接管 MedOPL control-plane business truth；Node Portal/Gateway/Bridge 收窄为 UI/API shell 与 integration relay。 | Go tests, backend convergence package, Portal contract regression |
| 6 | `real-cloud-authorization` | 只在显式授权后执行 secret/cloud/provider/deploy work。 | cloud future-authorized dry-run first, then authorized live package |

每个 package 必须遵守 `truth/gap -> change package -> spec delta -> eval plan -> implementation -> verify -> review -> archive -> history closeout`。这仍属于清退生命周期的一部分：旧临时 truth 只进 history，active 只保当前 cursor。治理 gate 保留为护栏，但 default verify 先展示 golden path health。

## Authoring Record Discipline

Each authoring branch or cleanup branch records:

- branch and base trunk HEAD
- subscribed truth/spec/policy files
- step commits
- verification commands and results
- subagent roles and models
- landing gate recommendation
- post-merge closeout expectation and target truth files
- non-goals and forbidden operations not performed

The durable human summary is `docs/history/README.md`; detailed proof remains in git history and command output.

## Change Package Delivery

Formal engineering work must create or update `changes/active/<change-id>` before implementation. The package owns proposal, spec delta, design, tasks, eval plan, review and closeout for that branch. `docs/active/README.md` may only point to the open change package; it must not duplicate change details.

Delivery closeout must move completed packages to `changes/archive/YYYY-MM-DD-<change-id>`, sync accepted deltas into durable specs, and add a compact summary to `docs/history/README.md`. If the change updates the current cursor, update both `docs/active/README.md` and `tests/fixtures/v22/goal-current.json`.

## Backend Go Convergence Authoring Lane

`feat/v22-backend-go-convergence-program` 是后端收敛 authoring lane。它不接管当前 `opl-entry-real-preflight-launch` product cursor，不授权 secret、真实云、deploy、kubectl、build/push 或 live-test。

该 lane 的交付方式是每个 step 一个 commit，并且每个 step 都按 `truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor` 执行。7 阶段只作为 compact machine block、spec anchor、registered tests 和 landed history summary 存在，不恢复旧合同目录、旧 recovery 目录、root stage docs 或 `scripts/smoke-test-*`。

Authoring verification:

```bash
node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```
