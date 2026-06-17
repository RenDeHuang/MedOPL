# Delivery Truth

Owner: `MedOPL`
Purpose: `delivery_truth`
State: `active`
Machine boundary: 本文是人读交付入口。当前执行 cursor、branch overrides 和 suite commands 以 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json` 为准。

## Current Cursor

当前 product cursor 是 `real-cloud-authorization-boundary`，状态是 authorization-required / before real-cloud readiness。pre-cloud 9 个 product slides、本地 RC、golden-path-first-class、golden-path-productization-roadmap、Figma Portal UI absorption、provider key reuse、Portal typed API contract、OPL entry real preflight / launch projection、local control-plane hardening、Go control-plane MVP takeover、precloud-deployable-rc、local SaaS backend RC、local Portal/OPL delivery RC、local AI MVP baseline、real-cloud readiness lane、real-cloud vision docs、legacy runtime cloud cleanup、Package B readonly inventory、TC3 diagnostic cleanup、Package C dry-run create/release plan 和 Package C live canary readiness gate 已完成本地闭环。最新 landed repo closeout 是 `recovery/platform-v22-trunk` / `04a8d56f41d2356772dad86d9336a7dcdd99ed2b`。TKE bootstrap preflight 已把“还没有 TKE”转成可验证的本地云底座 checklist；Package C dry-run 可以只消费 allowlisted foundation mapping 字段来记录 TKE cluster、受保护 platform service node pool 和 COS workspace root；Package C live canary readiness runner 只在 `--prepare-only --confirm-no-real-cloud` 下校验 `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`、API/secret allowlist、cluster `cls-fi097sy4`、protected pool `np-cbk784r8`、worker subnet `subnet-a1fldajw`、security group `sg-6671l5we`、tenant prefix `medopl-tenant-`、public IP disabled、plan catalog allowlist、evidence sink 和 expected create/release plan，并通过独立 non-secret cloud parameters JSON 生成 `.runtime` readiness evidence / redacted CreateNodePool request / authorization pack。Starter canary 固定验证 `starter_2c4g_10gb`：2C4G、10GB workspace storage、TKE `SA5.MEDIUM4`、`CLOUD_BSSD` 50GB node system disk；workspace storage 是用户套餐额度 / 计费项，不等于 TKE node system disk。Package C 已完成一次授权 live canary：`CreateNodePool`、scale up、scale down、`DeleteNodePool` 真实通过，canary tenant node pool 创建后已清理且 cleanup check 通过，受保护 platform pool `np-cbk784r8` 仍被观察到。Package C 保留 post-create `TagResources` plan，但 Tencent `tke:nodepool` 返回 `InvalidParameter.UnsupportedService` 时只记录 non-blocking event 并继续 scale / observe / release；其他 `TagResources` 错误仍 fail closed。ownership / billing attribution 的 canonical truth 已有 MedOPL PostgreSQL `resource_bindings` / `cloud_operations` ledger 下界；Package C live runner writes `.runtime` `ResourceBinding` / `CloudOperation` state-machine evidence for requested / creating / created / scaling / ready / releaseRequested / deleting / released / failed / cleanupRequired, with protected pool `np-cbk784r8` refused as a tenant node pool. Package C runner now also calls an injected ledger repository sink for create resource binding, append cloud operation event, nodePoolId update, lifecycle status update, released, failed and cleanupRequired paths; the default sink remains local/dry-run and does not read DB credentials or open a real PostgreSQL connection. Package C now has a gated PostgreSQL ledger sink support path with root `pg` driver dependency, `RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION=1`, local DB env allowlist, schema/write-permission preflight, explicit live canary write/read/cleanup runner, redacted `.runtime` evidence and fail-closed driver/gate checks; an authorized run read only the dedicated ledger env file and failed closed at PostgreSQL connection preflight timeout before DB write. 稳定上线方向不再依赖当前 WSL 作为 Package D 执行环境，也不追求本机连接 PostgreSQL 内网地址：Package D deploy readiness target 是 TKE cluster `cls-fi097sy4`，Portal PostgreSQL 使用 VPC 内网 `10.66.0.21:5432`；Package D runner placement 已迁到 node pool `np-6l4nkdto` / runner node `10.66.0.42`，selector 为 `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`。旧 `np-cbk784r8` 保留为 protected legacy/platform pool，不再作为 Package D runner target；Preferred deploy execution location 是 TKE in-cluster platform runner/job，调度到 namespace `medopl-platform`；deploy/smoke、Kubernetes API connectivity preflight、PostgreSQL ledger canary、DB connectivity smoke 和 rollback 在 TKE/VPC 内执行。build/push image readiness 与 deploy/smoke 分离，可由外部 build runner 或未来 Kaniko/BuildKit 处理；VPC CVM runner `medopl-v22-deploy-runner` 只保留为 fallback，不作为默认路线。PostgreSQL 不开公网，TKE API 不开公网，不新增额外 CVM 作为默认方案。Package D local shape gate 已验证 default-disabled deploy env、Portal runtime PostgreSQL endpoint、kubeconfig ref-only、manifest 调度到 platform service pool、rollback plan shape 和 tenant pool scheduling rejection；Package D reviewable release plan shape 已覆盖 `portal-frontend`、`medopl-go-backend`、`opl-web-gateway`、`opl-runtime-bridge` 四个 platform service image target、唯一 tag rule、TCR shape、manifest shape、runtime env secretRef、DB connectivity smoke plan、rollback plan 和 redacted evidence classes，因此 `releasePlanReady=true`。`realExecutionReady=false` 仍固定；Package D execution preflight gate 现在只做 split deploy/runtime env allowlist、固定 cluster/namespace/platform pool/PostgreSQL/image targets 和 redaction audit 判断，不读取 kubeconfig 内容、不 build/push、不 kubectl、不 deploy。Package D in-cluster platform runner/job shape gate 已固定 Kubernetes Job、serviceAccount `medopl-platform-runner`、secretRef/imagePullSecret runtime boundary、minimal RBAC、platform pool scheduling 和 redacted `.runtime` evidence；Package D runner manifest materialization 已生成静态 review pack、authorization pack 和 bootstrap authorization pack，并把 Job 拆成独立 run-scoped lifecycle。Package D repo-native 云端入口现在包括五个命令：server-side dry-run preflight runner `node tests/support/cloud-prework/package-d-kubernetes-api-preflight-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode server-side-dry-run`，bootstrap apply runner `node tests/support/cloud-prework/package-d-bootstrap-apply-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode bootstrap-apply`，run-scoped Job preflight runner `node tests/support/cloud-prework/package-d-run-scoped-job-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode preflight-job`，以及 production deploy runner contract/local gate `node tests/support/cloud-prework/package-d-production-deploy-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode production-deploy-plan --authorized 1`，以及 readonly service reachability runner `node tests/support/cloud-prework/package-d-service-reachability-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode in-cluster-http-smoke --authorized 1`；本地 gates 只用 fake inputs / fake kubectl 验证 fail-closed、redaction、server-side dry-run 命令形状、bootstrap apply allowlist、唯一 Job lifecycle、生产 Deployment/Service/ConfigMap manifest shape 和 ClusterIP HTTP smoke Job cleanup。Authorized cloud execution 已确认 Kubernetes API 连通、context/cluster 匹配 `cls-fi097sy4`、`medopl-platform` Active、Namespace/SA/RBAC/ConfigMap/Secrets/Job 均已存在；旧 post-apply server-side dry-run 失败在同名 `Job/medopl-platform-runner` `spec.template` immutable。当前修正后的 bootstrap apply / dry-run pack 只管理长期幂等资源：Namespace、ServiceAccount、RBAC、ConfigMap、Secret、imagePullSecret；run-scoped Job runner 下一步必须用唯一 `medopl-platform-runner-preflight-<runid>` 名称，在单独授权中创建、观察、收集 evidence，并按 `delete-on-success-retain-on-failure` 清理或保留。`pdrun-20260615-002` and `pdrun-20260615-003` were historical cloud runs on old `np-cbk784r8`; runner placement now targets `np-6l4nkdto` / `10.66.0.42` with `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, while `np-cbk784r8` remains protected and must not be deleted, scaled or modified. `pdrun-20260615-002` failed because a redacted image placeholder reached the live Job manifest, `pdrun-20260615-003` reached image pull but the fixed TCR tag was missing, and `pdrun-20260615-004` scheduled on `np-6l4nkdto` / `10.66.0.42` but image pull failed because the image manifest lacked the current node platform. The repo contract separates live and evidence manifests and the private build runner path published the fixed non-latest `linux/amd64` runner image without putting Docker build/push on the TKE/VPC runner. `pdrun-20260616-001` then completed successfully at repo HEAD `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de` with image `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`, selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, redacted logs, success cleanup of its Job and `NotFound` cleanup confirmation for old failed Job `pdrun-20260615-004`. Package D PostgreSQL/runtime env/combined in-cluster preflight `pdrun-20260616-002` then passed at repo HEAD `005e522c743244945a5c289cae7ce73b6a20d4a7`: image pull/run, PostgreSQL `10.66.0.21:5432` connectivity smoke, Package D SecretRef/env availability smoke, Job completion, Job cleanup `deleted_on_success` / `NotFound` after delete and redaction audit all passed. A later cloud production-deploy-plan preflight failed closed before server-side dry-run because `package-d-deploy.env` lacked `PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF`, `PACKAGE_D_GO_BACKEND_IMAGE_REF`, `PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF` and `PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF`, and because plan-only incorrectly required `RUN_TENCENT_DEPLOY_EXECUTION=1`. The local contract now requires `RUN_TENCENT_DEPLOY_EXECUTION=0` for `production-deploy-plan`, reserves `1` for future apply/live authorization, and fixes the four service image refs to `uswccr.ccs.tencentyun.com/medopl/{portal-frontend,medopl-go-backend,opl-web-gateway,opl-runtime-bridge}:v22-package-d-20260616-001`. Evidence paths are `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-002/preflight-job-redacted.json`, `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-002/job-manifest-redacted.json`, `.runtime/package-d-production-deploy/deploy-plan-redacted.json` and `.runtime/package-d-production-deploy/production-manifests-redacted.json`. Package D now has a repo-native four service private image publish contract/local gate command `node tests/support/cloud-prework/package-d-service-images-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-service-images-publish.env --authorized 1`; the lane is private-build-runner only, fixes the four service refs to non-latest TCR tags, requires `docker buildx build --platform linux/amd64`, rejects kubeconfig/DB/Portal/Tencent mutation secret classes and writes only redacted `.runtime` evidence. The local readiness gate now confirms those four service Dockerfile/build contexts and service-level .dockerignore files are present. Package D cloud `production-deploy-plan` dry-run/preflight has passed at repo HEAD `601bbc97c3d77e4aa7bb365cb60c5662582119c9` with four ConfigMaps, four Deployments, four Services, fixed image refs, SecretRefs, `np-6l4nkdto` scheduling, rollback plan, smoke plan and redacted evidence; no true apply/rollout/smoke/rollback/build-push/Tencent mutation/Package C live occurred. Package D readiness now has the repo-native `production-deploy-apply/live` single entrypoint, and authorized run `pdrun-20260616-004` has completed apply/rollout for all four services inside TKE. The services are still ClusterIP-only; the repo-native service reachability runner/local gate exists, but authorized in-cluster HTTP smoke evidence, Portal external access strategy, post-deploy DB/smoke evidence beyond shape checks and rollback execution evidence remain missing. `RUN_TENCENT_DEPLOY_EXECUTION` defaults to `0`, plan-only must keep it `0`, and any future apply/live must require explicit `1`. Package C live runner 只在显式授权且 run gate 为 `1` 时执行 allowlisted Tencent API，并在完成后把 run gate 写回 `0`；failure evidence 只保存脱敏 code/message/requestId/apiVersion/action/region/nodePoolName。Package B/C/TKE 的 prework support 归 `tests/support/cloud-prework/`，不再占用 default `scripts/` control-plane surface；future-authorized tests 和 manifest 仍负责本地 proof。current verify 继续先暴露 golden path health，再运行治理护栏。真实云新增 mutation、secret、deploy、kubectl、build/push、Package D 和 live-test 仍是单独授权边界；tenant node pool production path 还必须在服务能从 VPC 内访问 `medopl-postgres` 后完成 explicitly authorized successful PostgreSQL live canary、billing/audit ledger、Portal 开通入口和 workspace storage quota。

