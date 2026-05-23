# Active Truth

Owner: `MedOPL`
Purpose: `current_state_vs_ideal_gap`
State: `active_current_truth`
Machine boundary: 本文是唯一人读 current truth 文件。机器 cursor、last landed commit、branch override 和 verification bundle 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。稳定产品、runtime、framework、spec、evidence、policy、delivery、source 和 history truth 只看各自 README，不在本文展开第二份 truth。

## Ideal State

MedOPL v22 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。用户购买托管 OPL 服务、计算能力、文件空间、任务并发和运行环境；平台负责开通、隔离、计费、审计和释放。MedOPL 不是云资源控制台，不是用户自配 CVM/COS/K8s/TKE。

## Current State

当前 product cursor 是 `real-cloud-authorization-boundary`。pre-cloud 9 个 product slides 已全部 landed，并已从 active baton 折叠为 closed summary、history summary 和 next cursor；当前不是真实云生产闭环，也不是已授权真实云执行态。

当前 phase：`pre-cloud local closure complete / real-cloud authorization boundary pending`。

当前已闭合：合同级闭环、本地 deterministic eval、本地 smoke/local proof、Portal Workspace 文件动作闭环、Portal-OPL file/run/artifact 本地闭环、slide-01 到 slide-09 pre-cloud product loop 本地闭环、backend convergence trunk closeout。

最新产品 closeout：`feat/v22-slide-09-precloud-readiness`，landed commit `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`。

最新 governance closeout：`cleanup/v22-backend-convergence-trunk-closeout`，landed commit `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`。

当前 blocker：真实云、deploy、kubectl、live-test、secret 读取、provider operation、build/push、真实资源 mutation、真实价格审批和 production release readiness 都需要单独授权。`scripts/sync-workspace-file-to-minio.ps1` 仍被 `services/portal/src/config/portal-config.mjs` 引用，暂属服务实现债，不在 docs/eval 清退中删除。

Next owner：`MedOPL Operations` 负责真实云授权边界和 evidence 落点；`MedOPL Platform` 负责保持 current truth、spec、manifest、history 和 verify gate 一致。当前 truth 不再从 recovery/status matrix 推断。

Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README；本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

当前默认 verification entry：`node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`。

## Gap Matrix

