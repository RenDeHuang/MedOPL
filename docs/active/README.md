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
| current blocker | Package B readonly inventory, Package C dry-run create/release plan, TKE bootstrap preflight and Package C live canary readiness gate are landed as pre-cloud / scoped local evidence. Package C completed one authorized live canary for tenant node pool lifecycle on 2026-06-13: `CreateNodePool`, scale up, scale down and `DeleteNodePool` passed against cluster `cls-fi097sy4`; cleanup check observed protected platform node pool `np-cbk784r8` and no residual canary tenant node pool. `TagResources` for `tke:nodepool` is unsupported and must not be canonical ownership / billing truth. PostgreSQL `resource_bindings` / `cloud_operations` ledger schema, Go domain model and local store lower bound landed at `c31ae1583390db7cfe8c59168cd4565eee1c52d3`; Package C runner-local cloud operation state machine integration landed at `f15baae3020fe09143ecc90074f0b508bc661dbd`; Package C repository write wiring contract landed at `8f324241004faa9b650cf9cf591bbebc414f6363`, adding Go repository lifecycle methods, memory repository contract coverage and runner ledger sink calls for create/update/release/failure/cleanupRequired paths. The default runner path remains local/dry-run and does not read DB credentials or open a real PostgreSQL connection. Package C now has a gated PostgreSQL ledger execution sink support path with root `pg` driver dependency, `RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION=1`, allowlisted local DB env keys, schema/write-permission preflight, explicit live canary write/read/cleanup runner, redacted `.runtime` evidence and fail-closed driver/gate behavior; live canary also requires `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`, existing tenant/workspace parent rows, a dedicated authorized ledger env file and cleanup readback-absent confirmation. An explicitly authorized PostgreSQL ledger canary read only `/home/dev/.secrets/medopl/v22/postgres-ledger.env` and failed closed at DB connection preflight with `timeout expired` / `network_unreachable_or_connection_preflight_failed`; no parent-row check, DB write, released mark or cleanup write executed. Stable上线 now enters Package D deploy readiness planning only: runtime target is TKE cluster `cls-fi097sy4` / protected platform pool `np-cbk784r8`, PostgreSQL uses VPC private endpoint `10.66.0.21:5432`, and the successful PostgreSQL ledger canary waits until service runs inside the VPC. Package D still lacks image build, TCR push, Kubernetes manifests, platform pool scheduling, DB connectivity smoke and rollback plan; `RUN_TENCENT_DEPLOY_EXECUTION` defaults to `0`. secret read, provider operation, true cloud mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution and live-test remain blocked until separate explicit authorization. This is real Package C lifecycle canary evidence plus local ledger/state-machine/repository contract evidence plus Package D readiness planning, not production readiness or deploy execution evidence |
| next owner | `MedOPL Operations` for real-cloud authorization package; `MedOPL Platform` keeps pre-cloud local RC / Node retirement evidence as local guardrail |
| open change package | `changes/active/real-cloud-authorization-boundary` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `recovery/platform-v22-trunk` / `bce336f732b2a1acbbd79319f04e0986164e5aeb` |

Current summary: pre-cloud local product proof, local RC archive, golden-path-first-class, golden-path-productization-roadmap, Figma Portal UI absorption, provider key reuse, Portal typed API contract, OPL entry real preflight / launch projection, local control-plane hardening, Go control-plane MVP takeover, pre-cloud deployable RC, local SaaS backend RC, local Portal/OPL delivery RC, local AI MVP baseline, real-cloud readiness lane, real-cloud vision docs, legacy runtime cloud cleanup, Package B readonly inventory, TC3 diagnostic cleanup, Package C dry-run create/release plan and Package C live canary readiness gate are closed locally / post-push verified. Portal frontend defaults to Go `/api`; `services/medopl-go-backend` owns the local pre-cloud SaaS backend deployment surface; Node Portal backend is no longer deployment/proxy/API owner. The local SaaS backend RC remains local deterministic evidence for service orchestration, Gateway local live probe, Runtime Bridge local fake probe and aggregate RC guard; the latest local Portal/OPL delivery RC proves the configured local Go Portal launch projection can route through OPL Gateway and Runtime Bridge against a clean upstream fixture with fake ACP message/run/artifact projection. The latest cloud prework proves the repo has a no-secret `real-cloud-readiness` lane for mock/snapshot, readonly quote and readonly inventory contracts, plus a `cloud-future-authorized` Package C dry-run create/release plan and live canary runner that reject live mutation, deploy, kubectl, build/push and kubeconfig arguments. Package C completed one authorized live canary at `op-package-c-live-canary-live-full-lifecycle-2026-06-13`: `CreateNodePool`, scale up, scale down and `DeleteNodePool` passed; the canary tenant pool was cleaned up with no residual node pool by name or id, and protected platform pool `np-cbk784r8` remained observed. Ownership and billing attribution canonical truth now has a local Go/PostgreSQL lower bound and gated PostgreSQL sink support, but the successful real DB canary is deferred until the service runs inside VPC. Package D deploy readiness planning now fixes target cluster `cls-fi097sy4`, platform pool `np-cbk784r8`, VPC PostgreSQL endpoint `10.66.0.21:5432`, deploy secret/env allowlist, `RUN_TENCENT_DEPLOY_EXECUTION=0` default, and readiness gaps: image build, TCR push, Kubernetes manifests, platform pool scheduling, DB connectivity smoke and rollback plan. These proofs remain below production readiness and cannot claim Portal self-service, authorized successful real DB execution, production runtime, production billing, deploy execution, kubectl or build/push. 当前 truth 不再从 recovery/status matrix 推断。Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README；本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

