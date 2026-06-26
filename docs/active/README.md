# Active Truth
Owner: `MedOPL`
Purpose: `current_state_control_surface`
State: `active_current_truth`
Machine boundary: 本文是唯一人读 current truth 文件。机器 cursor、last landed commit、branch override 和 verification bundle 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。稳定产品、runtime、framework、spec、evidence、policy、delivery、source 和 history truth 只看各自 README，不在本文展开第二份 truth。
当前 truth 归 `contracts/`、`docs/active/README.md`、root `specs/**`、tests/fixtures/manifest 和 `validate:active-platform`；`changes/` 已退役，不再是 open change 的当前入口。

## Ideal State

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 资源购买与控制面。用户购买和管理 OPL 需要的计算资源、存储空间、套餐、任务并发和费用；平台负责开通、隔离、计费、审计和释放。产品细节见 `docs/product/README.md`，runtime 边界见 `docs/runtime/README.md`，contract lower bound 见 `docs/specs/README.md`。

## Current State

| Field | Value |
| --- | --- |
| current phase | `OPL-Webui runtime production slice before production authorization` |
| current cursor | `opl-webui-runtime-production-slice` |
| current blocker | MedOPL 当前 truth 是 OPL SaaS runtime/storage/billing/audit/release 控制面；OPL-Webui 是 primary consumer / entry surface，不是 MedOPL 子模块。OPL-Webui 登录用户日常 ordinary chat 不需要 MedOPL runtime；当 data analysis、文件任务、长任务或其他 `runtime_required` 能力出现时，OPL-Webui 通过 MedOPL runtime gate 在当前 workspace 开通平台代管 runtime / 文件空间，MedOPL 返回 runtimeBinding、storageBinding、nodePoolProjection、billing/freeze/audit/release 状态，用户继续在 OPL-Webui 内上传文件、运行 OPL task、拿 artifact，随后由 MedOPL 释放 runtime、停止计费和按显式意图销毁 storage。当前阻塞不是继续修旧 Package D / CLB / production-launch runner，而是把这条产品主线收口到 `opl-webui-runtime-production-slice`：first proof 只允许 real local product RC，cloud proof 只允许 cloud-deployable RC；真实云执行能力由 `contracts/medopl-cloud-authorization-pack.json` 打开，production proof 仍必须补齐 runtime / storage / billing / audit / release owner receipts。 |
| next owner | `MedOPL Platform` owns the OPL-Webui runtime production slice truth and local/cloud RC proof; `MedOPL Operations` remains owner for any separately authorized production execution package |
| product authority gate | `validate:active-platform` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| local first proof meaning | `real local product RC` for the OPL-Webui runtime/storage slice only |
| cloud proof meaning | `cloud release candidate` and scoped `production-complete candidate` evidence from authorized Cloud Rollout and redacted receipt manifest; still not unscoped production complete |
| production proof gate | explicit authorization + seven owner receipts + receipt manifest from `contracts/medopl-production-receipt-boundary.json` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `goal-commercial-purchase-action-projection` / `14715dba994a37d2e29562cb916f77e7405bbf68` |
Current summary: 当前主线是 MedOPL 作为产品控制面，为 OPL-Webui 的 `runtime_required` 任务提供 runtime gate、runtime/storage 开通、node pool projection、billing/freeze/audit/release 和 storage destroy intent。OPL-Webui 仍然负责登录后的 ordinary chat 和用户交互入口；MedOPL 不负责 OPL 科研能力质量。最新 local product RC 是 `feat/v22-local-product-rc-single-flow` / `4f195820dcb351030cb1064172bfec2062abc279`，已把 `runtime gate -> upload file -> fileRef -> run -> artifact -> billing/audit -> release stop billing -> explicit storage destroy` 收口进 golden smoke。The latest repo/gate closeout is goal-commercial-purchase-action-projection at 14715dba994a37d2e29562cb916f77e7405bbf68. It connects the runtime_required commercial action contract to MedOPL purchase / plan / recharge-or-credit / open-runtime-storage projections for OPL-Webui consumption; internal billing receipt closure, return-to-OPL resume closure, production-canary commercial billing closure and external PSP settlement remain unclaimed. Phase A PostgreSQL Business Persistence RC、Phase E billing idempotency hardening 和 Phase F operational stability gate 已 source-landed，并由 Release Image run `28116660385` 与 Cloud Rollout run `28116700519` 在当前授权 canary path 上验证。该 rollout 上传的 redacted manifest sha256 为 `3c718484f40b0bcfadf55bbafe6f97b02b22072ad801004a560bfe1f69059a0f`，包含七个 owner receipts、12 个 lifecycle sections 和 14 个 production-complete candidate criteria：其中包括 `business_db_persistence_receipt`、`soak_test_receipt`、`concurrency_pressure_receipt`、`rollback_drill_receipt`、`continuous_canary_monitoring_receipt`、`alerting_receipt` 和 `final_release_decision_receipt`。本仓现在可以 claim 当前授权 canary path 的 cloud release candidate 与 scoped production-complete candidate evidence；仍不能 claim unscoped production complete、multi-region/SLA、enterprise compliance、ongoing authorization 或未观测 tenant/resource 的长期稳定。Raw workflow evidence、secrets、kubeconfig、cloud payloads、runtime artifacts、uploaded files 和 transcripts 继续留在 `.runtime` 或外部 evidence store，不进入 git。

当前 truth 不再从 recovery/status matrix 推断；Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README。本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

`local-saas-backend-rc` 只汇总 local SaaS backend RC、Gateway local live probe 和 Runtime Bridge local fake probe；不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy。

## Open Blockers

