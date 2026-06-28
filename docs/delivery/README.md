# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `goal-commercial-runtime-storage-billing-business-closure`，状态是 scoped commercial business flow canary proof retained as operations substrate。产品 truth 只由 `docs/product/README.md` 和当前 machine cursor 定义：`account prepare -> account approval -> credit -> plan -> open runtime/storage -> upload/run/artifact -> billing ledger -> statement reconciliation -> release/destroy/stop billing`。Delivery 只说明如何验证这条链路，不反向定义产品叙事。Cross-repo launch completion 的当前 delivery 指针是 `tests/fixtures/v22/goal-current.json#/cross_repo_launch_completion`：OPL-Webui run `28332168943` 和 MedOPL run `28332365127` 证明 scoped canary path，不能升级为 unscoped production complete、ongoing authorization、SLA/multi-region、enterprise compliance 或 external PSP settlement。

`goal-admin-account-commercial-ledger-ui-closure` / `51c6e0fb347bc59a1b0ccfe29a0481cf6870dfbd` 已把 Admin 商业运营 UI 接到真实 v22 business account、credit ledger、billing statement、runtime freeze 和 runtime gate endpoint。`goal-commercial-upload-file-billing-writeback-fix` / `34b0e3070357504b475a0bee2ff6bd4de0af23df` 已修复 upload billing event 使用 runtime ledger tenant / billing attribution identity 的写账路径，并保持 billing/audit fail-closed。`cleanup/v22-active-substrate-retirement` / `1c90045023d090137f5e9d4ac3ea44505c3563bd` 已把 Package D / production launch 从 active product truth 降级为 operations substrate。`goal-commercial-storage-destroy-writeback-fix` / `64699bd3619f01a4442936b096079b3e8051733d` 已修复 storage destroy billing event 使用 collision-resistant event ID 的写账路径，并保持 billing/audit fail-closed。最近授权 canary proof 的 run provenance、artifact id 和 manifest hash 只保留在 history、machine evidence pointer 或 GitHub Actions artifact；Delivery 不把它扩成 external PSP、unscoped full production、ongoing authorization、multi-region/SLA 或 enterprise compliance。

Release Image、Cloud Rollout、receipt manifest 和 `cloud:goal -- --operation <operation_class>` 是 active operations substrate / release substrate。它们支撑 scoped proof、受控上线操作和 future authorized revalidation，但不是 runtime gate、充值、套餐、余额、quota、cost ceiling 或 billing truth。`tests/fixtures/v22/goal-current.json#/ops_readiness_minimum` 是当前最小 ops readiness boundary，指向 monitoring/readiness、rollback drill、troubleshooting 和 failed handoff runbook；它不是 full SLA、multi-region HA、ongoing authorization 或 enterprise compliance。历史 deploy/service reachability、production-launch gap、routing diagnostics 和旧 workflow run provenance 只保留在 `docs/history/README.md`、git history 或 `.runtime` evidence；它们不再是 active product narrative、current blocker 或默认 verify 入口。

当前 active cloud surface 保留 readonly inventory、dry-run plan、TKE bootstrap preflight、Goal A-F 授权 runner 和 Release Image / Cloud Rollout workflow。`npm run cloud:goal:preflight` 是 Goal A-F 的安全前置检查入口，只报告缺失的 secret-file、plan file、external runner、kube/deploy/live-test 输入和 path readiness；它不读取 secret、不调用云、不写 `.runtime`，也不能替代 owner receipt。真实云、secret read、provider call、Tencent mutation、kubectl、deploy、build/push、production ledger write 和 live-test 只允许通过 `contracts/medopl-cloud-authorization-pack.json` 声明的机器授权包和单一 `npm run cloud:goal -- --operation <operation_class>` 或绑定该 runner 的 GitHub workflow 执行；执行 evidence 默认写入 `.runtime` 或 GitHub Actions artifact。authorized command 执行后还必须按 `contracts/medopl-production-receipt-boundary.json` 写 redacted receipt manifest；不得把 substrate proof claim 成 production complete。

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

## Test Lane Selection

交付时先走 `Test Policy -> Discovery -> Preflight -> Run -> Report/Completion Gate`，再决定是否扩到更重的验证：

