# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `real-cloud-authorization-boundary`，状态是 authorization-required / before real-cloud readiness。pre-cloud、本地 RC、Package C live canary、Package D production deploy apply 和 Package D in-cluster HTTP reachability 已各自形成 evidence，但它们不等于正式稳定上线。最新 landed repo closeout 是 `recovery/platform-v22-trunk` / `9d36cb818a5b54b14cd1bfb777be49003baedfe1`。当前 delivery truth 采用 `goal-current.json` 的 Production Launch Goal / Gap Map 作为机器 cursor 派生：目标是 `platform-provisioned / customer-dedicated` 的多租户 SaaS 托管 OPL 工作台，Portal 是用户/管理员入口，平台代管云资源，workspace lifecycle 通过 ResourceBinding / CloudOperation ledger、billing、audit、quota、rollback、cleanup 和 redacted evidence 闭合。Package D 现在是已部署的 TKE platform-service baseline：`pdrun-20260616-004` 完成四服务 deploy/rollout，`psr-20260617-004` 证明四个 ClusterIP Service HTTP `200` 且 smoke Job 清理成功。Production launch Gap 01-08k 已收口为 repo-native contract/local gates、云端 server-side dry-run evidence、云端 bounded mutation evidence 或只读 diagnostics evidence。Gap 08k OPL-Webui vs Portal qcloud Ingress compare 已执行：working `opl.medopl.cn` qcloud Ingress 没有 `TkeServiceConfig`，Portal `portal.medopl.cn` backend 同为 NodePort/qcloud/TLS 但带有 `ingress.cloud.tencent.com/tke-service-config=portal-frontend-edge-healthcheck` 且 HTTPS 仍为 `504`。Evidence 为 `.runtime/package-d-external-access-strategy/gap08k-opl-webui-vs-portal-compare-001/readonly-compare-redacted.json`，无越界 mutation。当前唯一 gap 是 `production-launch-gap-08l-remove-qcloud-healthcheck-annotation`：本地实现 repo-native runner/local gate，用于只从 `Ingress/portal-frontend` 移除 `ingress.cloud.tencent.com/tke-service-config` annotation，保留 `Secret/medopl-portal-tls`、`Service/portal-frontend-edge`、`Ingress/portal-frontend`、host/TLS/backend 和现有 `TkeServiceConfig`，仍不授权 DB password、Portal admin password、Tencent SecretId/SecretKey、TLS private key/cert material、DNS mutation by repo runner、LoadBalancer Service、Package C/tenant resources、build/push、deploy/rollout/rollback、Package C live 或 public access completion claim。

最近 landed 的 `feat/v22-slide-09-precloud-readiness` 已关闭 pre-cloud readiness 本地闭环，并把临时 slide baton 折叠为 history summary；默认 current bundle 仍保留 slide-01 storage regression、slide-02 runtime real API regression、slide-03 account/wallet/billing regression、slide-04 workspace/files regression、slide-05 resource lifecycle regression、slide-06 OPL entry runtime regression、slide-07 run/artifact/trace regression 和 slide-08 admin ops regression 作为防回归命令。

后续真实云工作不得继承 slide authority，也不得跳过产品化路线图；Go control-plane MVP takeover、precloud-deployable-rc、local SaaS backend RC 和 local Portal/OPL delivery RC 均只提供本地 RC evidence。下一步仍留在 `real-cloud-authorization-boundary`，但当前唯一 gap 已推进到 Gap 08l remove qcloud health-check annotation contract/local gate。Package D 已 deployed inside TKE 且 in-cluster HTTP reachability passed；external/public user access not yet complete 仍是事实。下一步只允许 repo-native runner 规划/验证 `Ingress/portal-frontend` annotation removal；不允许删除 Ingress/Secret/Service/TkeServiceConfig，不允许修改 Deployment、现有 `Service/portal-frontend` ClusterIP、`Service/portal-frontend-edge`、DNS、LoadBalancer Service、Package C/tenant resources，不声明公网可用。当前 cursor 不授权新的 Tencent API mutation、deploy、build/push、Package C live、production PostgreSQL write/read 或手写 Package D execution。

## Default Verification

```bash
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk
node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```

`golden-path` 是 default verify 的第一产品健康面；`health`、`local-contract`、`review` 和 change package gates 是后续治理护栏。

## Framework Entry Commands

```bash
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
npm run gate:change
npm run gate:review
npm run closeout:check
```

