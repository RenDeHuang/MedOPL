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
| current blocker | Package D is deployed inside TKE and in-cluster HTTP reachability has passed: the runner image and four service images are published, `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge` Deployments are ready `1/1`, all four ClusterIP Services return HTTP `200`, and redacted evidence is recorded at `.runtime/package-d-production-deploy/pdrun-20260616-004/{deploy,smoke,rollback}-redacted.json` plus `.runtime/package-d-service-reachability/psr-20260617-004/{readonly-service-reachability,smoke-job-manifest}-redacted.json`. Production launch Gap 01 through Gap 08d real qcloud Secret/Ingress apply has reached the cloud boundary. In `gap08d-qcloud-ingress-real-004`, `Secret/medopl-portal-tls` was applied successfully as type `Opaque` with `qcloud_cert_id` present and no data read; `Ingress/portal-frontend` was applied for `portal.medopl.cn`, `ingressClass=qcloud`, `tls secret=medopl-portal-tls` and backend `portal-frontend:8080`. The Ingress received LB hostname `lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com`, but `Ready=False` with `BackendError`, classified as qcloud requiring a backend Service type `NodePort` or `LoadBalancer` while the current backend Service is `ClusterIP`; `portal.medopl.cn` still points to the old `lb-lhj3bgii...` target and HTTPS smoke failed with `tls_hostname_mismatch`. Evidence is `.runtime/package-d-external-access-strategy/gap08d-qcloud-ingress-real-004/{real-mutation,qcloud-cert-secret,portal-ingress}-redacted.json`, no out-of-bound mutation occurred, and external/public user access remains not complete. The current unique gap is `production-launch-gap-08e-qcloud-ingress-backend-nodeport-edge-service`: keep the existing `Service/portal-frontend` ClusterIP unchanged, add dedicated `Service/portal-frontend-edge` type `NodePort` with the same portal selector and port `8080`, then update the qcloud Ingress backend to `portal-frontend-edge:8080` through the repo-native external access runner. |
| next owner | `MedOPL Operations` for real-cloud authorization package; `MedOPL Platform` keeps pre-cloud local RC / Node retirement evidence as local guardrail |
| open change package | `changes/active/real-cloud-authorization-boundary` |
| default verification | `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk` |
| default first proof | golden path health from `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` |
| latest product closeout | `feat/v22-slide-09-precloud-readiness` / `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73` |
| latest repo closeout | `recovery/platform-v22-trunk` / `344e1219d8211e9949f2c9488bdb7f9317715c24` |
Current summary: Go control-plane MVP takeover remains a closed local lane, Package C tenant node pool lifecycle canary completed, canonical ownership / billing truth remains PostgreSQL ledger, and the local SaaS backend RC remains local deterministic evidence for the Gateway local live probe, Runtime Bridge local fake probe and aggregate RC guard. Package D readiness has advanced through bootstrap, runner preflight, in-cluster PostgreSQL/runtime env preflight, production deploy plan dry-run, authorized production deploy apply `pdrun-20260616-004` and readonly service reachability `psr-20260617-004`. The four Package D services are deployed and ready inside TKE in namespace `medopl-platform`, and all four ClusterIP Services returned HTTP `200`; this is deploy execution evidence for the platform-service baseline, not production readiness or public production launch. Production launch Gap 01 through Gap 08d real qcloud Secret/Ingress apply are local-gated, dry-run verified or cloud-evidenced. Gap 08d created the qcloud cert-id Secret and Portal Ingress but stopped at qcloud backend readiness because `portal-frontend` is `ClusterIP`; the local runner now supports Gap 08e `qcloud-edge-nodeport-dry-run` / `qcloud-edge-nodeport-apply`, materializes `Service/portal-frontend-edge` type `NodePort`, switches the Ingress backend to `portal-frontend-edge:8080`, forbids modifying the original `Service/portal-frontend`, forbids `LoadBalancer` Service and DNS mutation, and writes redacted edge Service / Ingress evidence. The next unique gap is authorized Gap 08e apply with run-id `gap08e-qcloud-edge-nodeport-apply-001`, followed by read-only get/describe, DNS validation and HTTPS smoke; public/user access still cannot be claimed before Ready/DNS/HTTPS closeout evidence. These proofs cannot claim Portal public/user access, Portal self-service, production billing, rollback execution, Package C live production execution, or new build/push/deploy from this repo session. 当前 truth 不再从 recovery/status matrix 推断。Framework 模型、surface budget、admission、readiness、evidence 等级和 can-claim / cannot-claim 均归各自 owner README；本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth。