- **Test Policy**：machine policy 定义 changed-file surface、environment、authorization、cannot-claim 和默认命令升级规则。
- **Discovery**：runner 根据 changed files 和 policy path / match rules 归类变更面；surface metadata、contract refs 和 entry kind 仍由 registry / manifest gate 校验，后续可继续并入 policy。
- **Preflight**：本轮边界是本地全动态测试系统。先执行 `npm run test:run-plan -- --dry-run --json`，检查 `changedFiles`、`matchedSurfaces`、`environments`、`authorizedEnvironments`、`reasons`、`recommendedCommands`、`authorizedCommands`、`preflight` 和 `cannotClaim`，确认本轮只消费本地计划输出。
- **Run**：确认计划后执行 `npm run test:run-plan`，runner 只执行 `recommendedCommands`。不自动执行 `authorizedCommands`，不执行 cloud/live/deploy/kubectl，也不把 future authorized profile 写成当前已经落地。
- **Report/Completion Gate**：report、`cannotClaim` 和 preflight 结果都是完成判断的一部分；没有这些输出，只能说明计划存在，不能说明闭环或 production 级完成。

- **main lane**：面向默认产品主线的基础 gate，默认 base 覆盖 `test:health`、`test:smoke` 和 `test:contract`；`test:regression` 由相关 surface 或 full/local RC 触发。
- **targeted lane**：按 discovery 命中的改动 surface 选最小相关面；例如前端改动看 `test:frontend`，后端改动看 `test:backend`，runtime / gateway 改动看 `test:runtime`，release / claim 边界改动看 `test:release`，治理或 policy/discovery 改动看 `test:hygiene`。
- **full/local RC lane**：发布前或大改动时跑更完整的本地 RC / release-candidate 验证，至少覆盖 main lane，并补 `verify:local-release-candidate`、`verify:golden-path` 和与变更面相关的 targeted lane。
- **authorized lane**：只有在显式授权包存在时才进入；它只代表受控 cloud / provider / mutation 边界，不自动等于真实云可用，也不自动等于 production。

正式 review 前，开发者至少应先跑 `npm run test:run-plan -- --dry-run --json`，查看 `changedFiles`、`matchedSurfaces`、`environments`、`authorizedEnvironments`、`reasons`、`recommendedCommands`、`authorizedCommands`、`preflight` 和 `cannotClaim`，再跑 `npm run test:run-plan` 执行本地推荐命令；发布或大改动时，再提升到 full/local RC lane。local / full / RC 证明的是本地或受控环境下的可交付性，不是 production claim。authorized cloud lane 只授予被写明的授权范围，不授予真实云、deploy、kubectl 或 live-test 的默认权限，也不会被该本地动态测试系统自动执行。

## Worktree Slice Flow

标准开发 slice 入口是 `slice:start -> slice:plan -> slice:verify -> slice:land -> slice:post-push-verify -> slice:cleanup`。这些入口由 `scripts/v22-worktree-slice-orchestrator.mjs` 输出 plan / controlled-executor JSON，复用 `v22-workflow-gate`、`v22-verify` 和 `v22-landing-closeout` 的现有机器 truth。

`slice:start --execute` 也是开发准入控制入口。每个 slice 必须先写入 `.runtime/slices/<slice-id>/slice.json`，其中 `admission` 固定本轮 `slice_type`、`owner_surface`、`target_claim`、`minimum_evidence_slice`、允许/禁止路径、是否允许新增顶层脚本/contract/health test、是否触云、是否允许改 active docs、是否必须 hold bloat 和 `cannot_claim`。`product` slice 默认不允许新增 `scripts/v22-*.mjs`、不允许新增 `tests/health/*.mjs`、不允许触 cloud/deploy/live-test，不允许把 local/cloud RC 升级为 production complete。`automation` / `cloud` / `cleanup` slice 必须显式写清 owner、证据和 cannot-claim；cloud slice 还必须绑定 `operation_class`、`evidence_sink` 和 receipt manifest requirement。

每个 gap 的默认 delivery loop 是：

```text
current truth
-> vision gap
-> lane owner/consumer
-> worktree branch
-> implement
-> run-plan
-> targeted gates
-> verify/review/bloat
-> commit
-> push feature branch
-> ff-only merge trunk
-> push trunk
-> post-push verify
-> tombstone cleanup
```