- `opl-webui-runtime-production-slice`: active cursor. It now has cloud release candidate and scoped production-complete candidate evidence for the current authorized canary path; unscoped production complete remains fail-closed outside the manifest scope.
- `real-cloud-readiness`: readonly inventory has an explicit live readonly evidence pointer under `.runtime` after user-authorized secret-file execution. Default verify still cannot read secrets or call Tencent Cloud, and this lane does not satisfy mutation, deploy, live-test or production owner receipts.
- `cloud-future-authorized`: keeps Package C dry-run plan, TKE bootstrap preflight local gates and the single `cloud:goal -- --operation <operation_class>` authorization-pack runner plumbing. Goal B may execute local no-cloud plans; Goal A/C/D/E have accepted owner receipt pointers; Goal F has current remote cloud RC / production-complete candidate evidence through Release Image run `28116660385`, Cloud Rollout run `28116700519` and the 14-criteria redacted receipt manifest. Final production complete release decision is scoped to that manifest and still cannot expand into multi-region/SLA/compliance claims.
- `precloud-deployable-rc`: landed as local/cloud RC proof only; it cannot be upgraded into production backend replacement, production complete or live provider evidence.
- `node-portal-business-truth-retirement`: Node Portal backend must not be deployment surface, frontend proxy target, typed API owner or current verification owner.

## Verification Entry

| Check | Command |
| --- | --- |
| golden path health | `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| current bundle | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| product contract authority | `node tests/product/product-test-v22-medopl-contract-authority.mjs` |
| Portal page-state matrix | `node tests/frontend/frontend-test-v22-portal-page-state-matrix.mjs` |
| Go API contract | `node tests/backend/backend-test-v22-api-contract.mjs` |
| Runtime Bridge boundary | `node tests/runtime/runtime-test-v22-runtime-bridge-product-boundary.mjs` |
| release boundary | `node tests/release/release-test-v22-boundary-contract.mjs` |
| hygiene / retired changes boundary | `node tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs` |
| Go local RC parity | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs` |
| pre-cloud deployable RC | `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` |
| local SaaS backend RC | `node tests/contracts/contract-test-v22-local-service-orchestration.mjs`; `npm run test:regression` |
| real-cloud readiness lane | `node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk` |
| production goal runner plan | `npm run cloud:authorized:plan`; `npm run cloud:goal:preflight`; `npm run cloud:goal -- --operation dry_run_plan`; `node tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs` |
| cloud release candidate gate | `npm run verify:cloud-release-candidate` |
| operational stability / release decision gate | `node tests/cloud/cloud-test-v22-medopl-github-cloud-rollout-shape.mjs`; `node tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs`; fresh Cloud Rollout with `MEDOPL_ALERT_ROUTE_REF` |

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于 production complete；真实云、deploy、kubectl、live-test 或 build/push 只能通过机器授权包和 runner/report evidence 执行。
- 不能宣称真实云生产闭环已完成，或把历史 Package D / production-launch / CLB evidence 扩大成新的真实云、deploy、kubectl、build/push、live-test 授权。
- 不能把历史 Package D ClusterIP service、qcloud Ingress/NodePort/CLB diagnostics 写成 active runner、public user access、HTTPS smoke 或 production launch 已完成。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。
- 不能把 active 写成 product/runtime/framework/spec/evidence/history 的总汇编。
- 不能把 backend Go convergence program 写成第二份阶段板、旧式合同目录、旧式 recovery 目录或未注册测试。
- 不能把 `real-cloud-authorization-boundary` 写成 production complete；授权包只打开执行能力，不替代 runtime / storage / billing / audit / release receipt。
- 不能宣称 `services/medopl-go-backend` 已经是 production backend，除非 Go local RC、manifest、tests、landing gate 和 post-merge closeout 已完成。
- 不能把 Go local RC deterministic parity 写成 live provider、真实 OPL upstream、real-cloud、production billing 或 production runtime evidence。
- 不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy 已完成。
- 不能把 real-cloud readiness lane 写成 production complete；authorized mutation/deploy/live-test 必须由 `run-plan --include-authorized` 和授权包 evidence 证明。
- 不能把 real local product RC 写成 cloud 上线。
- 不能把 cloud-deployable RC 写成 production complete。
- 不能把 `cloud:goal -- --operation dry_run_plan` 写成 runtime/storage 已创建、kubectl 已执行、image 已 push、deploy/live-test 已完成或 production complete。
- 不能把 `verify:cloud-release-candidate` 通过写成 production complete；该 gate 只允许 cloud RC，且缺完整 receipt manifest 时必须 fail closed。
- 没有 runtime / storage / billing / audit / release owner receipt，不得 claim production ready / production complete。
- Live operation markers require machine authorization pack evidence: secret read, provider operation, true cloud mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution, live-test.
- 不能把 Node Portal backend 写成长期 active backend、过渡控制面、shell、facade、relay 或第二控制面；`services/portal/src` 已物理清退。
- 不能跳过 post-merge closeout 直接把下一个 leaf 写成已完成或已 landed。
- 不能把 governance gate 通过写成黄金链路健康；default verify 必须先暴露 golden path health。

## Source Of Truth During Migration

- current truth：`docs/active/README.md`
- product truth：`docs/product/README.md`
- runtime / Gateway / upstream truth：`docs/runtime/README.md`
- framework owner/readiness/surface/admission truth：`docs/framework/README.md`
- contract/spec lower bound：`docs/specs/README.md`
- evidence-after-contract：`docs/evidence/README.md`
- stable policy and authorization boundary：`docs/policies/README.md`
- delivery order and verification entry：`docs/delivery/README.md`
- active source surface：`docs/source/README.md`
- landed closeout / provenance：`docs/history/README.md`
- machine cursor：`tests/fixtures/v22/goal-current.json`
- verify manifest：`tests/fixtures/v22/agent-verify-manifest.json`
