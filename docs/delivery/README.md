# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `opl-webui-runtime-production-slice`，状态是 local/cloud RC only / before production authorization。MedOPL 的当前 delivery truth 是：平台给 OPL-Webui 登录用户在当前 workspace 提供托管 runtime、文件空间、计费、审计和释放；MedOPL 不承担 OPL 自身科研能力。最新 landed repo closeout 是 `cleanup/v22-owner-consumer-lifecycle-gates` / `767f2de8a35df9615e6f3533dd0518e58ca275e4`。

Go control-plane MVP takeover、precloud-deployable-rc、local SaaS backend RC 和 local Portal/OPL delivery RC 只提供 local RC / cloud-deployable RC evidence。first proof 是 real local product RC；cloud proof 是 cloud-deployable RC；production proof 仍需 explicit authorization + runtime / storage / billing / audit / release owner receipts。历史 Package C live canary、Package D deploy/service reachability、production-launch Gap 01-08o、CLB diagnostics 和 public access 调试只保留为 archive / runtime provenance；它们不再是 active runner、active cloud test、current blocker 或默认 verify 入口。

当前 active cloud surface 只保留三类小边界：readonly inventory、Package C dry-run create/release plan、TKE bootstrap preflight。任何 secret read、provider call、Tencent mutation、kubectl、deploy、build/push、production ledger write、live-test 或 public access completion claim 都必须另开显式授权包，并写清 operation class、target environment、secret allowlist、API allowlist、budget、evidence sink 和 rollback owner。

## Default Verification

```bash
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```

`golden-path` 是 default verify 的第一产品健康面；`health`、`local-contract`、`review` 和治理护栏仍存在，但 `changes/` 作为 change package 生命周期入口已退役，当前 truth 归 `contracts/`、`docs/active/README.md`、root `specs/**`、tests/fixtures/manifest 和 `validate:active-platform`。

## Framework Entry Commands

```bash
npm run validate:active-platform
npm run test:product
npm run test:frontend
npm run test:backend
npm run test:runtime
npm run test:release
npm run test:hygiene
npm run test:fast
npm run test:lanes
npm run local:services:plan
npm run local:services:check:dry-run
npm run local:services:start
npm run local:services:status
npm run local:services:logs
npm run local:services:stop
npm run verify:local-release-candidate
npm run verify:golden-path
npm run test:health
npm run test:smoke
npm run test:contract
npm run test:regression
npm run gate:review
```

`validate:active-platform` 是当前产品仓库入口：它验证 `changes/` 已退役、产品合同存在并被测试消费、Portal/Go/Runtime/Release 边界有本地证据。`test:product`、`test:frontend`、`test:backend`、`test:runtime`、`test:release`、`test:cloud` 和 `test:hygiene` 是产品化分层 lane；repo hygiene、repo bloat pressure、line budget 和 registry 继续作为软件工程护栏。Repo bloat 的文件数与字节数只报告 pressure；真正 block 的是 owner、consumer、lifecycle 或 registry 失效。

`local:services:plan` 是本地 SaaS 后台服务编排入口，列出 Portal frontend、Go backend、OPL Web Gateway、Runtime Bridge 和外部 clean OPL WebUI 的本地命令与 health URL。`local:services:start`、`local:services:stop`、`local:services:status` 和 `local:services:logs` 只管理 MedOPL 本地进程，PID 和日志只写入 `.runtime/local-services`；clean OPL WebUI 仍是外部 upstream endpoint，不由 MedOPL 启动、停止或读取进程日志。`local:services:check:dry-run` 与 `local:services:verify` 只验证编排计划注册，不启动服务、不读取 secret、不调用云；`local:services:check` 只探测本机 URL，可证明本地服务可达，不能升级为 production deploy、real-cloud、live provider 或 upstream ownership evidence。

Go backend 的本地 RC profile 会把 Portal admin projection 的 users、finance ledger 和 announcements 写入 `MEDOPL_PORTAL_STATE_ROOT`。这只服务本地 Portal delivery 和 Router 重建验证；损坏的 state file 会让 `/config/check` fail-closed，不能静默回到 seed 数据。

`tests/regression/opl/regression-test-v22-gateway-live-probe.mjs` 是 OPL Web Gateway 的本地 live probe：它只启动 clean upstream stub、Runtime Bridge stub 和 Gateway 子进程，验证 health、HTML 注入、same-origin Runtime Bridge proxy 和 query-secret 拒绝。该 evidence 只能说明本地 Gateway 边界可达，不能声明真实 OPL upstream、production runtime、real cloud 或 live provider 已完成。

## Cloud / Deploy Sequence

Cloud delivery must keep this order:

```text
real-cloud authorization boundary
-> readonly inventory
-> TKE bootstrap preflight
-> dry-run plan
-> explicit authorization packet
-> authorized tenant runtime provisioning
-> ledger / billing / audit writeback
-> canary / QA / status update
```