## Open Blockers

- `real-cloud-authorization-boundary`: Package C has one authorized tenant node pool lifecycle canary, the PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound, runner-local cloud operation state machine evidence, repository write wiring contract and gated PostgreSQL sink support path have landed. Stable上线 now enters Package D deploy readiness planning for `cls-fi097sy4` / `np-cbk784r8` and VPC PostgreSQL `10.66.0.21:5432`; productionization remains blocked on service-in-VPC successful DB canary, billing/audit ledger, Portal opening entry and workspace storage quota. Any DB secret read, new Tencent mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution or live-test still requires separate explicit authorization.
- `precloud-deployable-rc`: landed as local proof only; it cannot be upgraded into production backend replacement, real-cloud readiness or live provider evidence.
- `node-portal-business-truth-retirement`: Node Portal backend must not be deployment surface, frontend proxy target, typed API owner or current verification owner.

## Verification Entry

| Check | Command |
| --- | --- |
| golden path health | `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| current bundle | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| index loop | `node tests/contract/contract-test-v22-current-state-index-loop.mjs` |
| cleanup lifecycle | `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs` |
| product loop closeout | `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs` |
| framework truth layering | `node tests/contract/contract-test-v22-framework-truth-layering.mjs` |
| Go local RC parity | `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`; `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs` |
| pre-cloud deployable RC | `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`; `go test ./...` from `services/medopl-go-backend`; `npm --prefix services/portal/frontend run typecheck` |
| local SaaS backend RC | `node tests/contract/contract-test-v22-local-saas-backend-rc.mjs`; `npm run test:regression` |
| real-cloud readiness lane | `node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk` |

## Cannot Claim

- 不能写成 `tests/**/*.mjs` 都是 smoke。
- 不能写成 agent-run evidence 是当前产品真相。
- 不能写成 `future-authorized` 等于真实云、deploy、kubectl、live-test 或 build/push 已授权。
- 不能宣称真实云生产闭环已完成，或真实云、deploy、kubectl、build/push、live-test 已授权。
- 不能把旧分散 docs、旧合同叶子或旧过程目录恢复成 current truth。
- 不能把 active 写成 product/runtime/framework/spec/evidence/history 的总汇编。
- 不能把 backend Go convergence program 写成第二份阶段板、旧式合同目录、旧式 recovery 目录或未注册测试。
- 不能把 `real-cloud-authorization-boundary` 写成 secret、provider、cloud、deploy、kubectl、build/push 或 live-test 已授权；当前执行包只允许本地 dry-run / contract proof。
- 不能宣称 `services/medopl-go-backend` 已经是 production backend，除非 Go local RC、manifest、tests、landing gate 和 post-merge closeout 已完成。
- 不能把 Go local RC deterministic parity 写成 live provider、真实 OPL upstream、real-cloud、production billing 或 production runtime evidence。
- 不能把 local SaaS backend RC 写成真实云、live provider、production runtime、production billing 或 production deploy 已完成。
- 不能把 real-cloud readiness lane 写成已读取 secret、已调用真实云、已完成 readonly live inventory 或已授权 mutation/deploy/live-test。
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
