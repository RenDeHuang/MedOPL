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
| current blocker | Package B readonly inventory, Package C dry-run create/release plan, TKE bootstrap preflight and Package C live canary readiness gate are landed as pre-cloud / scoped local evidence. Package C completed one authorized live canary for tenant node pool lifecycle on 2026-06-13: `CreateNodePool`, scale up, scale down and `DeleteNodePool` passed against cluster `cls-fi097sy4`; cleanup check observed protected platform node pool `np-cbk784r8` and no residual canary tenant node pool. Package D has passed bootstrap, run-scoped platform runner preflight, PostgreSQL/runtime env/combined in-cluster preflight and `production-deploy-plan` dry-run from the VPC/TKE runner. A separately authorized `production-deploy-apply` attempt `pdrun-20260616-003` reached real apply for the four services in namespace `medopl-platform` on cluster `cls-fi097sy4`: `medopl-go-backend` and `opl-web-gateway` reached ready `1/1`; `portal-frontend` and `opl-runtime-bridge` blocked rollout with writable path failures (`/run/nginx.pid` permission denied and `/.runtime` EACCES). `RUN_TENCENT_DEPLOY_EXECUTION` was restored to `0`; readonly diagnostic evidence is `.runtime/package-d-production-deploy/pdrun-20260616-003-diagnostics/readonly-diagnostics-redacted.json`. This local turn fixes those two writable path contracts only: portal nginx uses `/tmp/nginx`, Runtime Bridge defaults to `/tmp/medopl-runtime/.runtime`, and production manifests mount writable `emptyDir` paths, set non-root security contexts and use `imagePullPolicy: Always` for fixed-tag republish. No secret read, provider operation, true cloud mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution or live-test ran in this repo session. Next gaps are separately authorized private build runner republish for `portal-frontend` and `opl-runtime-bridge`, then a separately authorized repo-native `production-deploy-apply` rerun with `pdrun-20260616-004`. |
| next owner | `MedOPL Operations` for real-cloud authorization package; `MedOPL Platform` keeps pre-cloud local RC / Node retirement evidence as local guardrail |
| open change package | `changes/active/real-cloud-authorization-boundary` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `recovery/platform-v22-trunk` / `dd76038f7667dae54bdfb9f1226cf7dfed5b9a01` |
Current summary: Go control-plane MVP takeover remains a closed local lane, Package C tenant node pool lifecycle canary completed, canonical ownership / billing truth remains PostgreSQL ledger, and the local SaaS backend RC remains local deterministic evidence for the Gateway local live probe, Runtime Bridge local fake probe and aggregate RC guard. Package D readiness has advanced through bootstrap, runner preflight, in-cluster PostgreSQL/runtime env preflight and production deploy plan dry-run. The first authorized Package D `production-deploy-apply` reached live Kubernetes apply but did not complete rollout: two services are healthy, while `portal-frontend` and `opl-runtime-bridge` required writable path fixes. This repo now has the local fixes and gates for those two services, but it has not rebuilt/pushed images or rerun deploy apply. Current readiness gaps are: authorized private build runner republish of the two changed service images, authorized repo-native `production-deploy-apply` rerun, deploy execution evidence for the rerun, post-deploy DB/smoke evidence and rollback evidence. These proofs are not production readiness and cannot claim Portal self-service, authorized successful real DB execution, production runtime, production billing, completed rollout, successful smoke, rollback execution, or build/push/kubectl from this repo session. 当前 truth 不再从 recovery/status matrix 推断。Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README；本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

## Open Blockers