Readonly, dry-run, mutation, deploy/kubectl and canary/live-test lanes must use separate authorization, secret allowlists, support modules and evidence. Active bounded local prework support lives under `tests/support/cloud-prework/` and currently covers only readonly inventory, Package C dry-run planning and TKE bootstrap preflight. Evidence with real secrets or live cloud responses stays in `.runtime` or another approved non-git sink and does not enter git.

## Productization Delivery Sequence

Local RC 之后，默认 delivery 不直接跳到真实云。先按下列 package 顺序让用户体验和工程边界闭合：

| Order | Package | Purpose | Default eval boundary |
| --- | --- | --- | --- |
| 1 | `figma-portal-ui-absorption` | 把 Figma Make 的视觉/信息架构吸收到 repo-native Portal frontend。 | closed locally; history kept in docs/history summary and git history |
| 2 | `portal-typed-api-contract` | 固定 Portal frontend 与 backend control plane 的 typed JSON/API contract。 | closed locally; history kept in docs/history summary and git history |
| 3 | `provider-key-reuse` | 已绑定用户 `providerKeyRef` 可被 OPL launch/preflight 复用，不要求重复输入 raw key。 | landed locally at `816f7431ad3b5c8c0524b058d11eb08e851b055e` |
| 4 | `opl-entry-real-preflight-launch` | OPL entry UI 读取真实 preflight、launch、providerKeyRef、Gateway readiness 和 fail-closed reason。 | closed locally; history kept in docs/history summary and git history |
| 5 | `go-control-plane-mvp-takeover` | Go 接管 MedOPL control-plane business truth；Portal frontend 通过 typed API 调 Go；Node Portal backend 业务 truth 物理清退，不保 Node/Go 双控制面。 | closed locally; history kept in docs/history summary and git history |
| 6 | `precloud-deployable-rc` | 把 OPL Workbench、Portal frontend、Go SaaS backend 和 cloud connector fail-closed API 变成本地可部署形态。 | local deterministic proof only / ready for landing review |
| 7 | `opl-webui-runtime-production-slice` | 把 OPL-Webui 当前 workspace runtime/storage 开通、任务执行、artifact 回流、释放和停止计费收口成 current 产品 slice，并固定 proof ladder。 | real local product RC first / cloud-deployable RC second |
| 8 | `real-cloud-readiness` | 只在显式授权后开启 mock/snapshot、readonly quote、dry-run plan、readonly inventory。 | cloud future-authorized dry-run first |
| 9 | `real-cloud-authorization` | 只在显式授权后执行 secret/cloud/provider/deploy work。 | authorized live package |

每个 package 必须遵守 `truth/gap -> implementation -> verify -> review -> history closeout`。`changes/` 已退役；旧临时 truth 只进 docs/history 摘要和 git history，active 只保当前 cursor。治理 gate 保留为护栏，但 default verify 先展示 golden path health。

## Authoring Record Discipline

Each authoring branch or cleanup branch records its closeout in the durable history summary plus fresh command evidence:

- branch and base trunk HEAD
- subscribed truth/spec/policy files
- step commits
- verification commands and results
- subagent roles and models
- landing gate recommendation
- post-merge closeout expectation and target truth files
- non-goals and forbidden operations not performed

The durable human summary is `docs/history/README.md`; detailed proof remains in git history and fresh command output. Seven-file change packages are retired and must not be recreated.

## Change Package Delivery

Formal engineering work no longer routes through `changes/active/<change-id>`. The current truth surfaces are `contracts/`, `docs/active/README.md`, root `specs/**`, tests/fixtures/manifest and `validate:active-platform`; `docs/history/README.md` and git history carry compact history only.

Delivery closeout must sync accepted deltas into durable specs, add a compact summary to `docs/history/README.md`, and keep detailed provenance in git history. If the change updates the current cursor, update both `docs/active/README.md` and `tests/fixtures/v22/goal-current.json`.

## Go Control Plane MVP Takeover Lane

`feat/v22-go-control-plane-mvp-takeover` 已归档为本地 Go control-plane MVP takeover lane。它不再是当前 open cursor；`precloud-deployable-rc` 已把 Portal frontend + Go SaaS backend 的本地可部署 RC 收口到 landing review。当前 open cursor 是 `opl-webui-runtime-production-slice`；真实云、deploy、kubectl、build/push 或 live-test 仍不授权，production claim 也仍需要 owner receipts。

先 Go control-plane MVP，再 real-cloud-readiness。该 lane 的交付方式是每个 step 一个 commit，并且每个 step 都按 `truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor` 执行。7 阶段只作为 compact machine block、spec anchor、registered tests 和 landed history summary 存在，不恢复旧合同目录、旧 recovery 目录、root stage docs 或 `scripts/smoke-test-*`。

Archived verification:

```bash
node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk
bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```