`push feature branch` 允许作为每个 gap 的远端 review / backup / handoff 面；它不代表 trunk landed，也不能升级成 production claim。`ff-only merge trunk` 和 `push trunk` 不需要逐次口头授权，但只能在 fresh landing gate 通过后执行。最低 landing gate 是：`npm run test:run-plan -- --dry-run --json`、`npm run test:run-plan`、相关 targeted gates、`npm run verify`、`npm run test:health`、`npm run gate:review -- --slice-id <slice-id>`、`npm run repo:bloat -- --diff --slice-id <slice-id>` 和 `npm run line:budget`。`gate:review` 和 `repo:bloat --diff` 会消费 slice admission，拦截本次 diff 的越界 owner path、新增顶层控制脚本、新增 health 治理测试、未准入 contract、cloud surface 越权和超线文件继续增长。`post-push verify` 通过后再做 tombstone cleanup。

真实云、secret、provider call、Tencent mutation、kubectl、deploy、build/push 和 live-test 不受一般 git landing policy 放开；它们仍必须通过机器授权包、runner evidence 和 `contracts/medopl-production-receipt-boundary.json` 定义的 receipt manifest。

## Framework Entry Commands

```bash
npm run slice:start
npm run slice:plan
npm run slice:verify
npm run slice:land
npm run slice:post-push-verify
npm run slice:cleanup
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
npm run verify:cloud-release-candidate
npm run verify:golden-path
npm run cloud:goal:preflight
npm run test:health
npm run test:smoke
npm run test:contract
npm run test:regression
npm run gate:review
```

`validate:active-platform` 是当前产品仓库入口：它验证 `changes/` 已退役、产品合同存在并被测试消费、Portal/Go/Runtime/Release 边界有本地证据。`test:product`、`test:frontend`、`test:backend`、`test:runtime`、`test:release`、`test:cloud` 和 `test:hygiene` 是产品化分层 lane；repo hygiene、repo bloat pressure、line budget 和 policy/discovery guard 继续作为软件工程护栏。Repo bloat 的文件数与字节数只报告 pressure；真正 block 的是 owner、consumer、lifecycle 或 policy/override 失效。

## MedOPL Local / Standalone Package Maturity

`compose.product.yaml` 和 `.env.demo.template` 是当前 MedOPL deploy package 的本地 / standalone 入口。它们只证明 operator package shape、env/config example、compose local / standalone profile、install / upgrade / uninstall 边界和 systemd service example 可以被 repo-local contract 消费；它们不执行 cloud deploy、build/push、kubectl、live-test 或真实 PSP。

Package lifecycle intent:

- `install`: operator copies `.env.demo.template` to an out-of-git env file, generates runtime secrets outside git, reviews `compose.product.yaml`, then starts the local / standalone MedOPL services with the selected profile.
- `upgrade`: operator updates source/image refs, reruns local verification, preserves Postgres/runtime volumes, and restarts services through compose or systemd.
- `uninstall`: operator stops the service, preserves or explicitly destroys volumes according to the local data retention decision, and keeps billing/audit export outside git.

Systemd service example is intentionally documented, not installed by this slice:

```ini
[Unit]
Description=MedOPL local standalone package
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/medopl
EnvironmentFile=/etc/medopl/medopl.env
ExecStart=/usr/bin/docker compose --profile product -f compose.product.yaml up -d
ExecStop=/usr/bin/docker compose --profile product -f compose.product.yaml down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

Secret generation and admin bootstrap stay fail-closed: tracked templates keep secret values empty; generated secrets, admin bootstrap token, session bootstrap secret and webhook secret live only in `.runtime`, an operator secret store or host env file. Admin bootstrap creates or approves the owner/admin MedOPL account and credit/plan path; it does not complete external PSP settlement. The setup wizard maturity boundary is already closed and retired by `goal-commercial-owner-bootstrap-setup-wizard`; real self-serve setup execution and automatic production setup still require a future implementation goal.

Env/config example keys for this package are recorded in `compose.product.yaml` under `x-medopl-package-maturity.env_config_example_keys`. Operator env files may include:

```dotenv
MEDOPL_PACKAGE_PROFILE=local
MEDOPL_INSTALL_ROOT=/opt/medopl
MEDOPL_SYSTEMD_SERVICE=medopl
MEDOPL_SECRET_GENERATION_MODE=operator_generated
MEDOPL_ADMIN_BOOTSTRAP_MODE=owner_admin_required
MEDOPL_SETUP_WIZARD_MODE=future_boundary
```

## MedOPL Owner Bootstrap / Setup Wizard Maturity

`compose.product.yaml#x-medopl-setup-wizard-maturity` and `contracts/medopl-release-boundary.json#medopl_owner_bootstrap_setup_wizard_maturity` define the first-run owner/admin setup boundary. This is a local / standalone product maturity contract: it validates config shape, records the install-package handoff, keeps raw secrets out of git and browser storage, and requires a setup completed marker before commercial runtime operations are claimed.