## Open Blockers

- `real-cloud-authorization-boundary`: Package C has one authorized tenant node pool lifecycle canary, the PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound, runner-local cloud operation state machine evidence, repository write wiring contract and gated PostgreSQL sink support path have landed. Package D `production-deploy-apply` run `pdrun-20260616-004` completed for the four services inside TKE, and readonly service reachability run `psr-20260617-004` passed through the repo-native runner. Productionization is now organized by the Production Launch Goal / Gap Map in `goal-current.json`; Gap 01 through Gap 08d real qcloud Secret/Ingress apply are local-gated, cloud dry-run verified or cloud-evidenced. The next unique gap is authorized Gap 08e qcloud edge NodePort apply: apply only `Service/portal-frontend-edge` type `NodePort` and update only `Ingress/portal-frontend` backend to `portal-frontend-edge:8080`. Any secret read outside the external access five-key allowlist, provider operation, true cloud mutation, kubeconfig read, deploy, kubectl apply, build/push, Package C live, Package D execution, production PostgreSQL write/read, DNS mutation, LoadBalancer creation or live-test still requires separate explicit authorization.
- `package-d-release-plan`: Package D reviewable release plan shape now makes `releasePlanReady=true` for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`; `realExecutionReady=false` remains fixed until separate authorization for build/push, kubeconfig, kubectl dry-run/apply, DB smoke and rollback evidence.
- `package-d-execution-preflight-gate`: Package D execution boundary can now judge split `package-d-deploy.env` / `portal-runtime.env` allowlists, fixed cluster `cls-fi097sy4`, namespace `medopl-platform`, runner pool `np-6l4nkdto`, VPC PostgreSQL `10.66.0.21:5432`, four image targets and redaction audit without reading kubeconfig contents or entering real execution.
- `package-d-deploy-runner-placement-plan`: Commercial stabilization no longer treats the current WSL session or an extra CVM as the default Package D execution environment. Preferred deploy execution is a TKE in-cluster platform runner/job scheduled to platform runner pool `np-6l4nkdto` in namespace `medopl-platform`, while `np-cbk784r8` stays protected legacy/platform pool; deploy/smoke, Kubernetes API connectivity preflight, PostgreSQL ledger canary, DB connectivity smoke and rollback run inside the TKE/VPC boundary. Image build/push is a separate concern handled by an external build runner or future Kaniko/BuildKit path, not by the deploy/smoke runner. The prior `medopl-v22-deploy-runner` CVM checklist is fallback-only, not the default route. PostgreSQL and TKE API stay private, no extra CVM is created by default, tenant pool scheduling remains forbidden, and runner state must not enter git. This is a placement plan only: no CVM, Tencent mutation, kubectl, deploy, build/push or Package D execution has run.
- `package-d-in-cluster-platform-runner-shape-gate`: Package D now has a non-executing TKE in-cluster runner shape gate for Kubernetes Job, serviceAccount `medopl-platform-runner`, configMap/secretRef/imagePullSecret shape, no plaintext secret, no raw kubeconfig, platform runner scheduling to `np-6l4nkdto` via `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, tenant pool rejection, minimal RBAC with cluster-scope only for read-only nodes, command allowlist `preflight` / `deploy` / `smoke` / `rollback`, and redacted `.runtime` shape report. It does not call kubectl, connect to the cluster, deploy, build/push, execute Tencent mutation, read kubeconfig or enter Package D execution.
- `package-d-bootstrap-apply-authorization-pack`: Package D Kubernetes API preflight reached the live TKE API from the VPC/TKE runner and confirmed context/cluster `cls-fi097sy4`. A later authorized bootstrap apply created/confirmed `medopl-platform` Active and allowlisted bootstrap resources, but post-apply server-side dry-run failed because the existing same-name `Job/medopl-platform-runner` has immutable `spec.template`. Package D bootstrap apply / dry-run now manages only idempotent Namespace, ServiceAccount, RBAC, ConfigMap, Secret and imagePullSecret resources. Job lifecycle is a separate boundary with unique names like `medopl-platform-runner-preflight-<runid>`. It must not roll out business Deployments, touch tenant pools / `medopl-tenant-`, modify `np-cbk784r8`, build/push, run Tencent mutation, Package C live or production deploy.
- `package-d-kubernetes-api-preflight-runner`: Package D now has a repo-native single cloud-runner command for authorized Kubernetes API connectivity and `kubectl apply --server-side --dry-run=server` against the materialized bootstrap manifest pack. The local gate uses fake env/kubeconfig and fake kubectl only, proves `RUN_TENCENT_DEPLOY_EXECUTION=0`, target `cls-fi097sy4` / `medopl-platform` / `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, tenant-pool rejection, redaction and dry-run-only command shape.
- `package-d-runner-manifest-materialization`: Package D now has a non-executing manifest materialization gate for the in-cluster runner review pack, authorization pack and bootstrap authorization pack. The bootstrap pack recommends Tencent CloudShell, Cloud Assistant or a VPC internal runner for server-side dry-run / separately authorized bootstrap; it records rollback plan, stop conditions, target `cls-fi097sy4` / `medopl-platform` / `np-6l4nkdto`, resource classes, redacted evidence path and the separated run-scoped Job lifecycle. It is static/redacted only and does not read kubeconfig, call Kubernetes API, run kubectl, create a Job, deploy, build/push, execute Tencent mutation, read secrets or enter Package D execution.
- `package-d-run-scoped-platform-runner-preflight`: Package D run-scoped Job preflight `pdrun-20260616-001` passed from the TKE/VPC runner at repo HEAD `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de`: Kubernetes Job completed on the `linux/amd64` runner image, scheduling stayed on `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, redacted logs were collected, the successful Job was deleted, and old failed Job `pdrun-20260615-004` was cleaned and verified `NotFound`. This closes the runner image platform / pull / scheduling preflight gap. No deploy, build/push, Tencent mutation or Package C live is authorized by this fact.
- `package-d-production-deploy-runner-contract`: Package D PostgreSQL/runtime env/combined in-cluster preflight `pdrun-20260616-002`, cloud `production-deploy-plan` dry-run/preflight, authorized `production-deploy-apply` run `pdrun-20260616-004` and service reachability run `psr-20260617-004` passed. The repo-native runner applied four Package D Deployments and Services in `medopl-platform`; Deployments are ready `1/1`, ClusterIP HTTP smoke is `200` for all four services, rollback plan was generated without executing rollback, and evidence is redacted under `.runtime/package-d-production-deploy/` and `.runtime/package-d-service-reachability/`. Package D is a deployed platform-service baseline, but external access is no longer the immediate next gap; launch now proceeds through the production SaaS bootstrap and ledger/lifecycle phases first.
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
- 不能宣称真实云生产闭环已完成，或把已记录的 Package D `pdrun-20260616-004` deploy success 扩大成新的真实云、deploy、kubectl、build/push、live-test 授权。
- 不能把 Package D ClusterIP service、Gap 08d qcloud Secret/Ingress apply 或 Gap 08e edge NodePort strategy 写成外部/public user access、DNS、HTTPS smoke 或 production launch 已完成。
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
