# Active Truth

Owner: `MedOPL`
Purpose: `current_state_control_surface`
State: `active_current_truth`
Machine boundary: 本文是唯一人读 current truth 文件。机器 cursor、last landed commit、branch override 和 verification bundle 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。稳定产品、runtime、framework、spec、evidence、policy、delivery、source 和 history truth 只看各自 README，不在本文展开第二份 truth。

Open change detail belongs in `changes/active/<change-id>`. 本文只允许指向 open change，不承载 proposal、spec delta、design、tasks、eval plan、review 或 closeout 正文。

## Ideal State

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。用户购买托管 OPL 服务和平台代管运行能力；平台负责开通、隔离、计费、审计和释放。产品细节见 `docs/product/README.md`，runtime 边界见 `docs/runtime/README.md`，contract lower bound 见 `docs/specs/README.md`。

## Current State

| Field | Value |
| --- | --- |
| current phase | `Go control-plane MVP takeover before real-cloud readiness` |
| current cursor | `go-control-plane-mvp-takeover` |
| current blocker | Go local RC parity for provider launch, billing/audit, resource workflow and release must pass current/review eval before any real-cloud readiness package; secret read, provider operation, true cloud mutation, deploy, kubectl, build/push and live-test remain deferred |
| next owner | `MedOPL Platform` for Go MVP takeover and Node Portal backend business truth retirement; `MedOPL Operations` only after Go local RC passes and a separate real-cloud readiness package is authorized |
| open change package | `changes/active/go-control-plane-mvp-takeover` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `feat/v22-go-control-plane-mvp-takeover` / `116b649ed7ad1ee9955ebff11e86a4b2b8a6579e` |

Current summary: pre-cloud local product proof, local RC archive, golden-path-first-class, golden-path-productization-roadmap, Figma Portal UI absorption, provider key reuse, Portal typed API contract, OPL entry real preflight / launch projection, local control-plane hardening and the first Go lab typed API takeover slice are closed locally. Go control-plane MVP takeover is the current local program; this authoring branch adds local RC parity for provider launch, billing/audit, resource workflow and release, and it remains active until the repo-native eval/review/landing closeout passes. 当前 truth 不再从 recovery/status matrix 推断。Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README；本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

## Open Blockers

- `go-control-plane-mvp-takeover`: provider launch, billing/audit, resource workflow and release local RC parity must pass current/review eval before real-cloud readiness.
- `node-portal-business-truth-retirement`: Node Portal provider/open/readiness business route is retired to a 410 shell; remaining Node Portal shell/relay code must not own control-plane truth.
- `real-cloud-authorization-boundary`: real cloud, secret access, provider operation, deploy, kubectl, build/push, live-test, true cloud mutation, real pricing approval and production release evidence are deferred until Go local RC passes and a separate authorization package is opened.

## Verification Entry

| Check | Command |
| --- | --- |
| golden path health | `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| current bundle | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| index loop | `node tests/contract/contract-test-v22-current-state-index-loop.mjs` |
| cleanup lifecycle | `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs` |
| product loop closeout | `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs` |
| framework truth layering | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` |
| Go local RC parity | `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`; `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs` |

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl、live-test 或 build/push 已授权。
- 不能宣称真实云生产闭环已完成，或真实云、deploy、kubectl、build/push、live-test 已授权。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。
- 不能把 active 写成 product/runtime/framework/spec/evidence/history 的总汇编。
- 不能把 backend Go convergence program 写成第二份阶段板、旧式合同目录、旧式 recovery 目录或未注册测试。
- 不能把 real-cloud authorization 写成当前执行包；当前执行包是 Go control-plane MVP takeover。
- 不能宣称 `services/medopl-go-backend` 已经是 production backend，除非 Go local RC、manifest、tests、landing gate 和 post-merge closeout 已完成。
- 不能把 Go local RC deterministic parity 写成 live provider、真实 OPL upstream、real-cloud、production billing 或 production runtime evidence。
- 不能把 Node Portal backend 写成长期 active backend、兼容层或第二控制面；它只能作为清退对象或非业务 shell/relay。
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