First-run setup flow:

- validate config: `PORTAL_ADMIN_EMAIL`, `PORTAL_ADMIN_PASSWORD`, `MEDOPL_SETUP_COMPLETED` and `MEDOPL_SETUP_MARKER_PATH` must be present in an out-of-git operator env or backend setup state before owner/admin bootstrap is complete.
- generate/reference secrets: admin password, session bootstrap secret, webhook secret and setup token are generated or referenced by the operator outside git; tracked templates keep secret values empty.
- bootstrap owner/admin account: setup creates or approves the owner/admin MedOPL account and then uses the existing account/credit/plan path; it does not replace `/api/v22/users/prepare`, `/api/v22/users/approve` or `/api/v22/users/credit`.
- write setup completed marker: the setup completed marker is stored in an operator env file or backend setup state only. The marker must not contain raw secrets.

Operator env files may include:

```dotenv
MEDOPL_OWNER_BOOTSTRAP_EMAIL=admin@medopl.local
MEDOPL_OWNER_BOOTSTRAP_PASSWORD=
MEDOPL_SETUP_COMPLETED=false
MEDOPL_SETUP_MARKER_PATH=.runtime/setup/owner-bootstrap.json
```

This boundary cannot claim real secret generation/read, self-serve setup wizard complete, external PSP settlement, cloud deploy, build/push, live-test or production complete.

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

Readonly, dry-run, mutation, deploy/kubectl and canary/live-test lanes must use the machine authorization pack, secret allowlists, support modules and evidence. Active bounded local prework support lives under `tests/support/cloud-prework/` and currently covers readonly inventory, pre-cloud dry-run planning and TKE bootstrap preflight; authorized execution is triggered by `run-plan --include-authorized`. Evidence with real secrets or live cloud responses stays in `.runtime` or another approved non-git sink and does not enter git.

## Productization Delivery Sequence

Local RC 之后，默认 delivery 不直接跳到真实云。先按下列 package 顺序让用户体验和工程边界闭合：

| Order | Package | Purpose | Default eval boundary |
| --- | --- | --- | --- |
| 1 | `figma-portal-ui-absorption` | 把 Figma Make 的视觉/信息架构吸收到 repo-native Portal frontend。 | closed locally; history kept in docs/history summary and git history |
| 2 | `portal-typed-api-contract` | 固定 Portal frontend 与 backend control plane 的 typed JSON/API contract。 | closed locally; history kept in docs/history summary and git history |
| 3 | `provider-key-reuse` | 已绑定用户 `providerKeyRef` 可被 OPL launch/preflight 复用，不要求重复输入 raw key。 | landed locally at `816f7431ad3b5c8c0524b058d11eb08e851b055e` |
| 4 | `opl-entry-real-preflight-launch` | OPL entry UI 读取真实 preflight、launch、providerKeyRef、Gateway readiness 和 fail-closed reason。 | closed locally; history kept in docs/history summary and git history |
| 5 | `go-control-plane-mvp-takeover` | Go 接管 MedOPL control-plane business truth；Portal frontend 通过 typed API 调 Go；Node Portal backend 业务 truth 物理清退，不保 Node/Go 双控制面。 | closed locally; history kept in docs/history summary and git history |
| 6 | `precloud-deployable-rc` | 把 OPL entry、Portal frontend、Go SaaS backend 和 cloud connector fail-closed API 变成本地可部署形态。 | local deterministic proof only / ready for landing review |
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
