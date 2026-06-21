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
| cloud proof meaning | `cloud-deployable RC` without production completion claim |
| production proof gate | explicit authorization + seven owner receipts + receipt manifest from `contracts/medopl-production-receipt-boundary.json` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `feat/v22-phase2-portal-ui-secondary-development` / `951fd5a501642834927b3c7b64a15660c1652f5f` |
Current summary: 当前主线是 MedOPL 作为产品控制面，为 OPL-Webui 的 `runtime_required` 任务提供 runtime gate、runtime/storage 开通、node pool projection、billing/freeze/audit/release 和 storage destroy intent。OPL-Webui 仍然负责登录后的 ordinary chat 和用户交互入口；MedOPL 不负责 OPL 科研能力质量。最新 local product RC 是 `feat/v22-local-product-rc-single-flow` / `4f195820dcb351030cb1064172bfec2062abc279`，已把 `runtime gate -> upload file -> fileRef -> run -> artifact -> billing/audit -> release stop billing -> explicit storage destroy` 收口进 golden smoke；最新 repo/gate closeout 是 `feat/v22-phase2-portal-ui-secondary-development` / `951fd5a501642834927b3c7b64a15660c1652f5f`，已把 Phase 2 Portal resource-control 二次开发落到 repo-native React 组件、现有页面消费和 frontend contract gate；Figma Make 仍只作为设计输入，不能替代 `DESIGN.md`、page-state contract 和 Portal source。后续每个 gap 仍允许 push feature branch，并允许 fresh landing gate 通过后 `ff-only merge trunk`、`push trunk`、`post-push verify` 和 `tombstone cleanup`，但不放开真实云、secret、deploy、build/push、kubectl、live-test 或 production claim。real local product RC != cloud 上线，cloud-deployable RC != production complete。生产 proof 不能由 local/cloud RC 或 stub runner 自动升级，必须显式补齐 runtime / storage / billing / audit / release / OPL-Webui consumer / production deploy owner receipts，且 receipt manifest 必须绑定 `operation_class`、`runner_id` 和当前 authorization run。历史 Package D deploy execution evidence 只保留为 provenance，不是当前 active runner 或新授权。当前 active cloud surface 保留 readonly inventory、Package C dry-run plan、TKE bootstrap preflight 和 authorization-pack 单一 `cloud:goal -- --operation <operation_class>` map；`cloud:goal:preflight` 只做 Goal A-F 的 env / path / runner readiness 检查，不读取 secret、不调用云、不写 `.runtime`；Goal A readonly inventory 仍需显式 secret-file 授权，Goal B dry-run plan 可本地执行且不触云，Goal C-F 有可接外部 runner 的 fail-closed 接口，但在缺少 env、runner 路径、accepted receipt status、redacted pointer evidence 或 owner receipt 时仍阻断。`verify:cloud-release-candidate` 已注册为 fail-closed gate，只有完整小型 receipt manifest 同时满足 lifecycle sections 和七类 owner receipts 时才可 claim cloud RC，且仍不能 claim production complete。旧 production launch、Package D deploy/external access、CLB diagnostics 和 Package C live canary 只作为 history / archive / runtime provenance 存在，不再是 active runner、active test 或 current gap。下一 phase 是 Cloud deploy shape 实跑验证；它只能证明 cloud-deployable shape，不得写成 production complete。

当前 truth 不再从 recovery/status matrix 推断；Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README。本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

`local-saas-backend-rc` 只汇总 local SaaS backend RC、Gateway local live probe 和 Runtime Bridge local fake probe；不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy。

## Open Blockers

- `opl-webui-runtime-production-slice`: active blocker. It holds the current product slice, proof ladder and fail-closed authorization boundary before any production claim.
- `real-cloud-readiness`: readonly inventory is a separate explicit lane. It may validate support module shape and redaction policy, but it cannot read secrets or call Tencent Cloud in default verify.
- `cloud-future-authorized`: keeps Package C dry-run plan, TKE bootstrap preflight local gates and the single `cloud:goal -- --operation <operation_class>` authorization-pack runner plumbing. Goal B may execute local no-cloud plans; Goal C-F must fail closed until required env, real runner implementation and owner receipts exist.
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