- `real-cloud-authorization-boundary`: Package C has one authorized tenant node pool lifecycle canary, the PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound, runner-local cloud operation state machine evidence, repository write wiring contract and gated PostgreSQL sink support path have landed. Package D `production-deploy-apply` has reached live apply but rollout is not complete; local writable path fixes for `portal-frontend` and `opl-runtime-bridge` are ready for image republish. Productionization remains blocked on authorized two-service image republish, authorized deploy apply rerun, post-deploy smoke, service-in-VPC successful DB canary, billing/audit ledger, Portal opening entry and workspace storage quota. Any DB secret read, new Tencent mutation, kubeconfig read, deploy, kubectl, build/push, Package D execution or live-test still requires separate explicit authorization.
- `package-d-release-plan`: Package D reviewable release plan shape now makes `releasePlanReady=true` for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`; `realExecutionReady=false` remains fixed until separate authorization for build/push, kubeconfig, kubectl dry-run/apply, DB smoke and rollback evidence.
- `package-d-execution-preflight-gate`: Package D execution boundary can now judge split `package-d-deploy.env` / `portal-runtime.env` allowlists, fixed cluster `cls-fi097sy4`, namespace `medopl-platform`, runner pool `np-6l4nkdto`, VPC PostgreSQL `10.66.0.21:5432`, four image targets and redaction audit without reading kubeconfig contents or entering real execution.
- `package-d-deploy-runner-placement-plan`: Commercial stabilization no longer treats the current WSL session or an extra CVM as the default Package D execution environment. Preferred deploy execution is a TKE in-cluster platform runner/job scheduled to platform runner pool `np-6l4nkdto` in namespace `medopl-platform`, while `np-cbk784r8` stays protected legacy/platform pool; deploy/smoke, Kubernetes API connectivity preflight, PostgreSQL ledger canary, DB connectivity smoke and rollback run inside the TKE/VPC boundary. Image build/push is a separate concern handled by an external build runner or future Kaniko/BuildKit path, not by the deploy/smoke runner. The prior `medopl-v22-deploy-runner` CVM checklist is fallback-only, not the default route. PostgreSQL and TKE API stay private, no extra CVM is created by default, tenant pool scheduling remains forbidden, and runner state must not enter git. This is a placement plan only: no CVM, Tencent mutation, kubectl, deploy, build/push or Package D execution has run.
- `package-d-in-cluster-platform-runner-shape-gate`: Package D now has a non-executing TKE in-cluster runner shape gate for Kubernetes Job, serviceAccount `medopl-platform-runner`, configMap/secretRef/imagePullSecret shape, no plaintext secret, no raw kubeconfig, platform runner scheduling to `np-6l4nkdto` via `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, tenant pool rejection, minimal RBAC with cluster-scope only for read-only nodes, command allowlist `preflight` / `deploy` / `smoke` / `rollback`, and redacted `.runtime` shape report. It does not call kubectl, connect to the cluster, deploy, build/push, execute Tencent mutation, read kubeconfig or enter Package D execution.
- `package-d-bootstrap-apply-authorization-pack`: Package D Kubernetes API preflight reached the live TKE API from the VPC/TKE runner and confirmed context/cluster `cls-fi097sy4`. A later authorized bootstrap apply created/confirmed `medopl-platform` Active and allowlisted bootstrap resources, but post-apply server-side dry-run failed because the existing same-name `Job/medopl-platform-runner` has immutable `spec.template`. Package D bootstrap apply / dry-run now manages only idempotent Namespace, ServiceAccount, RBAC, ConfigMap, Secret and imagePullSecret resources. Job lifecycle is a separate boundary with unique names like `medopl-platform-runner-preflight-<runid>`. It must not roll out business Deployments, touch tenant pools / `medopl-tenant-`, modify `np-cbk784r8`, build/push, run Tencent mutation, Package C live or production deploy.
- `package-d-kubernetes-api-preflight-runner`: Package D now has a repo-native single cloud-runner command for authorized Kubernetes API connectivity and `kubectl apply --server-side --dry-run=server` against the materialized bootstrap manifest pack. The local gate uses fake env/kubeconfig and fake kubectl only, proves `RUN_TENCENT_DEPLOY_EXECUTION=0`, target `cls-fi097sy4` / `medopl-platform` / `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, tenant-pool rejection, redaction and dry-run-only command shape.
- `package-d-runner-manifest-materialization`: Package D now has a non-executing manifest materialization gate for the in-cluster runner review pack, authorization pack and bootstrap authorization pack. The bootstrap pack recommends Tencent CloudShell, Cloud Assistant or a VPC internal runner for server-side dry-run / separately authorized bootstrap; it records rollback plan, stop conditions, target `cls-fi097sy4` / `medopl-platform` / `np-6l4nkdto`, resource classes, redacted evidence path and the separated run-scoped Job lifecycle. It is static/redacted only and does not read kubeconfig, call Kubernetes API, run kubectl, create a Job, deploy, build/push, execute Tencent mutation, read secrets or enter Package D execution.
- `package-d-run-scoped-platform-runner-preflight`: Package D run-scoped Job preflight `pdrun-20260616-001` passed from the TKE/VPC runner at repo HEAD `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de`: Kubernetes Job completed on the `linux/amd64` runner image, scheduling stayed on `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, redacted logs were collected, the successful Job was deleted, and old failed Job `pdrun-20260615-004` was cleaned and verified `NotFound`. This closes the runner image platform / pull / scheduling preflight gap. No deploy, build/push, Tencent mutation or Package C live is authorized by this fact.
- `package-d-production-deploy-runner-contract`: Package D PostgreSQL/runtime env/combined in-cluster preflight `pdrun-20260616-002` and cloud `production-deploy-plan` dry-run/preflight passed. The repo-native `production-deploy-apply/live` runner exists and the first authorized apply attempt `pdrun-20260616-003` applied four services, but rollout stopped on writable path failures in `portal-frontend` and `opl-runtime-bridge`. The local contract now fixes portal nginx `/tmp/nginx`, Runtime Bridge `/tmp/medopl-runtime/.runtime`, writable `emptyDir` mounts, non-root security contexts and `imagePullPolicy: Always`. Next gap is separately authorized private build runner republish of `portal-frontend` and `opl-runtime-bridge`, then a separately authorized repo-native `production-deploy-apply` rerun; do not hand-run kubectl apply or ad hoc docker build/push.
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
