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
| current phase | `Real-cloud authorization boundary before readiness` |
| current cursor | `real-cloud-authorization-boundary` |
| current blocker | MedOPL 当前 truth 是给 OPL 提供平台代管 runtime / 云计算资源 / 文件空间 / 计费审计的 SaaS 控制面，不承担 OPL 自身科研能力。当前阻塞不是继续修旧 Package D / CLB / production-launch runner，而是把真实云执行保持在 `real-cloud-authorization-boundary`：默认验证只能跑 readonly inventory、Package C dry-run plan 和 TKE bootstrap preflight 的本地/显式授权边界；任何 secret、provider call、Tencent mutation、kubectl、deploy、build/push、live-test、production ledger write 或 public access claim 都必须另开显式授权包。 |
| next owner | `MedOPL Operations` for real-cloud authorization package; `MedOPL Platform` keeps pre-cloud local RC / Node retirement evidence as local guardrail |
| open change package | `changes/active/real-cloud-authorization-boundary` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `cleanup/v22-current-leaf-owner-compaction` / `b68768be93680d723685d7c3d681e2937522d96f` |
Current summary: Go control-plane MVP takeover、precloud deployable RC、local SaaS backend RC 和 local Portal/OPL delivery RC 都是 local deterministic evidence；they are not production readiness and cannot upgrade into production backend、真实云、生产 runtime、生产 billing 或 public access 证据。历史 Package D deploy execution evidence 只保留为 provenance，不是当前 active runner 或新授权。当前 active cloud surface 只保留三个可验证边界：`tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs`、`tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs` 和 `tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`。旧 production launch、Package D deploy/external access、CLB diagnostics 和 Package C live canary 只作为 history / archive / runtime provenance 存在，不再是 active runner、active test 或 current gap。

当前 truth 不再从 recovery/status matrix 推断；Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README。本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

`local-saas-backend-rc` 只汇总 local SaaS backend RC、Gateway local live probe 和 Runtime Bridge local fake probe；不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy。

## Open Blockers

- `real-cloud-authorization-boundary`: active blocker. It holds the authorization record shape, evidence sink rules, redaction rules and default fail-closed stance before any real cloud execution.
- `real-cloud-readiness`: readonly inventory is a separate explicit lane. It may validate support module shape and redaction policy, but it cannot read secrets or call Tencent Cloud in default verify.
- `cloud-future-authorized`: keeps only Package C dry-run plan and TKE bootstrap preflight local gates. These support future user-authorized provisioning work but do not execute provisioning.
- `precloud-deployable-rc`: landed as local proof only; it cannot be upgraded into production backend replacement, real-cloud readiness or live provider evidence.
- `node-portal-business-truth-retirement`: Node Portal backend must not be deployment surface, frontend proxy target, typed API owner or current verification owner.

## Verification Entry

| Check | Command |
| --- | --- |
| golden path health | `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| current bundle | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| index loop | `node tests/governance/governance-test-v22-current-state-index-loop.mjs` |
| cleanup lifecycle | `node tests/governance/governance-test-v22-cleanup-lifecycle-system.mjs` |
| product loop closeout | `node tests/governance/governance-test-v22-product-engineering-loop-index.mjs` |
| framework truth layering | `node tests/governance/governance-test-v22-framework-truth-layering.mjs` |
| Go local RC parity | `node tests/contracts/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs` |
| pre-cloud deployable RC | `node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` |
| local SaaS backend RC | `node tests/governance/governance-test-v22-local-saas-backend-rc.mjs`; `npm run test:regression` |
| real-cloud readiness lane | `node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk` |

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl、live-test 或 build/push 已授权。
- 不能宣称真实云生产闭环已完成，或把历史 Package D / production-launch / CLB evidence 扩大成新的真实云、deploy、kubectl、build/push、live-test 授权。
- 不能把历史 Package D ClusterIP service、qcloud Ingress/NodePort/CLB diagnostics 写成 active runner、public user access、HTTPS smoke 或 production launch 已完成。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。
- 不能把 active 写成 product/runtime/framework/spec/evidence/history 的总汇编。
- 不能把 backend Go convergence program 写成第二份阶段板、旧式合同目录、旧式 recovery 目录或未注册测试。
- 不能把 `real-cloud-authorization-boundary` 写成 secret、provider、cloud、deploy、kubectl、build/push 或 live-test 已授权；当前执行包只允许本地 dry-run / contract proof。
- 不能宣称 `services/medopl-go-backend` 已经是 production backend，除非 Go local RC、manifest、tests、landing gate 和 post-merge closeout 已完成。
- 不能把 Go local RC deterministic parity 写成 live provider、真实 OPL upstream、real-cloud、production billing 或 production runtime evidence。
- 不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy 已完成。
- 不能把 real-cloud readiness lane 写成已读取 secret、已调用真实云、已完成 readonly live inventory 或已授权 mutation/deploy/live-test。
- Forbidden live operation markers: secret read, provider operation, true cloud mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution, live-test.
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