| Area | Current evidence | Gap | Next action | Verify |
| --- | --- | --- | --- | --- |
| Current cursor | `real-cloud-authorization-boundary` in `tests/fixtures/v22/goal-current.json` | 真实云授权尚未确认 | 先审授权边界，不执行真实云 | `node tests/contract/contract-test-v22-current-state-index-loop.mjs` |
| Product engineering loop | `product-engineering-loop` / `precloud-product-slides-closure` 已 closed | 后续真实云不能继承 slide authority | keep closed summary and real-cloud authorization boundary | `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs` |
| Index loop | docs taxonomy、machine cursor、verify manifest、history closeout 已串联 | 需防止 post-merge truth 漂移 | maintain Index loop gate | `node tests/contract/contract-test-v22-current-state-index-loop.mjs` |
| Cleanup lifecycle | OPL-style lifecycle 已进入 policy、history 和 current bundle | 需防止跳过 post-merge closeout | maintain cleanup lifecycle gate | `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs` |
| Backend Go convergence | program 已注册为 compact machine truth | 不接管当前 product cursor | 仅在 authoring lane 和 package verification 内推进 | `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs` |
| Active slimming | 临时/current truth 收敛到本文 | 需防 active 再次承载 product/runtime/spec/evidence/framework 汇编 | run framework truth-layering gate | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` |

## Current Development Lines

### current-stage-current-cursor

Current evidence: latest landed product closeout is `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`; latest governance closeout is `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`; current machine cursor is `real-cloud-authorization-boundary`.

Gap: the remaining work is authorization, not local pre-cloud implementation.

Next action: define and review the real-cloud authorization boundary before any secret read, true cloud call, build/push, kubectl, deploy or live-test.

Done when: readers can distinguish closed local pre-cloud truth from separately authorized real-cloud execution work.

Verify: `node tests/contract/contract-test-v22-current-state-index-loop.mjs`; `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`.

### portal-saas-control-plane-product-loop

Current evidence: product loop details live in `docs/product/README.md` and specs anchors; pre-cloud product slide baton is closed and folded into history summary.

Gap: the product loop must stay visible without turning active into a second product truth file.

Next action: keep active limited to cursor/blocker/verify while product changes route through `docs/product/README.md` and `docs/specs/README.md`.

Done when: user-facing product truth is owned by product/specs, and active only records whether that work is current, blocked or closed.

Verify: `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs`; `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`.

### optional-resource-lifecycle-and-pricing-boundary

Current evidence: compute resources and file space are optional capabilities; starter and Pro are the only current active MVP plans.

Gap: resource language must not drift to default cloud provisioning, user self-managed CVM/COS/K8s or compute release deleting file space.

Next action: keep detailed resource lifecycle in `docs/product/README.md` and contract lower bounds in `docs/specs/README.md`.

Done when: release compute never implies file-space deletion, and future add-ons remain future-authorized.

Verify: `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`; `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs`.

### portal-opl-runtime-managed-chain

Current evidence: runtime chain is owned by `docs/runtime/README.md`; Gateway and Runtime Bridge remain canonical anti-corruption boundaries.

Gap: real-cloud runtime, deploy and production upstream operation are not authorized.

Next action: keep upstream clean and route runtime changes through runtime/specs/evidence, not active prose.

Done when: no reader can interpret v22 as modifying upstream or importing upstream internals for product implementation.

Verify: `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`; `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`.

### portal-canonical-data-postgres-redis-closure

Current evidence: slide-01 closed local production data truth; PostgreSQL is the canonical production-direction data source and Redis is only session/cache/queue/lock.

Gap: real cloud production data operation is not authorized; local pre-cloud proof remains the executable boundary.

Next action: keep `PORTAL_STORAGE_MODE=postgres_redis` fail-closed behavior in regression gates while real-cloud authorization is reviewed.

Done when: PostgreSQL is the canonical local production data truth, Redis is not a fact source, JSON fallback is not used in `postgres_redis`, and missing connection/schema fails-closed.

Verify: `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs`; `npm --prefix services/portal run check`.

### governance-verification-post-merge-closeout

Current evidence: OPL-style lifecycle is the default MedOPL v22 loop and is owned by `docs/policies/README.md`, `docs/delivery/README.md`, `docs/history/README.md` and `tests/fixtures/v22/*`.

Gap: docs lifecycle and software closure can drift if post-merge closeout is skipped.

Next action: keep review, secret hygiene, repo hygiene, test lane coverage, package scripts and CI as machine gates before the product cursor resumes.

Done when: landing gate no longer depends on hand-composed checks, and post-merge closeout remains required before any next cursor is stable.

Verify: `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`; `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`.

### backend-go-convergence-program

Current evidence: the backend Go convergence program is registered as compact machine truth in `tests/fixtures/v22/goal-current.json` and as a single spec anchor in `docs/specs/README.md`; it does not replace the current `real-cloud-authorization-boundary` product cursor.

Gap: Portal still carries too much backend responsibility, but this program is an authoring lane, not the current product cursor.

Next action: run the backend Go convergence branch override only inside its lane, with one step per commit.

Done when: the 7 phases exist only as a compact program block, a single spec anchor, registered tests and landed history summary; no old contract tree, recovery process tree, smoke script family or second current truth returns.

Verify: `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`; `node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json`.

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl、live-test 或 build/push 已授权。
- 不能宣称真实云生产闭环已完成，或真实云、deploy、kubectl、build/push、live-test 已授权。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。
- 不能把 active 写成 product/runtime/framework/spec/evidence/history 的总汇编。
- 不能把 backend Go convergence program 写成第二份阶段板、旧式合同目录、旧式 recovery 目录或未注册测试。
- 不能宣称 `services/medopl-go-backend` 已经是 production backend，除非对应 Go service、manifest、tests、landing gate 和 post-merge closeout 已完成。
- 不能跳过 post-merge closeout 直接把下一个 leaf 写成已完成或已 landed。

## Source Of Truth During Migration

- 唯一人读 current truth：`docs/active/README.md`
- 稳定产品 truth：`docs/product/README.md`
- Runtime / Gateway / upstream truth：`docs/runtime/README.md`
- Framework owner/readiness/surface/admission truth：`docs/framework/README.md`
- 合同/spec 下限：`docs/specs/README.md`
- Evidence-after-contract：`docs/evidence/README.md`
- 稳定政策和授权红线：`docs/policies/README.md`
- 交付顺序和验证入口：`docs/delivery/README.md`
- active source surface：`docs/source/README.md`
- landed closeout / provenance：`docs/history/README.md`
- 机器 cursor：`tests/fixtures/v22/goal-current.json`
- 验证 manifest：`tests/fixtures/v22/agent-verify-manifest.json`