最近 landed 的 `feat/v22-slide-09-precloud-readiness` 已关闭 pre-cloud readiness 本地闭环，并把临时 slide baton 折叠为 history summary；默认 current bundle 仍保留 slide-01 storage regression、slide-02 runtime real API regression、slide-03 account/wallet/billing regression、slide-04 workspace/files regression、slide-05 resource lifecycle regression、slide-06 OPL entry runtime regression、slide-07 run/artifact/trace regression 和 slide-08 admin ops regression 作为防回归命令。

后续真实云工作不得继承 slide authority，也不得跳过产品化路线图；Go control-plane MVP takeover、precloud-deployable-rc、local SaaS backend RC 和 local Portal/OPL delivery RC 均只提供本地 RC evidence。下一步仍留在 `real-cloud-authorization-boundary`：Package D `production-deploy-apply` run `pdrun-20260616-004` 已让四个服务在 TKE 内 ready，但当前 Service 仍是 ClusterIP-only；readonly service reachability run `psr-20260617-001` 已在 `smoke_job_wait_complete` 超时并按策略清理 Job，本轮只补强 repo-native runner 的 wait-failure diagnostics。下一步是授权使用 `psr-20260617-002` 重新执行 readonly service reachability / in-cluster HTTP smoke runner，以及 Portal external access strategy（Ingress / LoadBalancer / internal gateway / admin-only port-forward）选择与授权边界。当前 cursor 不授权新的 Tencent mutation、kubectl、deploy、build/push、Ingress/LB 变更或手写 Package D execution。

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
-> repo-native service reachability runner wait-failure diagnostics landed locally: on future wait timeout it must collect redacted Job get/describe, Pod list/status, container waiting/terminated reasons and exitCode, image-pull status class, Events, and each allowlisted curl container log summary into `.runtime/package-d-service-reachability/<runid>/diagnostics-redacted.json` before delete-always-after-log-collection cleanup
-> next gap is authorized rerun `psr-20260617-002` of that service reachability runner plus Portal external access strategy; choose Ingress, LoadBalancer, internal gateway or admin-only port-forward under separate authorization before any public/user access claim
-> productionize PostgreSQL live canary after service runs inside VPC / billing-audit ledger / Portal opening entry / workspace storage quota
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