`test:fast` 是 slide 开发前置防膨胀入口：repo hygiene、repo bloat、line budget、lane registry、product-loop preflight 和 health gate 必须同时通过。`test:lanes` 是测试生命周期入口，专门防止 repo-local eval 游离、重复 wrapper 和 smoke 命名污染。

`local:services:plan` 是本地 SaaS 后台服务编排入口，列出 Portal frontend、Go backend、OPL Web Gateway、Runtime Bridge 和外部 clean OPL WebUI 的本地命令与 health URL。`local:services:start`、`local:services:stop`、`local:services:status` 和 `local:services:logs` 只管理 MedOPL 本地进程，PID 和日志只写入 `.runtime/local-services`；clean OPL WebUI 仍是外部 upstream endpoint，不由 MedOPL 启动、停止或读取进程日志。`local:services:check:dry-run` 与 `local:services:verify` 只验证编排计划注册，不启动服务、不读取 secret、不调用云；`local:services:check` 只探测本机 URL，可证明本地服务可达，不能升级为 production deploy、real-cloud、live provider 或 upstream ownership evidence。

Go backend 的本地 RC profile 会把 Portal admin projection 的 users、finance ledger 和 announcements 写入 `MEDOPL_PORTAL_STATE_ROOT`。这只服务本地 Portal delivery 和 Router 重建验证；损坏的 state file 会让 `/config/check` fail-closed，不能静默回到 seed 数据。

`tests/regression/opl/regression-test-v22-gateway-live-probe.mjs` 是 OPL Web Gateway 的本地 live probe：它只启动 clean upstream stub、Runtime Bridge stub 和 Gateway 子进程，验证 health、HTML 注入、same-origin Runtime Bridge proxy 和 query-secret 拒绝。该 evidence 只能说明本地 Gateway 边界可达，不能声明真实 OPL upstream、production runtime、real cloud 或 live provider 已完成。

## Cloud / Deploy Sequence

Cloud delivery must keep this order:

```text
mock/snapshot provider
-> readonly quote
-> dry-run plan
-> TKE bootstrap preflight when no TKE foundation exists
-> readonly inventory
-> Package C live canary readiness pack with execution disabled
-> authorized create/release canary completed
-> Package D deploy readiness planning for platform pool and VPC PostgreSQL
-> shape-gate in-cluster platform runner Job/RBAC/env on `np-6l4nkdto` while keeping `np-cbk784r8` protected legacy/platform pool; keep build/push separate
-> materialize static Package D runner manifest review pack / authorization pack / bootstrap authorization pack; use the repo-native Package D Kubernetes API dry-run runner from Tencent CloudShell, Cloud Assistant or a VPC internal runner with TKE API reachability
-> authorize the repo-native Package D bootstrap apply runner for idempotent `medopl-platform` Namespace and Package D ServiceAccount/RBAC/ConfigMap/SecretRef/imagePullSecret resources; no business Deployment rollout and no same-name Job reapply
-> rerun Package D server-side dry-run preflight
-> publish the fixed Package D runner image tag as `linux/amd64` through a private build runner using only `TCR_ID`, `TCR_SECRET` and `PACKAGE_D_RUNNER_IMAGE_REF` from `package-d-deploy.env`; require `docker buildx build --platform linux/amd64`; no GitHub Actions secrets current path, no deploy and no TKE/VPC runner Docker build/push
-> run-scoped platform runner Job preflight passed on `pdrun-20260616-001`; observe/evidence/success-cleanup only that Job and keep old failed Job cleanup evidence redacted
-> PostgreSQL/runtime env/combined in-cluster preflight passed on `pdrun-20260616-002` from the platform runner
-> Package D production deploy runner contract/local gate corrected: `production-deploy-plan` must keep `RUN_TENCENT_DEPLOY_EXECUTION=0`, future apply/live requires `1`, and the four service image refs are fixed to `uswccr.ccs.tencentyun.com/medopl/{portal-frontend,medopl-go-backend,opl-web-gateway,opl-runtime-bridge}:v22-package-d-20260616-001`
-> Package D four service Dockerfile/build contexts and service-level .dockerignore files are materialized; do not use the TKE/VPC deploy runner for docker build/push and do not hand-run ad hoc build/push
-> Package D production-deploy-plan dry-run/preflight passed at repo HEAD `601bbc97c3d77e4aa7bb365cb60c5662582119c9`: generated four ConfigMaps, four Deployments and four Services for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`; image refs, SecretRefs, scheduling, rollback plan, smoke plan and redaction passed; no true apply/rollout/smoke/rollback/build-push/Tencent mutation/Package C live
-> repo-native `production-deploy-apply/live` single entrypoint landed locally
-> first authorized `production-deploy-apply` reached live apply on `pdrun-20260616-003`; `medopl-go-backend` and `opl-web-gateway` became ready, while `portal-frontend` and `opl-runtime-bridge` blocked rollout on writable path failures
-> local writable path fixes landed for portal nginx `/tmp/nginx`, Runtime Bridge `/tmp/medopl-runtime/.runtime`, production manifest emptyDir/env/securityContext and fixed-tag `imagePullPolicy: Always`
-> Package D `production-deploy-apply` rerun `pdrun-20260616-004` passed: server-side dry-run, apply, rollout, four ready Deployments, four ClusterIP Services on `8080/http`, scheduling on `node.tke.cloud.tencent.com/machineset=np-6l4nkdto` / host IP `10.66.0.42`, `12/12` smoke shape checks and redaction audit all passed; rollback plan was generated but rollback was not executed
-> repo-native readonly service reachability / in-cluster HTTP smoke runner landed locally: `node tests/support/cloud-prework/package-d-service-reachability-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode in-cluster-http-smoke --authorized 1`; it only plans allowlisted readonly get deployment/service/pods, creates one run-scoped `medopl-service-smoke-<runid>` curl Job against the four fixed ClusterIP service endpoints, collects redacted HTTP status/body summaries and deletes only that Job
-> authorized readonly service reachability run `psr-20260617-001` failed closed at `smoke_job_wait_complete` timeout with empty `serviceResults`; evidence is `.runtime/package-d-service-reachability/psr-20260617-001/readonly-service-reachability-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-001/smoke-job-manifest-redacted.json`, but root-cause diagnostics were insufficient
-> authorized readonly service reachability rerun `psr-20260617-002` at repo HEAD `956d3724233b3306115275e938361ab4bf2fc587` again failed closed at `smoke_job_wait_complete`; the smoke Job was created, Pod scheduled, `curlimages/curl` pulled, HTTP endpoint status remained uncollected, the Job was deleted and evidence is `.runtime/package-d-service-reachability/psr-20260617-002/readonly-service-reachability-redacted.json`, `.runtime/package-d-service-reachability/psr-20260617-002/diagnostics-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-002/smoke-job-manifest-redacted.json`
-> repo-native service reachability runner wait-failure diagnostics strengthened locally: curl smoke must use `--connect-timeout`, `--max-time` and `--fail-with-body`, emit service/url/http_code/exit_code/total_time/error_class summaries, and on wait timeout collect redacted Job conditions, Pod phase/reason/message, nodeName/hostIP, per-container image/ready/restartCount/state/lastState, Events type/reason/message/count/timestamps and allowlisted curl log or log-unavailable summaries into `.runtime/package-d-service-reachability/<runid>/diagnostics-redacted.json` before delete-always-after-log-collection cleanup
-> authorized readonly service reachability rerun `psr-20260617-003` at repo HEAD `d6e96696518036d1284f1df05926b53eb4ea156b` failed closed before curl containers started: all four curl containers reported `CreateContainerConfigError`; diagnostics showed `curlimages/curl:8.8.0` uses non-numeric user `curl_user` and Kubernetes cannot verify it under `runAsNonRoot: true`; evidence is `.runtime/package-d-service-reachability/psr-20260617-003/readonly-service-reachability-redacted.json`, `.runtime/package-d-service-reachability/psr-20260617-003/diagnostics-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-003/smoke-job-manifest-redacted.json`
-> repo-native service reachability runner smoke Job manifest now sets numeric non-root curl container securityContext: `runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` and `capabilities.drop: ["ALL"]`
-> authorized readonly service reachability rerun `psr-20260617-004` at repo HEAD `f380895ae67427d1167fb7f0c33370fe76bcc1fa` passed: four Deployments ready `1/1`, four ClusterIP Services on `8080/http`, smoke Job `medopl-service-smoke-psr-20260617-004`, HTTP `200` for portal-frontend, medopl-go-backend, opl-web-gateway and opl-runtime-bridge, cleanup deleted the smoke Job and verified `NotFound`, diagnostics were not generated because success, redaction audit passed, and no deploy/rollout/rollback/build-push/Tencent mutation/Package C live occurred
-> Production Launch Goal / Gap Map established: formal launch is multi-tenant SaaS closure, not temporary Portal exposure
-> Production launch Gap 01 local gate landed: `production-launch-bootstrap-runner.js` plus Portal typed API and Go fail-closed routes prove first-admin/tenant/workspace bootstrap shape, providerKeyRef-only boundary, redacted evidence and local/prod default separation without secret/kubeconfig, kubectl, deploy, build/push, Tencent mutation, Package C live or external access
-> Production launch Gap 02 local gate landed: `production-launch-operation-runner.js` plus Portal typed API and Go fail-closed routes prove Portal action shape, Go backend operation request shape, Package C runner invocation boundary, ResourceBinding requested/creating/ready state contract, providerKeyRef-only boundary, idempotency, redacted evidence and local/prod operation separation without secret/kubeconfig, kubectl, deploy, build/push, Tencent mutation, Package C live or external access
-> Production launch Gap 03 local gate landed: `production-launch-ledger-runner.js` plus Portal typed API and Go fail-closed routes prove ResourceBinding / CloudOperation write/read shape, requested/creating/ready state persistence boundary, operation_id/idempotency uniqueness, providerKeyRef-only boundary, canonical ownership source, redacted evidence and local/prod PostgreSQL separation without secret/kubeconfig/DB password, kubectl, deploy, build/push, Tencent mutation, Package C live or external access
-> Production launch Gap 04 local gate landed: `production-launch-commercial-ledger-runner.js` plus Portal typed API and Go fail-closed routes prove billing ledger shape, audit ledger shape, quota ledger / enforcement boundary, ResourceBinding / CloudOperation linkage, workspace cost attribution, operation idempotency, providerKeyRef-only boundary, redacted evidence and local/prod PostgreSQL separation without secret/kubeconfig/DB password, kubectl, deploy, build/push, Tencent mutation, Package C live, production billing charge or external access
-> Production launch Gap 05 local gate landed: `production-launch-workspace-lifecycle-runner.js` plus Portal typed API and Go fail-closed routes prove workspace suspend/resume/delete request shape, ResourceBinding / CloudOperation lifecycle linkage, billing stop/resume/finalization linkage, audit linkage, quota release/restore linkage, idempotency, providerKeyRef-only boundary, rollback/cleanup redacted evidence and local/prod PostgreSQL separation without secret/kubeconfig/DB password, kubectl, deploy, build/push, Tencent mutation, Package C live, production lifecycle mutation or external access
-> Production launch Gap 06 local gate landed: `production-launch-canary-runner.js` plus Portal typed API and Go fail-closed routes prove production canary shape, admin/tenant/workspace smoke shape, Portal -> Go backend -> Package C dry-run boundary, ResourceBinding / CloudOperation / commercial ledger / workspace lifecycle linkage, rollback/cleanup evidence shape, redaction/observability evidence, idempotency and providerKeyRef-only boundary without secret/kubeconfig/DB password, kubectl, deploy, rollback, build/push, Tencent mutation, Package C live, production PostgreSQL/Kubernetes execution or external access
-> Production launch Gap 07 and Gap 08a-08c moved external access from strategy to qcloud prerequisites/readiness/server-side dry-run evidence without real mutation
-> Gap 08d real qcloud external access apply `gap08d-qcloud-ingress-real-004` applied `Secret/medopl-portal-tls` as qcloud `Opaque` + `qcloud_cert_id` and applied `Ingress/portal-frontend` for `portal.medopl.cn -> portal-frontend:8080`; qcloud assigned LB hostname `lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com`, but Ingress stayed `Ready=False` / `BackendError` because qcloud requires a backend `NodePort` or `LoadBalancer` Service and `portal-frontend` is `ClusterIP`; DNS still pointed to old `lb-lhj3bgii...`, HTTPS smoke failed with `tls_hostname_mismatch`, no out-of-bound mutation occurred and evidence is `.runtime/package-d-external-access-strategy/gap08d-qcloud-ingress-real-004/{real-mutation,qcloud-cert-secret,portal-ingress}-redacted.json`
-> repo-native qcloud external access runner now supports `qcloud-edge-nodeport-dry-run` and `qcloud-edge-nodeport-apply`: it materializes redacted `Service/portal-frontend-edge` type `NodePort` evidence, switches the qcloud Ingress backend to `portal-frontend-edge:8080`, keeps `medopl-portal-tls`, `portal.medopl.cn` and `ingressClass=qcloud`, forbids modifying the existing `Service/portal-frontend` ClusterIP, forbids `LoadBalancer` Service and DNS mutation, and keeps public access completion blocked until Ready/DNS/HTTPS evidence passes; next authorized run-id is `gap08e-qcloud-edge-nodeport-apply-001`
-> Gap 08e qcloud edge NodePort apply `gap08e-qcloud-edge-nodeport-apply-001` succeeded: `Service/portal-frontend-edge` is `NodePort` on `8080`, original `Service/portal-frontend` stayed `ClusterIP`, `Ingress/portal-frontend` targets `portal-frontend-edge:8080`, Ingress is `Ready=True` with LB hostname `lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com`, DNS still points to old `lb-lhj3bgii-ms5ocrjz6hdaki2l.clb.usw-tencentclb.com`, HTTPS smoke evidence is invalid because curl lacked `--fail-with-body`, no out-of-bound mutation occurred and evidence is `.runtime/package-d-external-access-strategy/gap08e-qcloud-edge-nodeport-apply-001/{real-mutation,portal-frontend-edge-service,portal-ingress}-redacted.json`
-> repo-native external access runner HTTPS smoke now probes `curl --help all`, uses `--fail-with-body` when available, otherwise falls back to `--fail --connect-timeout 10 --max-time 30 -sS -o /dev/null -w` structured output against only `https://portal.medopl.cn/`; next authorized gap is Gap 08f DNS validation + HTTPS external smoke after separate DNS alignment
-> Gap 08g qcloud Ingress 504 readonly diagnostics passed the allowed boundary: Ingress backend stayed `portal-frontend-edge:8080`, Ingress `Ready=True`, DNS `portal.medopl.cn` aligned to `lb-b33auprw-h1bv86yx9nswdtfj.clb.usw-tencentclb.com`, TLS verified with `ssl_verify_result=0`, Service/EndpointSlice/pod readiness and targetPort shape were normal, but external HTTPS stayed `504`; likely root cause moved to qcloud CLB health-check or forwarding path configuration, with evidence `.runtime/package-d-external-access-strategy/gap08g-ingress-504-diagnostics-001/readonly-diagnostics-redacted.json`
-> repo-native qcloud external access runner now supports Gap 08h modes `qcloud-healthcheck-dry-run` and `qcloud-healthcheck-apply`: it plans `TkeServiceConfig/portal-frontend-edge-healthcheck` with qcloud health check path `/`, domain `portal.medopl.cn`, method `GET`, accepted `2xx/3xx`, verifies the CRD exists fail-closed, binds it to `Ingress/portal-frontend` through `ingress.cloud.tencent.com/tke-service-config`, keeps backend `portal-frontend-edge:8080`, preserves `medopl-portal-tls` and `Service/portal-frontend-edge`, forbids DNS/LoadBalancer/Deployment/Service mutation outside the health-check binding, and writes `.runtime/package-d-external-access-strategy/<runid>/{qcloud-healthcheck,portal-ingress,real-mutation}-redacted.json`
-> Gap 08k OPL-Webui vs Portal qcloud Ingress compare found working `opl.medopl.cn` uses qcloud Ingress + NodePort without `TkeServiceConfig`, while Portal uses qcloud Ingress + NodePort with `ingress.cloud.tencent.com/tke-service-config=portal-frontend-edge-healthcheck` and still returns `504`; evidence is `.runtime/package-d-external-access-strategy/gap08k-opl-webui-vs-portal-compare-001/readonly-compare-redacted.json`
-> repo-native qcloud external access runner now supports Gap 08l modes `qcloud-remove-healthcheck-annotation-dry-run` and `qcloud-remove-healthcheck-annotation-apply`: it applies only `Ingress/portal-frontend` with `ingress.cloud.tencent.com/tke-service-config` removed, keeps backend `portal-frontend-edge:8080`, preserves `medopl-portal-tls`, `Service/portal-frontend-edge` and existing `TkeServiceConfig/portal-frontend-edge-healthcheck`, forbids delete/patch/DNS/LoadBalancer/Deployment/Service mutation outside the Ingress apply, and writes `.runtime/package-d-external-access-strategy/<runid>/{portal-ingress,real-mutation}-redacted.json`
-> authorized deploy
-> canary / QA / status update
```

Readonly and mutation lanes must use separate authorization, secret allowlists, support modules and evidence. Bounded local prework support lives under `tests/support/cloud-prework/`; it is not a default verification entrypoint and must be exercised through registered tests or explicit current-session authorization. Evidence with real secrets or live cloud responses stays in `.runtime` and does not enter git.

## Productization Delivery Sequence

Local RC 之后，默认 delivery 不直接跳到真实云。先按下列 package 顺序让用户体验和工程边界闭合：

| Order | Package | Purpose | Default eval boundary |
| --- | --- | --- | --- |
| 1 | `figma-portal-ui-absorption` | 把 Figma Make 的视觉/信息架构吸收到 repo-native Portal frontend。 | closed locally; archived at `changes/archive/2026-05-24-figma-portal-ui-absorption` |
| 2 | `portal-typed-api-contract` | 固定 Portal frontend 与 backend control plane 的 typed JSON/API contract。 | closed locally; archived at `changes/archive/2026-05-24-portal-typed-api-contract` |
| 3 | `provider-key-reuse` | 已绑定用户 `providerKeyRef` 可被 OPL launch/preflight 复用，不要求重复输入 raw key。 | landed locally at `816f7431ad3b5c8c0524b058d11eb08e851b055e` |
| 4 | `opl-entry-real-preflight-launch` | OPL entry UI 读取真实 preflight、launch、providerKeyRef、Gateway readiness 和 fail-closed reason。 | closed locally; archived at `changes/archive/2026-05-24-opl-entry-real-preflight-launch` |
| 5 | `go-control-plane-mvp-takeover` | Go 接管 MedOPL control-plane business truth；Portal frontend 通过 typed API 调 Go；Node Portal backend 业务 truth 物理清退，不保 Node/Go 双控制面。 | closed locally; archived at `changes/archive/2026-05-24-go-control-plane-mvp-takeover` |
| 6 | `precloud-deployable-rc` | 把 OPL Workbench、Portal frontend、Go SaaS backend 和 cloud connector fail-closed API 变成本地可部署形态。 | local deterministic proof only / ready for landing review |
| 7 | `real-cloud-authorization-boundary` | 先把 secret/provider/cloud/deploy/kubectl/build-push/live-test 授权边界作为 repo-native blocked cursor 固定下来。 | local dry-run / contract proof only |
| 8 | `real-cloud-readiness` | 只在显式授权后开启 mock/snapshot、readonly quote、dry-run plan、readonly inventory。 | cloud future-authorized dry-run first |
| 9 | `real-cloud-authorization` | 只在显式授权后执行 secret/cloud/provider/deploy work。 | authorized live package |

每个 package 必须遵守 `truth/gap -> change package -> spec delta -> eval plan -> implementation -> verify -> review -> archive -> history closeout`。这仍属于清退生命周期的一部分：旧临时 truth 只进 history，active 只保当前 cursor。治理 gate 保留为护栏，但 default verify 先展示 golden path health。

## Authoring Record Discipline

Each authoring branch or cleanup branch records:

- branch and base trunk HEAD
- subscribed truth/spec/policy files
- step commits
- verification commands and results
- subagent roles and models
- landing gate recommendation
- post-merge closeout expectation and target truth files
- non-goals and forbidden operations not performed

The durable human summary is `docs/history/README.md`; detailed proof remains in git history and command output.

## Change Package Delivery

Formal engineering work must create or update `changes/active/<change-id>` before implementation. The package owns proposal, spec delta, design, tasks, eval plan, review and closeout for that branch. `docs/active/README.md` may only point to the open change package; it must not duplicate change details.

Delivery closeout must move completed packages to `changes/archive/YYYY-MM-DD-<change-id>`, sync accepted deltas into durable specs, and add a compact summary to `docs/history/README.md`. If the change updates the current cursor, update both `docs/active/README.md` and `tests/fixtures/v22/goal-current.json`.

## Go Control Plane MVP Takeover Lane

`feat/v22-go-control-plane-mvp-takeover` 已归档为本地 Go control-plane MVP takeover lane。它不再是当前 open cursor；`precloud-deployable-rc` 已把 Portal frontend + Go SaaS backend 的本地可部署 RC 收口到 landing review。当前 open cursor 是 blocked `real-cloud-authorization-boundary`；真实云、deploy、kubectl、build/push 或 live-test 仍不授权。

先 Go control-plane MVP，再 real-cloud-readiness。该 lane 的交付方式是每个 step 一个 commit，并且每个 step 都按 `truth -> gap -> eval -> implementation/cleanup -> verify -> landing gate -> post-merge closeout -> next cursor` 执行。7 阶段只作为 compact machine block、spec anchor、registered tests 和 landed history summary 存在，不恢复旧合同目录、旧 recovery 目录、root stage docs 或 `scripts/smoke-test-*`。

Archived verification:

```bash
node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk
bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
```
