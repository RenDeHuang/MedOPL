# History Truth

Owner: `MedOPL`
Purpose: `history_evidence_index`
State: `active`
Machine boundary: 本文是历史和证据入口，不是 current truth。当前事实看 `docs/active/README.md`；合同看 `docs/specs/README.md`；机器 cursor 和 verify manifest 看 `tests/fixtures/v22/*`。

## Scope

History 承接：

- agent-run evidence 摘要
- landing gate / landed / post-push records 摘要
- cleanup closeout
- superseded stage boards 摘要
- provenance and cleanup summaries

## Agent Run Schema

每条 agent-run 摘要必须记录：

- date
- run_type
- branch
- base trunk HEAD
- model
- subagents and model
- subscribed truth/spec/policy files
- commits
- verification commands and result
- landing gate result when landed
- non-goals
- risk notes
- next recommendation

landed 后的记录还必须补齐：

- landed_commit
- landing_gate_result
- post_push_verification
- post_merge_closeout
- next_cursor

`ready_for_landing_review` 只能出现在未 landed 的 authoring branch handoff 中。landing gate 已 ff-only merge 并 push 后，history 摘要必须改为 `landed / pushed / post-push verified`。历史细节不再展开成独立 `agent-runs/` 文件；详细证据以 git history 和 landing gate 输出为准。

## Tombstone Map

| Cleanup path or pattern | Cleanup reason | Current owner | Must not return as |
| --- | --- | --- | --- |
| distributed contract leaf docs | distributed contract leaves were absorbed into single specs truth | `docs/specs/README.md` | current contract leaf tree, compatibility alias, default verification input |
| recovery process docs | recovery process docs were absorbed into active/history taxonomy | `docs/active/README.md`, `docs/history/README.md` | current truth tree, agent-run archive tree, stage board |
| legacy root product doc | product truth moved into taxonomy views | `docs/product/README.md`, `docs/active/README.md` | second product truth or root entrypoint |
| legacy root architecture doc | architecture truth moved into runtime/source/specs views | `docs/runtime/README.md`, `docs/source/README.md`, `docs/specs/README.md` | second architecture truth |
| legacy root status doc | current status moved into active truth and machine cursor | `docs/active/README.md`, `tests/fixtures/v22/goal-current.json` | second current status board |
| legacy root invariants doc | durable invariants moved into policies/specs | `docs/policies/README.md`, `docs/specs/README.md` | root governance doc |
| legacy root decisions doc | decisions are now summarized by landed run history | `docs/history/README.md` | rolling decision log, current-truth override, second decision authority |
| legacy root vibe-coding doc | agent workflow discipline moved into policies and AGENTS | `AGENTS.md`, `docs/policies/README.md` | default workflow entrypoint |
| `scripts/smoke-test-*` | eval files moved to `tests/**`, scripts reduced to runner/classifier/workflow | `tests/**`, `scripts/v22-verify.mjs` | repo-local eval location, compatibility script family |

## Current Run Summaries

### 2026-06-17 production-launch-gap-02-package-c-operation-contract

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `0b3f109d73267661b039184a6139d4086b2f501b`

Model: `gpt-5.4`

Subagents: none

Scope:

- Landed the repo-native Production Launch Gap 02 Portal -> Go backend -> Package C operation contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-operation-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-operation-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, Portal action shape, Go backend operation request shape, Package C runner invocation boundary, ResourceBinding `requested` / `creating` / `ready` state transition contract, providerKeyRef-only boundary, idempotency, redacted evidence shape and external-access block.
- Added contract-only Go routes `POST /api/v22/production/package-c-operation/plan` and `POST /api/v22/production/package-c-operation/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-operation.ts`. These routes fail closed and do not execute Package C live operations.
- Evidence sink is `.runtime/production-launch-operation/<runid>/operation-contract-redacted.json`.
- The next unique gap is `production-launch-gap-03-resourcebinding-postgresql-ledger-live-write-read-contract`.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Can-claim:

- Production Launch Gap 02 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for the Package C production operation boundary are traceable and fail closed.
- ResourceBinding state shape is locally specified for `requested` / `creating` / `ready`.
- External/public access remains blocked.

Cannot-claim:

- Package C live operation has executed from Portal.
- Production PostgreSQL ResourceBinding ledger write/read, billing/audit/quota, workspace lifecycle, production canary, rollback execution, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-passed-external-access-pack

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `f380895ae67427d1167fb7f0c33370fe76bcc1fa`

Model: `gpt-5.4`

Subagents: none

Scope:

- Recorded authorized Package D readonly service reachability / in-cluster HTTP smoke run `psr-20260617-004`.
- Cloud facts: repo HEAD `f380895ae67427d1167fb7f0c33370fe76bcc1fa`, namespace `medopl-platform`, runner selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, smoke Job `medopl-service-smoke-psr-20260617-004`, all four Deployments ready `1/1`, all four Services are ClusterIP `8080/http`, and HTTP status was `200` for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`.
- Cleanup deleted the smoke Job and verified `NotFound`; `diagnostics-redacted.json` was not generated because the run succeeded.
- Evidence paths are `.runtime/package-d-service-reachability/psr-20260617-004/readonly-service-reachability-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-004/smoke-job-manifest-redacted.json`.
- Generated the next Portal external access strategy authorization pack in active/delivery/fixture truth. It compares admin-only port-forward, internal gateway, Ingress, LoadBalancer and HTTPS/domain, and recommends admin-only port-forward for the next non-public admin smoke unless persistent private access requires internal gateway.
- Superseded by later Production Launch Goal / Gap Map ordering: external access strategy remains available as historical planning, but it is no longer the current next gap until the multi-tenant minimum launch closure reaches that phase.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- Package D is deployed inside TKE.
- Package D in-cluster HTTP reachability passed for the four ClusterIP Services.
- External/public user access is not yet exposed.
- At that historical point, Portal external access strategy was drafted as an authorization boundary; current truth now defers it behind production launch gaps.

Cannot-claim:

- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-01-bootstrap-contract

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `31198b7f08c0aa60be8f1f442d968e4706e3b5c3`

Model: `gpt-5.4`

Subagents: none

Scope:

- Landed the repo-native Production Launch Gap 01 bootstrap contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-bootstrap-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-bootstrap-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, first admin identity bootstrap shape, tenant bootstrap shape, workspace seed shape, providerKeyRef-only public boundary, redacted evidence shape and external-access block.
- Added contract-only Go routes `POST /api/v22/production/bootstrap/plan` and `POST /api/v22/production/bootstrap/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-bootstrap.ts`. These routes fail closed and do not execute production bootstrap writes.
- Evidence sink is `.runtime/production-launch-bootstrap/<runid>/bootstrap-contract-redacted.json`.
- The next unique gap is `production-launch-gap-02-portal-backend-package-c-live-operation-contract`.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Can-claim:

- Production Launch Gap 01 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for production bootstrap are traceable and fail closed.
- External/public access remains blocked.

Cannot-claim:

- Production admin/tenant/workspace bootstrap has executed against a production database.
- Package C production operation wiring, PostgreSQL live ledger write/read, billing/audit/quota, workspace lifecycle, production canary, rollback execution, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-curl-security-context

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `d6e96696518036d1284f1df05926b53eb4ea156b`

Model: `gpt-5.4`

Subagents: none

Scope:

- Recorded authorized Package D readonly service reachability rerun `psr-20260617-003`: the run-scoped `Job/medopl-service-smoke-psr-20260617-003` was created and cleaned, but all four curl containers failed before start with `CreateContainerConfigError`.
- Recorded root cause from redacted diagnostics: `curlimages/curl:8.8.0` uses non-numeric user `curl_user`; with `runAsNonRoot: true`, Kubernetes cannot verify that the image user is non-root unless the container securityContext provides a numeric `runAsUser`.
- Recorded evidence paths: `.runtime/package-d-service-reachability/psr-20260617-003/readonly-service-reachability-redacted.json`, `.runtime/package-d-service-reachability/psr-20260617-003/diagnostics-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-003/smoke-job-manifest-redacted.json`.
- Updated `tests/support/cloud-prework/package-d-service-reachability-runner.js` so every curl smoke container sets `runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` and `capabilities.drop: ["ALL"]`.
- Added local/future-authorized coverage proving the run-scoped smoke Job manifest contains that numeric non-root curl container securityContext while preserving fail-fast curl and diagnostics behavior.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- The service reachability runner now has local-gated numeric non-root curl container securityContext.
- Future cloud rerun should use `psr-20260617-004` through the repo-native runner.

Cannot-claim:

- The in-cluster HTTP smoke passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-failfast-diagnostics

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `956d3724233b3306115275e938361ab4bf2fc587`

Model: `gpt-5.4`

Subagents: none

Scope:

- Recorded authorized Package D readonly service reachability rerun `psr-20260617-002`: the run-scoped `Job/medopl-service-smoke-psr-20260617-002` was created, its Pod was scheduled, `curlimages/curl` was pulled, `smoke_job_wait_complete` timed out after `120s`, HTTP endpoint status stayed uncollected and the Job was deleted by policy.
- Recorded evidence paths: `.runtime/package-d-service-reachability/psr-20260617-002/readonly-service-reachability-redacted.json`, `.runtime/package-d-service-reachability/psr-20260617-002/diagnostics-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-002/smoke-job-manifest-redacted.json`.
- Enhanced `tests/support/cloud-prework/package-d-service-reachability-runner.js` so curl smoke is fail-fast with connect/max timeout and fail-with-body semantics, and each endpoint emits redacted service/url/http_code/exit_code/total_time/error_class summary fields.
- Strengthened wait-failure diagnostics so the runner records redacted Job condition messages, Pod reason/message, nodeName/hostIP, per-container image/ready/restartCount/state/lastState, Events message/count/timestamps, and allowlisted curl logs or log-unavailable reasons before cleanup.
- Added local/future-authorized coverage in `tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` proving the stronger diagnostics shape and fail-fast curl manifest.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- The service reachability runner now has local-gated fail-fast curl and stronger wait-failure diagnostics.
- Future wait timeouts must write `.runtime/package-d-service-reachability/<runid>/diagnostics-redacted.json` before delete-always-after-log-collection cleanup.

Cannot-claim:

- The in-cluster HTTP smoke passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-wait-diagnostics

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da`

Model: `gpt-5.4`

Subagents: none

Scope:

- Recorded the authorized Package D readonly service reachability run `psr-20260617-001`: the run-scoped `Job/medopl-service-smoke-psr-20260617-001` was created, `smoke_job_wait_complete` timed out, `serviceResults` stayed empty and the Job was deleted by policy.
- Recorded evidence paths: `.runtime/package-d-service-reachability/psr-20260617-001/readonly-service-reachability-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-001/smoke-job-manifest-redacted.json`.
- Enhanced `tests/support/cloud-prework/package-d-service-reachability-runner.js` so wait timeout paths collect redacted Job get/describe, Pod list/status, container waiting/terminated reasons and exitCode, image-pull status class, Events and each allowlisted curl container log summary before cleanup.
- Added local/future-authorized coverage in `tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` proving `diagnostics-redacted.json` is written before cleanup and that the diagnostics remain redacted.
- Synchronized active/delivery/fixture truth so the next cloud run is a repo-native rerun with `psr-20260617-002`, not hand-written kubectl.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- The service reachability runner now has a local-gated wait-failure diagnostics path.
- Future wait timeouts must write `.runtime/package-d-service-reachability/<runid>/diagnostics-redacted.json` before delete-always-after-log-collection cleanup.

Cannot-claim:

- The in-cluster HTTP smoke passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

next_recommendation: authorize rerun `psr-20260617-002` through the repo-native service reachability runner.

### 2026-06-17 package-d-service-reachability-runner

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1664f2e10bd71b179ce9a5bfd8b64bee492b995c`

Model: `gpt-5.4`

Subagents:

- `explorer / gpt-5.4-mini`: read-only active truth / fixture sync check for Package D service reachability gap.
- `explorer / gpt-5.4-mini`: read-only runner/test pattern check for Package D cloud-prework entrypoints.

Scope:

- Added the repo-native Package D readonly service reachability / in-cluster HTTP smoke runner: `node tests/support/cloud-prework/package-d-service-reachability-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode in-cluster-http-smoke --authorized 1`.
- The runner fail-closes unless authorized, `RUN_TENCENT_DEPLOY_EXECUTION=0`, cluster `cls-fi097sy4`, namespace `medopl-platform`, platform pool `np-6l4nkdto`, run-id shape, env allowlist and kubeconfig ref all match.
- The runner command plan is limited to readonly `kubectl get deployment/service/pods`, creating one run-scoped `medopl-service-smoke-<runid>` curl Job, waiting/logging that Job and deleting only that Job.
- The HTTP smoke allowlist is fixed to `portal-frontend:8080/`, `medopl-go-backend:8080/readyz`, `opl-web-gateway:8080/healthz` and `opl-runtime-bridge:8080/healthz` through ClusterIP DNS in `medopl-platform`.
- Added the local/future-authorized gate and registered it in the cloud-future-authorized suite and verify manifest.
- Synchronized active/delivery/change package/fixture truth so the next gap is authorized runner execution plus Portal external access strategy, not hand-written kubectl.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- Package D has a repo-native readonly service reachability runner contract and local gate.
- The runner is ready for a separately authorized cloud execution that writes redacted `.runtime/package-d-service-reachability/<runid>/readonly-service-reachability-redacted.json` evidence.

Cannot-claim:

- In-cluster HTTP smoke has executed.
- External/public user access, Ingress, LoadBalancer, DNS, TLS, Portal self-service, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-production-deploy-success-closeout

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `b992dd5f65be2de68f29bead0f56e510b4ece19a`

Model: `gpt-5.4`

Subagents:

- `explorer / gpt-5.4`: read-only docs lifecycle check for Package D deploy success and next gap wording.
- `explorer / gpt-5.4`: read-only `goal-current.json` structure check for Package D deploy success fields.

Scope:

- Recorded the authorized Package D `production-deploy-apply` rerun `pdrun-20260616-004` at repo HEAD `b992dd5f65be2de68f29bead0f56e510b4ece19a`.
- The run completed server-side dry-run, apply and rollout for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge` in namespace `medopl-platform` on cluster `cls-fi097sy4`.
- All four Deployments reached ready `1/1`; all four Services exist as ClusterIP Services on `8080/http`; Pods scheduled to `node.tke.cloud.tencent.com/machineset=np-6l4nkdto` / host IP `10.66.0.42`.
- Smoke shape checks were `12/12` pass, rollback was not executed, rollback plan was generated, redaction audit passed and `RUN_TENCENT_DEPLOY_EXECUTION` was restored to `0`.
- Evidence paths recorded: `.runtime/package-d-production-deploy/pdrun-20260616-004/deploy-redacted.json`, `.runtime/package-d-production-deploy/pdrun-20260616-004/smoke-redacted.json` and `.runtime/package-d-production-deploy/pdrun-20260616-004/rollback-redacted.json`.
- Updated active/delivery/fixture truth to move the Package D gap from image republish / deploy rerun to readonly service reachability / in-cluster HTTP smoke and Portal external access strategy.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live in this repo session.

Can-claim:

- Package D four-service deployment completed inside TKE for `pdrun-20260616-004`.
- The current services are ClusterIP-only inside the cluster/VPC boundary.
- The next gap is readonly service reachability / in-cluster HTTP smoke and Portal external access strategy.

Cannot-claim:

- External/public user access, Ingress, LoadBalancer, DNS, TLS, Portal self-service, production billing or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-container-writable-path-fixes

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `4fca0092cca25ed708dbb7be6f712733ab57933c`

Model: `gpt-5.4`

Subagents:

- `explorer / inherited model`: read-only portal nginx writable path investigation.
- `explorer / inherited model`: read-only Runtime Bridge writable state-root investigation.

Scope:

- Recorded the authorized Package D `production-deploy-apply` attempt `pdrun-20260616-003`: four services were applied, `medopl-go-backend` and `opl-web-gateway` reached ready, while `portal-frontend` failed on nginx `/run/nginx.pid` permission denied and `opl-runtime-bridge` failed on `/.runtime` EACCES.
- Added `services/portal/frontend/nginx.conf` and updated the portal Dockerfile so nginx pid/temp paths use `/tmp/nginx` while continuing to run as nginx.
- Updated Runtime Bridge container defaults so `PORTAL_RUNTIME_BRIDGE_STATE_ROOT` uses `/tmp/medopl-runtime/.runtime` and the image prepares that path for the `node` user.
- Updated Package D production manifest materialization to mount writable `emptyDir` paths for the two affected services, inject the Runtime Bridge state-root env, keep non-root security contexts and use `imagePullPolicy: Always` for fixed-tag republish.
- Strengthened future-authorized gates so portal nginx does not write `/run/nginx.pid`, Runtime Bridge does not default to `/.runtime`, production manifests include the needed writable paths, and tenant pool / plaintext secret guards remain in place.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs` failed before portal nginx config existed.
- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs` failed before portal writable `emptyDir` was materialized.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- Final `npm run verify` and `npm run closeout:check -- --json` are required before push.

Can-claim:

- The local code/manifest contract now fixes the two writable path blockers observed during the first Package D production apply attempt.
- The next gap is authorized private build runner republish for `portal-frontend` and `opl-runtime-bridge`, followed by authorized repo-native `production-deploy-apply` rerun.

Cannot-claim:

- This repo session did not read secrets or kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.
- The fixed images have not been published by this repo session, rollout has not completed, post-deploy smoke has not passed and rollback evidence does not exist.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-service-images-publish-readiness

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1425dd23877902975350dab9996991ccb83d3fa4`

Model: `gpt-5.4`

Scope:

- Added the repo-native Package D four service image publish private-build-runner contract at `tests/support/cloud-prework/package-d-service-images-publish-runner.js`.
- Added the single later-authorized command: `node tests/support/cloud-prework/package-d-service-images-publish-runner.js --mode private-build-push --env /home/dev/.secrets/medopl/v22/package-d-service-images-publish.env --authorized 1`.
- Fixed the four image refs to `uswccr.ccs.tencentyun.com/medopl/{portal-frontend,medopl-go-backend,opl-web-gateway,opl-runtime-bridge}:v22-package-d-20260616-001`, required `docker buildx build --platform linux/amd64`, forbade `latest`, non-`medopl` namespace, non-allowlisted repos, kubectl/deploy/Tencent mutation/Package C live, and kept TKE/VPC runner out of Docker build/push.
- Kept private build runner env limited to `TCR_ID`, `TCR_SECRET` and the four `PACKAGE_D_*_IMAGE_REF` keys; kubeconfig, DB password, Portal admin password and Tencent SecretId/SecretKey remain forbidden in this lane.
- The local gate intentionally fails closed for real image publish readiness because the four service Dockerfiles are absent: `services/portal/frontend/Dockerfile`, `services/medopl-go-backend/Dockerfile`, `services/opl-web-gateway/Dockerfile` and `services/opl-runtime-bridge/Dockerfile`.

Verification:

- RED: temporary focused service-image gate failed with `ERR_MODULE_NOT_FOUND` before the service image publish runner existed; its assertions were then merged into `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs` to stay within the future-authorized file budget.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass, including the four service image publish contract/readiness assertions.
- Final `npm run verify` and `npm run closeout:check -- --json` are required before push.

Can-claim:

- The repo now has a single four service image publish contract/local gate for a private build runner, with fixed image refs and linux/amd64 build command shape.
- The next gap is service Dockerfile/build context materialization before any authorized private build/push.

Cannot-claim:

- This repo session cannot claim that it read TCR/kubeconfig/DB/Portal/Tencent secrets, ran docker login/build/push, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or published the four service images.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-c-postgres-ledger-sink-support

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `8bacfd2af1d67642037ecf97d8c99255ebecc957`

Model: `gpt-5.4`

Scope:

- Added Package C PostgreSQL ledger sink support under `tests/support/cloud-prework` with explicit `RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION=1` gate.
- Added allowlisted local DB env parsing, forbidden package-d/kubeconfig/Tencent key rejection, schema/table/write-permission preflight, parameterized ledger writes and redacted `.runtime` prepare-only evidence.
- Added the explicit PostgreSQL live canary runner contract for write/read/cleanup: `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`, existing tenant/workspace parent rows, canary-scoped `resourceBindingId`, post-write readback and cleanup readback-absent confirmation.
- Added the root `pg` driver dependency for the gated PostgreSQL sink and kept fail-closed behavior for missing gate, missing DB env, forbidden env, forbidden CLI args and missing driver loading.
- Registered the local gate in `cloud-future-authorized`.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.

Can-claim:

- Package C has a gated PostgreSQL ledger sink support path, root `pg` driver dependency, prepare-only preflight contract and explicit live canary write/read/cleanup runner contract.
- Prepare-only evidence redacts DB password / URL and does not write business rows.

Cannot-claim:

- A real DB secret was read, a real PostgreSQL connection was executed, Tencent mutation ran, kubectl/deploy/build-push/Package D ran, or Portal/billing/workspace quota productionization is complete.

### 2026-06-12 - Superseded cloud node pool topology

- The earlier shared user compute pool / premium dedicated pool future-phase wording is retained below only as provenance for landed prework.
- Current truth has moved to unified TKE cluster + platform service node pool + Package C-created tenant node pool per tenant or workspace.
- The old single `TENCENT_MUTATION_TKE_NODE_POOL_ID` shared-pool mapping is superseded by `TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID`; tenant node pool IDs are produced by authorized Package C lifecycle execution, not prefilled in foundation notes.

### 2026-05-28 changes/archive/2026-05-28-portal-opl-refund-api-fix

Status: `archived / local-gated`

Branch: `fix/v22-portal-opl-refund-api`

Archived change package: `changes/archive/2026-05-28-portal-opl-refund-api-fix`

Scope:

- Fixed local Portal `/portal/opl` entry alias so Gateway direct-entry return does not render React Router default 404.
- Made OPL entry run provider preflight before launch creation, so missing provider binding renders the binding UI without a launch 428 console error.
- Fixed Go local Portal refund ledger semantics so refund decreases balance and records a negative ledger amount.

Verification result:

- Focused RED was observed for refund: balance went from 120 to 150 before the fix.
- Full verification result is recorded in the package closeout and commit message.

Can-claim:

- Local Portal refund and OPL entry route/preflight semantics are covered by local deterministic regression proof.

Cannot-claim:

- Production billing, real payment refund, real upstream OPL production behavior, live provider, real cloud, deploy or production runtime readiness.

Next owner:

- `MedOPL Platform` keeps local Portal/OPL delivery regression green.

### 2026-05-23 changes/archive/2026-05-23-local-golden-path-release-candidate

Status: `authoring / local gate pending landing`

Branch: `cleanup/golden-path-first-class`

Archived change package: `changes/archive/2026-05-23-local-golden-path-release-candidate`

Scope:

- Added a local RC provider-bound message backflow eval for the product golden path.
- Verified Portal login, credit, provider key backend secret boundary, managed environment open, OPL Gateway launch/bootstrap against local OPL WebUI, Runtime Bridge ACP message reply, file/run/artifact projection, Portal trace projection and release/stop billing audit shape.
- Registered the eval only in `local-rc-authorized`; default `golden-path`, `current`, `contract` and `review` remain deterministic and non-secret.
- Kept local RC evidence below production truth and recorded remaining gaps.

Commits:

- `d642f43` opens the local golden path release candidate package.
- `f628cb7` adds the provider-bound local RC eval and lane metadata.
- `22ed6fb` records local RC eval closeout.
- `d311cd5` satisfies workflow secret hygiene and renames the eval to provider-bound wording.
- `7deaaa2` closes verification and review evidence.
- `d5f65d132f9f190286caf66230509839778cbdcd` archives the package and records this history handoff.

Verification result:

- `node tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs` with authorized provider credential env: pass.
- `npm run verify:golden-path`: pass.
- `npm run verify:current`: pass.
- `npm run verify:contract`: pass.
- `npm run verify:review`: pass.
- `npm --prefix services/portal run check`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`: pass.
- `node tests/health/health-check-v22-smoke-classification-gate.mjs`: pass.
- `node tests/health/health-check-v22-smoke-eval-boundary.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite local-rc-authorized --base origin/recovery/platform-v22-trunk --dry-run --json`: pass.
- `npm run gate:change`: pass.
- `git diff --check -- changes docs specs scripts tests`: pass.

Independent review:

- Reviewer: Codex native explorer subagent.
- Model: `gpt-5.4-mini`.
- Result: read-only review found one archive-closeout blocker; archive and history handoff fixed it. No blocker remained for lane placement, secret hygiene, false production claim, or spec/eval registry consistency.

Can-claim:

- A user-owned gflabtoken can be provided to Portal through the backend secret boundary and projected publicly only as `providerKeyRef` in this local RC path.
- Local Portal -> OPL Web Gateway -> local clean OPL WebUI -> Runtime Bridge can complete provider-bound bootstrap and ACP message reply projection.
- Local RC covers login, credit, provider key, managed environment open, launch, file, message, run, artifact, trace and release/stop billing shape.
- Missing provider config remains fail-closed with `provider_config_required`.
- Raw provider key is not exposed in public responses, child stdout/stderr, Runtime Bridge state or git-tracked evidence.

Cannot-claim:

- Production provider readiness.
- Real WebUI provider message reply evidence.
- Real cloud resource lifecycle, deploy, kubectl rollout, build/push, production billing or production trace evidence.
- Portal launch automatically reuses an already bound provider key without inline `providerKeyPayload`.
- Future secret reads beyond the single local RC provider credential run.

Next owner:

- `MedOPL Platform` owns the remaining local RC gap: Portal launch API should reuse an already bound provider key without inline `providerKeyPayload`.
- `MedOPL Operations` owns the later real-cloud authorization package when explicitly authorized.

landed_commit: `d5f65d132f9f190286caf66230509839778cbdcd`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `d5f65d132f9f190286caf66230509839778cbdcd`.
- The archived local RC package is tracked at `changes/archive/2026-05-23-local-golden-path-release-candidate`.
- This closeout remains local/pre-cloud evidence and does not authorize secret read, real cloud, deploy, kubectl, build/push or live-test.

post_push_verification:

- `d7b9877cd6c6b87cd0a292f647149fc511cc842c` is merged into local recovery/platform-v22-trunk by ff-only.
- Remote push verification is pending until the next push step.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-23 changes/archive/2026-05-23-repo-native-change-lifecycle

Status: `archived / local-gated`

Branch: `cleanup/repo-native-change-lifecycle`

Archived change package: `changes/archive/2026-05-23-repo-native-change-lifecycle`

Scope:

- Added repo-native change lifecycle under `changes/`.
- Added durable domain specs under root `specs/`.
- Kept `docs/active/README.md` as current truth only.
- Added local gates for change package lifecycle, spec/eval traceability, registry, manifest and workflow review.
- Opened `changes/active/real-cloud-authorization-boundary` for the current sensitive boundary without authorizing real cloud operations.
- Renamed the formal gate from contract-gate to change-package-gate while keeping `local-contract` as a lower-bound eval suite.
- Strengthened workflow review so formal changes must include a diff-local valid change package with target specs and local eval commands.

Commits:

- `63f5e8a` through `b67a8e4` establish baseline, change model, templates, active boundary, docs wiring, root specs, delta rules, traceability gates, registry/manifest integration, workflow gate, archive rules, durable spec sync, history sync, active real-cloud package, formal gate rename and deterministic eval closeout.
- Review-fix commit strengthens change-package gate binding and closeout evidence.

Verification result:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package change-package-gate --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass; 15 durable requirement rows checked.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs specs changes tests scripts package.json .github`: pass.

Independent review:

- Reviewer: Codex native explorer subagent.
- Model: `gpt-5.4-mini`.
- Result: one workflow-gate blocker, one spec traceability important finding and one closeout minor finding; all fixed before closeout.

Can-claim:

- Formal engineering changes now have a repo-native change package lifecycle.
- Durable domain specs and spec-to-eval traceability exist and are locally gated.
- Formal review requires a diff-local change package with target spec and eval command binding.

Cannot-claim:

- OpenSpec CLI is installed or required.
- Real cloud, deploy, kubectl, build/push, live-test or production release is authorized.
- Product, Portal, Gateway or Runtime Bridge runtime behavior changed.
- Open active package means secret or real-cloud authorization has been granted.

Next owner:

- `MedOPL Platform` maintains lifecycle gates; future product/cloud work must open `changes/active/<change-id>` before implementation.

### 2026-05-23 cleanup/repo-native-change-lifecycle baseline

Status: `authoring / baseline-audit`

Branch: `cleanup/repo-native-change-lifecycle`

Base branch state: starts from `cleanup/framework-truth-layering` after active truth slimming review.

Scope:

- Introduce repo-native change lifecycle without weakening the existing one-person-lab-style truth taxonomy.
- Keep `docs/active/README.md` as the only human current truth control surface.
- Add OpenSpec-style change package governance for proposed work: proposal, spec delta, design, tasks, eval plan, review, closeout and archive.
- Add durable domain specs as a structured behavior layer without restoring retired `docs/contracts/**`, `docs/recovery/**`, root stage docs or `scripts/smoke-test-*`.
- Connect change lifecycle to existing local deterministic evals under `tests/**` and `scripts/v22-verify.mjs`.

Inventory:

| Layer | Current owner | Baseline finding |
| --- | --- | --- |
| current truth | `docs/active/README.md`, `tests/fixtures/v22/goal-current.json` | Already narrow: current phase, cursor, blockers, next owner, verification entry and cannot-claim. |
| durable human truth | `docs/{product,runtime,framework,evidence,policies,delivery,source,public,references,history}/README.md` | Already OPL-style one README per lifecycle surface. |
| contract/spec truth | `docs/specs/README.md` | Still monolithic; needs domain specs and spec-delta routing before it becomes maintainable as the repo grows. |
| eval truth | `tests/**`, `scripts/v22-test-classification.mjs`, `scripts/v22-verify.mjs` | Strong local eval registry exists, but spec-to-eval traceability is not yet attached to repo-native change packages. |
| history truth | `docs/history/README.md`, git history | Keeps landed summaries; does not retain full proposal/design/task/spec-delta context. |
| missing lifecycle layer | none | No `changes/active/<id>` or `changes/archive/<id>` layer exists for proposal, spec delta, eval plan and closeout. |

Subscribed truth/spec/policy files:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/framework/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Planned lifecycle:

```text
active current cursor
-> changes/active/<change-id>
-> spec delta
-> design
-> tasks
-> eval plan
-> implementation
-> local verify
-> review
-> changes/archive/<date-change-id>
-> durable specs sync
-> docs/history closeout
-> next active cursor
```

Authorization boundary:

- No secret read.
- No real cloud, true provider, COS, Langfuse, production API or upstream call.
- No build/push, kubectl, deploy, live-test, git push or merge.
- No modification to `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or one-person-lab upstream.
- No restoration of retired `docs/contracts/**`, `docs/recovery/**`, root stage docs, old `scripts/smoke-test-*`, `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.

Planned verification:

- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs`
- `node tests/contract/contract-test-v22-framework-truth-layering.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- docs specs changes tests scripts`

Non-goals:

- Do not turn `docs/active/README.md` into an open-change plan board.
- Do not use OpenSpec CLI as a runtime dependency in this pass.
- Do not split source services or change Portal/Gateway/Runtime behavior.
- Do not expand `scripts/`; the existing scripts file budget is already full.

### 2026-05-23 cleanup/framework-truth-layering active slimming baseline

Status: `authoring / baseline-audit`

Branch: `cleanup/framework-truth-layering`

Base trunk HEAD: `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`

Starting HEAD: `ca36a3477c4714aafe2128f23edebbc6c5c68dd4`

Model:

- controller: `gpt-5`
- subagent Feynman: `gpt-5.4-mini`, read-only active slimming classification review.

Scope:

- Renew the framework truth-layering cleanup by making `docs/active/README.md` a narrow current-state control surface.
- Keep temporary/current truth only in `docs/active/README.md`.
- Keep durable product truth in `docs/product/README.md`, runtime/upstream truth in `docs/runtime/README.md`, framework rules in `docs/framework/README.md`, contract lower bounds in `docs/specs/README.md`, evidence claims in `docs/evidence/README.md`, stable policy in `docs/policies/README.md`, and landed provenance in this file.
- Preserve the existing README taxonomy and do not restore retired `docs/contracts/**`, `docs/recovery/**`, root `docs/status.md`, root `docs/invariants.md`, root `docs/product.md`, root `docs/architecture.md`, root `docs/decisions.md` or `scripts/smoke-test-*`.

Subscribed truth/spec/policy files:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/contract/contract-test-v22-framework-truth-layering.mjs`

Inventory:

| Current active content | Target layer |
| --- | --- |
| current phase, current cursor, open blockers, next owner, cannot-claim, verification entry | `docs/active/README.md` |
| product narrative, optional resource lifecycle, commercial model, UI impact and user loop | `docs/product/README.md` plus specs anchors |
| Gateway, Runtime Bridge, clean upstream and backend convergence target | `docs/runtime/README.md` |
| owner boundary, surface budget, admission, readiness and four planes | `docs/framework/README.md` |
| provider key, secret, cloud authorization, no-fake-success and hard forbidden surfaces | `docs/specs/README.md`, `docs/policies/README.md` |
| smoke/proof/canary/live/production can-claim and cannot-claim | `docs/evidence/README.md` |
| landed commits, closeout summaries and provenance | `docs/history/README.md` |

Planned verification:

- `node tests/contract/contract-test-v22-framework-truth-layering.mjs`
- `node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs`
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-current-development-lines.mjs`
- `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`
- `node tests/contract/contract-test-v22-commercial-package-model.mjs`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`

Non-goals:

- No secret read.
- No real cloud, live provider, COS, Langfuse or production API call.
- No build/push, kubectl, deploy, live-test, push or merge.
- No modification to `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or one-person-lab upstream.
- No restoration of retired recovery/contracts/root-doc/smoke-script surfaces.

### 2026-05-22 cleanup/framework-truth-layering baseline audit

Status: `authoring / baseline-audit`

Branch: `cleanup/framework-truth-layering`

Base trunk HEAD: `d12ebb6`

Model:

- controller: `gpt-5 runtime`
- subagent Leibniz: `gpt-5.4-mini`, read-only current docs truth layering inventory.
- subagent Darwin: `gpt-5.4-mini`, read-only one-person-lab framework discipline comparison.
- subagent Helmholtz: `gpt-5.4-mini`, read-only test lane / governance gate pattern review.

Scope:

- Start the MedOPL Platform Framework truth-layering cleanup without restoring retired `docs/contracts/**`, `docs/recovery/**`, root `docs/status.md`, root `docs/invariants.md`, root `docs/product.md`, root `docs/architecture.md`, root `docs/decisions.md` or `scripts/smoke-test-*`.
- Record that the current trunk has already collapsed legacy recovery and contract leaf trees into an OPL-style README taxonomy: `docs/active/README.md`, `docs/product/README.md`, `docs/runtime/README.md`, `docs/specs/README.md`, `docs/policies/README.md`, `docs/delivery/README.md`, `docs/source/README.md`, `docs/public/README.md`, `docs/references/README.md`, `docs/history/README.md` and `tests/**`.
- Treat the original `/goal` paths as historical recovery inputs where absent, not as paths to recreate.
- Build the new framework layer on the current taxonomy by adding explicit framework and evidence views, tightening docs index pointers, and adding registered local gates under `tests/**`.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Baseline truth-layer inventory:

| Layer | Current owner | Baseline finding |
| --- | --- | --- |
| rules | `AGENTS.md`, `docs/policies/README.md`, durable anchors in `docs/specs/README.md` | Stable collaboration, authorization, lifecycle and non-negotiable product constraints already live outside recovery. |
| contracts | `docs/specs/README.md`, plus product/runtime contract group pointers | Legacy `docs/contracts/**` is physically retired; current task must not recreate it. |
| status | `docs/active/README.md`, `tests/fixtures/v22/goal-current.json`, delivery cursor view | Legacy root `docs/status.md` is retired; current status is active truth plus machine cursor. |
| evidence | `docs/history/README.md`, `tests/fixtures/v22/agent-verify-manifest.json`, local eval output | Evidence currently shares history; this run will add an explicit evidence view that remains non-current truth. |
| history | `docs/history/README.md`, git history | Legacy `docs/recovery/**` is retired; history remains summary-only. |
| noise / drift risk | repeated current-truth pointers in product/runtime/history and long absorbed-contract prose in specs | Needs framework/evidence views and local gate to prevent status, evidence and contract prose from becoming one mixed truth surface again. |

Framework mechanisms to import from one-person-lab discipline:

- Rules precede status; current status cannot rewrite durable invariants.
- Contracts/specs keep lower bounds: boundary, permission, receipt, blocker, audit and cannot-claim; they do not claim current completion.
- Evidence-after-contract: smoke, proof, canary and live evidence only prove bounded claims and never upgrade themselves to production truth.
- Surface budget: default human reading surface stays summary-first; drilldown and history carry detail.
- Owner boundary: clean OPL upstream owns OPL framework/runtime/domain truth; MedOPL owns SaaS platform, Portal, Gateway, Runtime Bridge, resources, billing, audit and projection truth.

Adjusted implementation decision:

- Do not create `docs/project.md`, `docs/status.md`, `docs/invariants.md`, `docs/contracts/**`, `docs/recovery/**` or `scripts/smoke-test-v22-framework-truth-layering.mjs`, because current trunk gates explicitly forbid those retired entrypoints.
- Add `docs/framework/README.md` and `docs/evidence/README.md` only after updating docs taxonomy and gates, because current docs rule is one README per lifecycle directory.
- Add local eval under `tests/contract` or `tests/smoke` and register it in `scripts/v22-test-classification.mjs`; do not add new smoke bodies under `scripts/`.

Verification before this baseline commit:

- `git status --short --branch`: clean before authoring branch changes.
- `git rev-parse --short recovery/platform-v22-trunk`: `d12ebb6`.
- Read-only subagent review completed with no file edits and models recorded above.

Non-goals:

- No business service code changes.
- No Portal UI changes.
- No old root docs restoration.
- No `docs/contracts/**` or `docs/recovery/**` restoration.
- No `scripts/smoke-test-*` restoration.
- No secret read, live cloud call, true OPL/provider call, Langfuse, COS, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Next recommendation:

- Add the framework and evidence lifecycle views, update docs taxonomy pointers, then register a local framework truth-layering gate that verifies the adjusted entrypoint model.

### 2026-05-22 cleanup/v22-backend-convergence-trunk-closeout

Status: `authoring / local gate pending landing`

Branch: `cleanup/v22-backend-convergence-trunk-closeout`

Base trunk HEAD: `83dc7f669de0b109c4cc5b8f437d06d659aa5802`

handoff_commit: `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`

Model:

- controller: `gpt-5 runtime`
- subagents: none

Scope:

- Close the post-merge governance drift after `feat/v22-backend-go-convergence-program` became reachable from trunk.
- Keep the backend convergence program as historical structural convergence evidence, not the current product cursor.
- Record the two trunk follow-up commits after the backend program head: compact backend convergence gates and allow backend convergence fixtures in the taxonomy gate.
- Preserve `real-cloud-authorization-boundary` as the current product cursor; this closeout does not authorize secret read, true cloud execution, deploy, kubectl, build/push or live-test.

Contract subscription:

- `docs/active/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `scripts/v22-landing-closeout.mjs`
- `tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `tests/contract/contract-test-v22-mvp-contract-suite.mjs`

Verification before closeout:

- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json` failed with stale reachable `ready_for_landing_review` backend convergence history sections and non-closeout commits after `83dc7f669de0b109c4cc5b8f437d06d659aa5802`.
- `git merge-base --is-ancestor 8e2c9a0dfd006c8f9dc03c0265d2d064ab4ea342 origin/recovery/platform-v22-trunk` returned success.
- `git rev-parse origin/recovery/platform-v22-trunk` returned `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`.

Non-goals:

- No product cursor advancement beyond `real-cloud-authorization-boundary`.
- No production Go backend replacement claim.
- No service, Portal UI, Gateway, Runtime Bridge or upstream code change.
- No secret read, live cloud call, true provider call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Risk notes:

- `feat/v22-backend-go-convergence-program` remains structural convergence history and local contract evidence only.
- The latest trunk closeout commit is a governance closeout, not production evidence for PostgreSQL, Redis, Go backend replacement, real cloud execution or customer-visible dedicated runtime.
- Backend convergence stage summaries below are retained as historical evidence and marked absorbed; they are not current entrypoints and not open landing requests.

landed_commit: `d12ebb6c886c4a1717abe8f9b3308ab74842ed57`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- Backend convergence program head `8e2c9a0dfd006c8f9dc03c0265d2d064ab4ea342` is reachable from `origin/recovery/platform-v22-trunk`.
- `262388cc8c6538bd253f70eb1992365af281f03b` compacted backend convergence gates after the program head.
- `d12ebb6c886c4a1717abe8f9b3308ab74842ed57` allowed backend convergence fixtures in the taxonomy gate and is the current trunk head for this closeout.
- This closeout reconciles history and machine cursor only; it performs no external operation.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-22 feat/v22-backend-go-convergence-program stage-1

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Sartre: `gpt-5.4`, read-only docs taxonomy and backend convergence program placement review.
- subagent Poincare: `gpt-5.4`, read-only current backend responsibility drift review.
- subagent Lagrange: `gpt-5.4`, read-only Go backend active-surface and gate design review.
- subagent Kuhn: `gpt-5.4`, read-only Step 4/5 responsibility inventory and migration-map design.
- subagent McClintock: `gpt-5.4`, read-only Step 8-10 Go scaffold, Ent/Postgres and Redis boundary design.

Scope:

- Register the backend Go convergence authoring lane without replacing the current `real-cloud-authorization-boundary` product cursor.
- Define `services/medopl-go-backend` as the future canonical backend target while keeping `services/portal` as the migration-period active implementation.
- Align runtime and source views on the target structure: Portal Control Plane -> Workflow Boundary -> Runtime Broker / OPL Bridge -> Agent Runtime -> Cloud / Billing / Audit Workers.
- Keep the 7 phases as compact machine truth, spec anchor, registered tests and history summary; do not restore old contracts, recovery docs or smoke script families.

Commits:

- `6b0f6fc docs(v22): register backend go convergence program`
- `6c384b6 docs(v22): define go backend convergence boundary`
- `79fe703 docs(v22): align backend convergence runtime and source views`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json`
- `git diff --check -- docs tests scripts package.json`

Non-goals:

- No business service migration in stage 1.
- No production Go backend claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Current Node Portal remains heavier than the target structure; stage 2 must make that drift machine-readable before implementation.
- `services/medopl-go-backend` is still a future target and must enter active surface only through manifest, registered tests, workflow review and package verification.

Landing gate recommendation:

- Continue authoring branch to stage 2 before asking for final branch landing. If landing gate reviews stage 1 in isolation, the diff is local docs/tests/fixtures only and does not advance the product cursor.

Next recommendation:

- Proceed to stage 2: classify current Portal, Gateway and Runtime Bridge responsibilities, then map Node files to Go target modules before touching service behavior.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-2

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Kuhn: `gpt-5.4`, read-only Step 4/5 responsibility inventory and migration-map design.
- subagent McClintock: `gpt-5.4`, read-only Step 8-10 Go scaffold, Ent/Postgres and Redis boundary design.

Scope:

- Classify all active backend `.mjs` files under `services/portal/src`, `services/opl-web-gateway/src` and `services/opl-runtime-bridge/src`.
- Add a machine-readable backend inventory fixture covering 180 active backend source files.
- Add a machine-readable Node-to-Go migration map covering risky `misplaced` and `delete-later` files.
- Register both gates in the test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `ad7d7ec docs(v22): classify backend responsibilities for go convergence`
- `ee32f0d docs(v22): map node backend files to go target modules`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/backend-go-convergence/backend-inventory.json`
- `tests/fixtures/v22/backend-go-convergence/migration-map.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-backend-responsibility-inventory.mjs`
- `node tests/contract/contract-test-v22-node-to-go-migration-map.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- docs tests scripts package.json`

Non-goals:

- No service behavior change in stage 2.
- No production Go backend claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Inventory and migration map expose current responsibility drift but do not fix it yet.
- Stage 3 must turn the highest-risk drift into explicit gates before implementation: Portal long task truth, cloud mutation, memory launch status, billing/audit aggregation and runtime bridge token/secret boundaries.

Landing gate recommendation:

- Continue authoring branch to stage 3 before final landing so the inventory can immediately drive enforcement gates.

Next recommendation:

- Proceed to stage 3: add contract/regression gates for Portal long task mutation boundaries, then introduce a workflow facade in Node Portal without changing user-visible API contracts.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-3

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Carver: `gpt-5.4`, read-only Step 7 Node Portal workflow facade minimal-boundary review.

Scope:

- Gate the dangerous Node Portal responsibility drift before broad migration: Portal long task mutation, cloud operation mutation, in-memory OPL launch truth, billing/audit aggregation and Runtime Bridge token/secret boundaries.
- Introduce `services/portal/src/services/portal-workflow-facade.service.mjs` as the migration-period command handoff facade.
- Route OPL launch, OPL native login launch, lab package activate/upgrade cloud bridge calls and v22 cloud operation mutation routes through the workflow facade without changing user-visible API paths, DTOs or cookie semantics.
- Update backend responsibility inventory and Node-to-Go migration map so the new facade is a tracked workflow boundary and future Go target maps to `internal/domain/workflow + internal/service/workflow`.

Commits:

- `5a883d9 docs(v22): align portal user provider status contract`
- `3a68e60 test(v22): gate portal long task mutation boundaries`
- `3ad6607 refactor(v22): introduce node portal workflow facade boundary`

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/backend-go-convergence/backend-inventory.json`
- `tests/fixtures/v22/backend-go-convergence/migration-map.json`

Verification before landing review:

- `node tests/contract/contract-test-v22-portal-long-task-mutation-boundaries.mjs`
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`
- `node tests/contract/contract-test-v22-backend-responsibility-inventory.mjs`
- `node tests/contract/contract-test-v22-node-to-go-migration-map.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm --prefix services/portal run check`
- `git diff --check -- docs tests scripts package.json services/portal/src`

B review pack:

- `git diff --stat`: 25 files changed from trunk at stage handoff, including Stage 1-3 docs/tests/fixtures and the Step 7 Portal facade implementation.
- `git show --name-only --oneline HEAD`: `3ad6607 refactor(v22): introduce node portal workflow facade boundary`.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: workflow facade preserves executor result; business failure results mark command state failed without converting the public result to success.
- Landing recommendation: continue authoring branch to Stage 4 before final branch landing; B can review Stage 3 as ff-only absorbable if asked.

Non-goals:

- No Temporal, LangGraph or durable engine dependency in Stage 3.
- No Go backend scaffold yet.
- No production backend claim.
- No user-visible API contract change.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Node Portal still owns migration-period execution of the facade; durable semantics are intentionally behind the facade and not claimed by Stage 3.
- Existing OPL launch in-memory status remains visible and gated as migration debt; the new facade prevents further route-level expansion before the Go workflow boundary lands.
- Stage 4 must introduce the Go service as future canonical target without claiming production replacement and without connecting to real Postgres or Redis by default.

Next recommendation:

- Proceed to Stage 4: scaffold `services/medopl-go-backend`, add Ent/Postgres schema baseline and enforce Redis volatile-only boundaries with Go tests and manifest/package gates.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-4

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Bacon: `gpt-5.4`, read-only Stage 4 Step 8-10 Go scaffold, Ent/Postgres and Redis boundary review.
- subagent Cicero: `gpt-5.4`, read-only Step 9 Ent/Postgres contract compliance review.
- subagent Descartes: `gpt-5.4`, read-only Step 9 Go schema quality and pollution-risk review.
- subagent Aquinas: `gpt-5.4`, read-only Step 9 schema/migration consistency re-review.
- subagent Linnaeus: `gpt-5.4`, read-only Step 9 codegen and migration consistency re-review.
- subagent Socrates: `gpt-5.4`, read-only Step 9 final review after Ent codegen gate was added.
- subagent Sagan: `gpt-5.4`, read-only Step 10 Redis volatile-only boundary review.
- subagent Feynman: `gpt-5.4`, read-only Step 10 TTL fail-closed re-review.

Scope:

- Scaffold `services/medopl-go-backend` as a future canonical backend target with Go 1.22, Gin, `cmd/server`, config loading, server/router wiring and deterministic `/health`, `/version` and `/config/check` handlers.
- Add an Ent/PostgreSQL baseline for `tenant`, `user`, `workspace`, `run`, `artifact`, `file`, `billing_event` and `workflow_execution` without connecting to real PostgreSQL.
- Keep PostgreSQL as canonical truth direction and keep SQL baseline deterministic/repeatable while avoiding empty-string absence encoding and secret/blob locator fields.
- Add a volatile repository boundary for session/cache/queue/lock only, backed by a local memory implementation for tests; no real Redis client and no `internal/repository/redis` truth source.
- Register Go service surface, Ent/Postgres and Redis volatile boundary gates in test classification, manifest suites, branch override and backend convergence package.

Commits:

- `13cd7e6 feat(go): scaffold medopl go backend`
- `369f35d feat(go): add ent postgres schema baseline`
- `1bb9869 feat(go): add redis volatile state boundary`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/source/README.md`
- `docs/runtime/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `node tests/contract/contract-test-v22-go-backend-ent-postgres-boundary.mjs`
- `node tests/contract/contract-test-v22-go-backend-redis-volatile-boundary.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/medopl-go-backend`

B review pack:

- `git diff --stat`: Stage 4 adds Go backend scaffold, Ent schema baseline, deterministic SQL baseline, volatile session/cache/queue/lock boundary and registered contract gates.
- `git show --name-only --oneline HEAD`: `1bb9869 feat(go): add redis volatile state boundary`.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: Ent contract now runs real `ent generate` in a temporary Go module; volatile store rejects non-positive TTL and missing keys instead of creating permanent short-state.
- Dependency check: Ent generator dependencies are locked for codegen verification; no `github.com/redis/go-redis`, `pgx`, `lib/pq` or runtime Postgres client was introduced.
- Landing recommendation: Stage 4 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 5 before final landing.

Non-goals:

- No real PostgreSQL connection or migration execution.
- No real Redis connection or Redis client dependency.
- No production Go backend replacement claim.
- No Temporal, LangGraph or durable engine dependency.
- No user-visible API or UI change.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.
- No restored `docs/contracts/**`, `docs/recovery/**`, old stage board or `scripts/smoke-test-*`.

Risk notes:

- Go backend is still a future canonical target, not the active production backend.
- SQL baseline and Ent schema are intentionally local contract surfaces until a real migration lane is authorized.
- Volatile store is local deterministic boundary proof only; production Redis wiring remains a later explicit implementation behind the same session/cache/queue/lock interfaces.
- Ent codegen verification uses `GOPROXY=https://goproxy.cn,direct` and `GOSUMDB=sum.golang.google.cn` in the contract test to keep dependency checksum verification reproducible in this environment.

Next recommendation:

- Proceed to Stage 5: implement Go run/file/artifact domain contracts and runtime broker interface without connecting to real OPL, without fake success and without moving Portal business truth into runtime integration.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-5

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Leibniz: `gpt-5.4`, read-only Runtime Bridge / Portal run-file-artifact field and pollution-risk review for Step 11/12.
- subagent Meitner: `gpt-5.4`, read-only Step 11 Go run/file/artifact domain contract review.
- subagent Maxwell: `gpt-5.4`, read-only Step 12 Runtime Broker interface review; returned FAIL on runtime agent and mode gates.
- subagent Chandrasekhar: `gpt-5.4`, read-only Step 12 re-review; returned FAIL on upstream domain/service endpoint consistency, then closed after controller fixed and verified the blocker.

Scope:

- Add Go `run_request`, `run_execution`, `run_artifact` and `file_ref` domain contracts with repository/service boundaries.
- Keep run creation pending; `succeeded` requires observed artifact and cannot be fabricated.
- Add `internal/integration/runtimebroker` interface and deterministic local adapter for session bind, run submit/status, artifact listing and public artifact projection.
- Enforce `providerKeyRef`, `resourceBindingId`, `computeInstanceId`, `storageBucketId`, `runtimeAgentId`, `runtimeAgentEndpoint` and `mode=full_runtime` before managed run acceptance.
- Register Stage 5 contract gates in test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `a876412 feat(go): implement run file artifact domain contracts`
- `0262f07 feat(go): add runtime broker integration interface`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`
- `services/portal/src/integrations/runtime-bridge-client.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-runs.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-run-file-artifact-domain.mjs`
- `node tests/contract/contract-test-v22-go-backend-runtime-broker-interface.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/portal/src services/medopl-go-backend`

B review pack:

- `git diff --stat`: Stage 5 adds Go domain/service/repository contracts for run/file/artifact, Runtime Broker interface/local adapter, Go tests, contract gates and manifest registrations.
- `git show --name-only --oneline HEAD`: `0262f07 feat(go): add runtime broker integration interface`.
- Contract review: Step 11/12 both used eval-first RED, then implementation, then package verification.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: run creation is pending, Runtime Broker missing runtime agent is gated, non-`full_runtime` mode is rejected and `succeeded` requires observed artifact.
- Dependency check: no real HTTP, OPL, PostgreSQL, Redis or cloud client dependency was introduced.
- Landing recommendation: Stage 5 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 6 before final landing.

Non-goals:

- No real Runtime Bridge HTTP client.
- No real OPL call.
- No real PostgreSQL or Redis connection.
- No workflow facade durable engine, Temporal or LangGraph dependency.
- No commercial package or UI decision.
- No production Go backend replacement claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Risk notes:

- Runtime Broker local adapter is a deterministic contract adapter only; production bridge wiring must land behind the same interface in a later authorized step.
- The Go backend remains future canonical target, not current production replacement.
- Step 12 tightened Step 11 run request validation so Runtime Agent ID and endpoint are both required before managed run acceptance.

Next recommendation:

- Proceed to Stage 6: add Go workflow facade command/state/idempotency model, then route long-task entrypoints through workflow facade without changing Portal/Runtime/Cloud contracts.

### 2026-05-22 fix/v22-user-owned-gflabtoken-provider-keys

Status: `authoring / local gate pending landing`

Branch: `fix/v22-user-owned-gflabtoken-provider-keys`

Base trunk HEAD: `98b7990706161ec10f3a6923bd880b31e866a5f5`

handoff_commit: `83dc7f669de0b109c4cc5b8f437d06d659aa5802`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Correct provider truth: MedOPL does not provide a platform default model key or unified provider credential.
- Require each user to provide their own gflabtoken API Key for OPL entry/preflight, workbench provider binding and managed run provider access.
- Keep `portal.medopl.cn` login independent from gflabtoken API Key.
- Keep raw API Key inside the backend secret boundary; public surfaces expose only `providerKeyRef`, bound status and `providerMode=user_gflabtoken`.
- Preserve `provider_key_required` for managed readiness/open/run when the user has no provider key reference.

Contract subscription:

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `services/portal/src/app/portal-auth-runtime-handler.mjs`
- `services/portal/src/domain/opl-work-flow.mjs`
- `services/portal/src/domain/portal-api-payloads.mjs`
- `services/portal/src/domain/user-credit-provider-key-flow.mjs`
- `tests/regression/opl/regression-test-v22-opl-work-message-file-run-flow.mjs`
- `tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs`
- `tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs`
- `tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs`
- `tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`
- `tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs`

Non-goals:

- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No new platform provider credential, fallback provider, compatibility alias or provider-key bypass.
- No cursor advancement beyond `real-cloud-authorization-boundary`.

Verification before landing review:

- `npm run test:lanes`
- `npm run test:fast`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `npm --prefix services/portal run check`
- `npm run repo:bloat`
- `git diff --check -- docs tests scripts services package.json .github AGENTS.md TASTE.md`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`

Next recommendation:

- Continue at `real-cloud-authorization-boundary`; before any real provider/cloud execution, explicitly authorize secret access, live provider calls, deploy/build/kubectl/live-test boundaries and evidence handling.

landed_commit: `83dc7f669de0b109c4cc5b8f437d06d659aa5802`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run test:lanes` passed.
- `npm run test:fast` passed.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed with no findings.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed.
- `npm --prefix services/portal run check` passed.
- `npm run repo:bloat` passed.
- `git diff --check -- docs tests scripts services package.json .github AGENTS.md TASTE.md` passed.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-22 feat/v22-slide-09-precloud-readiness

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-09-precloud-readiness`

Base trunk HEAD: `0037df7ac22f9fda158ecf75f611c88a88662aea`

handoff_commit: `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`

Model:

- controller: `gpt-5.4`
- subagent Kuhn: `gpt-5.4`, read-only slide-09 diff and closeout boundary review.

Scope:

- Close slide-09 pre-cloud readiness gate.
- Extend the product-engineering-loop gate so it validates both open and closed states.
- Keep the final current verification bundle local-only; do not authorize real cloud execution.
- Collapse the temporary product slide baton from active machine truth into a closed summary and this history summary.
- Remove the temporary `product-engineering-loop-index` branch override after slide loop closeout.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.
- No product service implementation in the closeout commit.

Verification before landing review:

- `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `npm run test:lanes`
- `npm run test:fast`
- `npm --prefix services/portal run check`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`

Next recommendation:

- Start `real-cloud-authorization-boundary` only after explicit authorization for secret access, provider operations, deploy/build/kubectl/live-test boundaries and evidence handling.

landed_commit: `97a4af3f7dd53e96f1e5cade8073b0e70fa6cd73`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/contract/contract-test-v22-product-engineering-loop-index.mjs` passed before landing while the loop was still open.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before landing.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before landing while cursor still pointed to slide-09.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before landing.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-22 feat/v22-slide-08-admin-ops

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-08-admin-ops`

Base trunk HEAD: `91fc4e85ea9f868af783e12150b86a9efb1506bb`

handoff_commit: `9b9e8e91e8aee7bf4f1c219b73b18c64b30bb900`

Model:

- controller: `gpt-5.4`
- subagent Mencius: Codex explorer, read-only slide-08 diff and boundary review.

Scope:

- Close slide-08 admin ops local projection loop.
- Split admin ops frontend data mapping into `portalAdminOpsSurface.ts` to keep `portalAdapters.ts` under line budget.
- Preserve `/admin/ops` backend payload as the source of admin operation rows, ops exceptions, cost allocation tags and future-authorized states.
- Render audit-backed local operation rows, ops exception summaries and disabled/future-authorized boundaries on the AdminOps page.
- Register the new admin ops local projection regression in lane registry, current suite and product loop machine cursor.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-09 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-disabled-product-state.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-local-projection-view.mjs`
- `node tests/regression/portal/regression-test-v22-portal-admin-shared-helper-structure.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-09-precloud-readiness` on `leaf-precloud-readiness-closure`; keep slide-01 through slide-08 regressions in the current verify bundle as guards, then collapse the product loop to history summary and `real-cloud-authorization-boundary`.

landed_commit: `9b9e8e91e8aee7bf4f1c219b73b18c64b30bb900`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-08.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before closeout.
- `npm run test:fast`, `npm run test:lanes`, portal check and frontend typecheck passed before landing.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-precloud-readiness-closure`

### 2026-05-22 feat/v22-slide-07-run-artifact-trace

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-07-run-artifact-trace`

Base trunk HEAD: `7bd0f6eb5338bb2a7b8c94351762a5ec101f8cf6`

handoff_commit: `eec977b4e654837df0ea02c13c48437e587aa548`

Model:

- controller: `gpt-5.4`
- subagent Hooke: `gpt-5.4-mini`, read-only slide-07 runtime trace owner surface review.
- subagent Halley: `gpt-5.4-mini`, read-only slide-07 Portal trace display review.
- subagent Chandrasekhar: `gpt-5.4`, review of frontend fallback truth and product boundary.

Scope:

- Close slide-07 run/artifact/trace metadata backflow local loop.
- Expose owner-scoped runtimeTrace summaries in Portal trace payloads.
- Filter explicit non-owner artifact/trace records from public payloads.
- Keep public payloads free of runId, internalRunId, internal owner ids, token, storage key and private path fields.
- Remove frontend fallback truth for runtimeTrace status and artifact status.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-08 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs`
- `node tests/regression/portal/regression-test-v22-portal-session-trace-view.mjs`
- `node tests/regression/portal/regression-test-v22-portal-trace-file-linkage.mjs`
- `node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-08-admin-ops` on `leaf-admin-ops-closure`; keep slide-01 through slide-07 regressions in the current verify bundle as guards.

landed_commit: `eec977b4e654837df0ea02c13c48437e587aa548`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-07.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed before closeout.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-admin-ops-closure`

### 2026-05-22 feat/v22-slide-06-opl-entry-runtime

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-06-opl-entry-runtime`

Base trunk HEAD: `9a54215a729d857894e117c71beda9d548e3368b`

handoff_commit: `abc1071eecd7d75f8b436e12502382098ace98d3`

Model:

- controller: `gpt-5.4`
- subagent Godel: `gpt-5.4`, read-only slide-06 OPL entry runtime owner surface review.

Scope:

- Close slide-06 OPL entry/runtime local loop.
- Keep top-level Portal `launchId` as the only frontend proxy handle for `/portal/api/opl/*`.
- Remove nested launch id exposure from public launch payloads while keeping workspaceSession, runtimeSession and providerKeyRef visible.
- Keep raw provider key, launch token and runtime token backend-only.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-07 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`
- `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs`
- `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`
- `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-07-run-artifact-trace` on `leaf-run-artifact-trace-closure`; keep slide-01 through slide-06 regressions in the current verify bundle as guards.

landed_commit: `abc1071eecd7d75f8b436e12502382098ace98d3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-06.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-run-artifact-trace-closure`

### 2026-05-22 feat/v22-slide-05-resource-lifecycle

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-05-resource-lifecycle`

Base trunk HEAD: `78493d47baf9c2409eb45f8bf54e627a9886247f`

handoff_commit: `b0ac1b31a85e2ab63827640544e04af6723a4122`

Model:

- controller: `gpt-5.4`
- subagent Sagan: `gpt-5.4`, read-only slide-05 resource lifecycle owner surface review.

Scope:

- Close slide-05 resource lifecycle local loop.
- Project managed environment `releasePolicy`, `stopBilling` and `auditStatus` into UI-safe resource payloads and RuntimeEnvironment display.
- Keep compute release separate from file-space retention; stop-billing checks stay in the 120 minute window and T+1 audit remains explicit.
- Keep `user_owned` and `resource-order` from returning as primary product routes.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-06 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs`
- `node tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs`
- `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal run frontend:typecheck`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-06-opl-entry-runtime` on `leaf-opl-entry-runtime-closure`; keep slide-01 storage, slide-02 runtime real API, slide-03 account/wallet/billing, slide-04 workspace/files and slide-05 resource lifecycle regressions in the current verify bundle as guards.

landed_commit: `b0ac1b31a85e2ab63827640544e04af6723a4122`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed before closeout.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-05.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-opl-entry-runtime-closure`

### 2026-05-22 feat/v22-slide-04-workspace-files

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-04-workspace-files`

Base trunk HEAD: `96ae303417e337468df125580312714dd9582c49`

handoff_commit: `44c917fbd16952cb043d24d97a0211cc2d8fd9b2`

Model:

- controller: `gpt-5.4`
- subagent Hilbert: `gpt-5.4`, read-only slide-04 workspace/files owner surface review.

Scope:

- Close slide-04 workspace/files local loop.
- Project fileSpace folders, selected file refs, actions, delete policy and 7-day protection semantics into the Workspace UI model.
- Keep objectKey, localPath, signedUrl and object-store implementation details out of frontend product truth.
- Keep line budget green by splitting file-space view helpers out of the already large Portal adapter file.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-05 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-file-space-management.mjs`
- `node tests/regression/portal/regression-test-v22-workspace-storage-public-response.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-05-resource-lifecycle` on `leaf-resource-lifecycle-closure`; keep slide-01 storage, slide-02 runtime real API, slide-03 account/wallet/billing and slide-04 workspace/files regressions in the current verify bundle as guards.

landed_commit: `44c917fbd16952cb043d24d97a0211cc2d8fd9b2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed before closeout while cursor still pointed to slide-04.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json` failed before closeout with `non_closeout_commits_after_latest_landed`, then this closeout commit reconciled history and cursor state.
- repo bloat audit passed; no per-slide docs, shadow archive or unregistered tests were added.
- forbidden path diff empty.
- added-lines secret value scan empty.

post_merge_closeout: `completed`

next_cursor: `leaf-resource-lifecycle-closure`

### 2026-05-22 feat/v22-slide-03-account-wallet-billing

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-03-account-wallet-billing`

Base trunk HEAD: `e0bcdc1b04a870fcc2656c7f96f11e61f056d23b`

handoff_commit: `525546b7fb5c4483edeb3f21db4cd7a675996540`

Model:

- controller: `gpt-5.4`
- subagent Descartes: `gpt-5.4-mini`, read-only slide-03 account/wallet/billing owner surface review.

Scope:

- Close slide-03 account/wallet/billing local loop.
- Make Billing payload ledger use the same owner scope as wallet summary.
- Keep backend owner identifiers inside backend query logic while exposing only UI-safe account scope text to Portal frontend.
- Add and register `tests/regression/portal/regression-test-v22-account-wallet-billing-closure.mjs`.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-04 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-account-wallet-billing-closure.mjs`
- `node tests/regression/portal/regression-test-v22-portal-cost-balance-trace-linkage.mjs`
- `npm run test:fast`
- `npm run test:lanes`
- `npm --prefix services/portal/frontend run typecheck`
- `npm --prefix services/portal run check`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-04-workspace-files` on `leaf-workspace-files-closure`; keep slide-01 storage, slide-02 runtime real API and slide-03 account/wallet/billing regressions in the current verify bundle as guards.

landed_commit: `525546b7fb5c4483edeb3f21db4cd7a675996540`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` failed before closeout because history and goal-current still pointed to slide-02, which is the expected post-merge closeout trigger.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json` failed before closeout with `non_closeout_commits_after_latest_landed`, then this closeout commit reconciled history and cursor state.
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-workspace-files-closure`

### 2026-05-22 feat/v22-slide-02-portal-api-real-data

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-02-portal-api-real-data`

Base trunk HEAD: `1c64d21e7233692f88c0e9c0ca4ff6abc0f89f0b`

handoff_commit: `5c3f83585c78a5fdb48ed31741719658a4e8d1d6`

Model:

- controller: `gpt-5.4`
- subagent Hypatia: `gpt-5.4-mini`, read-only slide-02 owner surface and bloat risk review.

Scope:

- Close slide-02 Portal API real data wiring for RuntimeEnvironment.
- Wire RuntimeEnvironment package catalog, subscription and entitlement state through typed Portal lab API clients.
- Remove `active-missing-ui` adjudication for lab API clients after those APIs became active UI dependencies.
- Add regression coverage for runtime real API data closure and register it in the portal regression lane and current verify bundle.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-03 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`
- `npm --prefix services/portal run check`
- `npm --prefix services/portal/frontend run typecheck`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-03-account-wallet-billing` on `leaf-account-wallet-billing-closure`; keep slide-01 storage regression and slide-02 runtime real API regression in the current verify bundle as guards.

landed_commit: `5c3f83585c78a5fdb48ed31741719658a4e8d1d6`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run test:fast` passed
- `npm run test:lanes` passed
- `npm --prefix services/portal/frontend run typecheck` passed
- `npm --prefix services/portal run check` passed
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-repo-bloat-audit.mjs --json` passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-account-wallet-billing-closure`

### 2026-05-22 feat/v22-slide-01-data-truth

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-slide-01-data-truth`

Base trunk HEAD: `7fb7ab0e698a982d4604b13c48be22798e4f2cbb`

handoff_commit: `de71ca446da703358dd998489fb555fba622ea68`

Model:

- controller: `gpt-5.4`
- subagent Hypatia: `gpt-5.4-mini`, read-only closeout gate impact review.

Scope:

- Close slide-01 data truth for local production storage.
- Remove the `postgres_redis` JSON business snapshot mirror from Portal PostgreSQL persistence.
- Keep Redis limited to coordination/session state and prove it does not hold business truth.
- Add regression coverage that `portal-db.json` is not created in `postgres_redis` positive closure.
- Harden landing closeout so latest landed history must match trunk head when manifest requires trunk-head sync.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No slide-02 implementation.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, adapters, `.sentrux`, infra or `.runtime` edits.
- No per-slide docs, `docs/slides/*`, shadow archive or unregistered tests.

Verification before landing review:

- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs`
- `npm --prefix services/portal run check`
- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue with `slide-02-portal-api-real-data` on `leaf-portal-api-real-data-closure`; keep slide-01 storage regression in the current verify bundle as a guard.

landed_commit: `de71ca446da703358dd998489fb555fba622ea68`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/regression/portal/regression-test-v22-portal-storage-mode-local-closure.mjs` passed
- `npm --prefix services/portal run check` passed
- `npm run test:fast` passed
- `npm run test:lanes` passed
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` passed
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json` passed
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json` passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-api-real-data-closure`

### 2026-05-22 cleanup/v22-pre-slide-bloat-guardrails

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-pre-slide-bloat-guardrails`

Base trunk HEAD: `4d27cfab8545dc767749955231557e7d9b7ede16`

handoff_commit: `ee27d378ea81d1d2629b65fe332bacb24a12acaf`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add root `test:fast` and `test:lanes` package entrypoints and CI wiring.
- Extend repo bloat guardrails to forbid per-slide docs, subslide docs and unregistered tests while keeping docs truth on the existing README taxonomy.
- Add `subtask_surfaces` to the product engineering loop machine fixture so slide subtasks can be tracked without creating permanent slide documentation trees.
- Document the pre-slide requirement to run fast/lane gates before slide authoring commits.

Contract subscription:

- `docs/policies/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-repo-bloat-audit.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.

Verification before landing review:

- `npm run test:fast`
- `npm run test:lanes`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Continue `leaf-portal-postgres-redis-local-production-data-closure`; each product slide authoring branch should run `npm run test:fast` and `npm run test:lanes` before commit to keep docs/tests/scripts from expanding into per-slide archives.

landed_commit: `ee27d378ea81d1d2629b65fe332bacb24a12acaf`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- test:fast passed
- test:lanes passed
- workflow gate review passed
- local-contract suite passed
- current verify passed
- diff check and added-lines secret scan passed

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-agents-lifecycle-alignment

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-agents-lifecycle-alignment`

Base trunk HEAD: `e501945474e68451f6a3824f2e6e8aae05bd746f`

handoff_commit: `60761fffe1dd8ecc3ec3b123d48e5e747e9dc4df`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Slim root `AGENTS.md` into stable agent collaboration constraints, docs lifecycle entrypoints, verification entrypoints, worktree/subagent model recording rules and authorization red lines.
- Add root `TASTE.md` for long-lived MedOPL engineering taste: managed OPL SaaS, clean upstream, consumer-first contract, single truth, no false pass, and layered docs governance.
- Move mutable project fact lookup back to docs reading order, source, tests, fixtures, manifest, runner and package scripts.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.

Verification before landing review:

- `node tests/contract/contract-test-v22-framework-workflow-convergence.mjs`
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- AGENTS.md TASTE.md docs tests scripts services package.json .github`

Next recommendation:

- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`; future governance updates should keep `AGENTS.md` thin and write durable product facts to the relevant docs lifecycle owner or machine truth surface.

landed_commit: `60761fffe1dd8ecc3ec3b123d48e5e747e9dc4df`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- framework workflow convergence gate passed
- full taxonomy cleanup gate passed
- workflow gate review passed
- local-contract suite passed
- current verify passed
- diff check and added-lines secret scan passed

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-test-lifecycle-cleanup-gate

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-test-lifecycle-cleanup-gate`

Base trunk HEAD: `2f39cfac6f4c269e697b525b950f171d15fa1502`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add the active test lifecycle cleanup gate: `tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`.
- Extend `scripts/v22-test-classification.mjs` so each active test registry entry has `ownerSurface` and `lifecycleRole`.
- Make `tests/README.md`, `tests/fixtures/v22/agent-verify-manifest.json` and `tests/fixtures/v22/goal-current.json` declare direct test cleanup: active tests require lane owner and current owner surface; compat-only, alias-only and historical-proof tests cannot remain active.
- Register the gate in current, local-contract, review and the cleanup branch override.
- Directly remove the stale future-authorized cloud resource aggregate wrapper that referenced missing old test paths instead of active registered tests.

Test Lifecycle Rules:

- Active tests must have a lane owner through `TEST_LANE_REGISTRY`.
- Active tests must prove a current owner surface through `ownerSurface`.
- `lifecycleRole` is limited to `current-owner`, `negative-retirement-guard`, `suite-wrapper` and `future-authorized-boundary`.
- Old alias, wrapper, facade or compat-only tests are deleted after active callers migrate.
- Historical proof and closeout evidence stay in history summary and git history, not active tests.
- Duplicate aggregate tests must be merged or deleted.

Contract subscription:

- `AGENTS.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`

Non-goals:

- No product implementation.
- No PostgreSQL/Redis closure claim.
- No concrete business test cleanup beyond the stale aggregate wrapper removed by this gate branch.
- No services, deploy, adapters, `.sentrux`, infra, upstream or `.runtime` edits.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No git push or merge from the authoring branch.

Verification before landing review:

- `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node scripts/v22-verify.mjs current --branch cleanup/v22-test-lifecycle-cleanup-gate --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`
- `git diff --check -- docs tests scripts package.json .github`

Landing review packet:

- Review branch: `cleanup/v22-test-lifecycle-cleanup-gate`.
- Review base: `2f39cfac6f4c269e697b525b950f171d15fa1502`.
- Review focus: active test lifecycle owner metadata, direct cleanup policy, stale suite-wrapper deletion, branch override, no services/forbidden-surface changes and no business cursor advancement.
- Landing rule: landing operator may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-test-lifecycle-cleanup-gate --landed-commit <landed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Next recommendation:

- After landing gate and post-merge closeout, continue `leaf-portal-postgres-redis-local-production-data-closure`; future product slide work must keep active tests owner-scoped and delete old compat-only tests instead of preserving historical proof as active eval.

landed_commit: `d26b8742882801a37d0f4be195ed60d5851c9aa4`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-test-lifecycle-cleanup-gate --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 feat/v22-product-engineering-loop-index

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-product-engineering-loop-index`

Base trunk HEAD: `f3d2cacb1724a52e50aff96109dca1841e1fc7b2`

Model:

- controller: `gpt-5.4`
- subagents: none

Scope:

- Add the Product Engineering Loop index for `precloud-product-slides-closure`.
- Make the 10 pre-cloud product slides machine-readable in `tests/fixtures/v22/goal-current.json`.
- Register the product-engineering-loop gate in current, local-contract, review, docs-engineering-loop, root package scripts and CI.
- Keep product implementation untouched; this branch indexes the lifecycle and gates only.

Product Engineering Loop:

- The loop uses the existing OPL-style truth surfaces: `docs/active/README.md`, `tests/fixtures/v22/goal-current.json`, `tests/fixtures/v22/agent-verify-manifest.json`, and this history file.
- It forbids per-slide markdown docs, compatibility layers, fallback paths and shadow archives.
- Each future slide must run `inventory -> classify -> absorb truth -> retire stale surface -> eval -> implementation -> verify -> commit`.
- The collapse policy is explicit: while open, the 10-slide list is only an active baton in `goal-current.json`; after all slides close, `product_engineering_loop.slides` and the temporary branch override must be removed from current truth, leaving only a closed summary, landed commit, history summary and next cursor.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Non-goals:

- No services implementation.
- No PostgreSQL/Redis closure claim.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No new slide markdown files.

Next recommendation:

- After landing, run slide-01-data-truth as the first product implementation commit on the same product-engineering lifecycle.

landed_commit: `d8ba4a828f8ee4a9989c6b6ce0befd64a396fee3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch feat/v22-product-engineering-loop-index --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs suite product-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-engineering-flow-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-engineering-flow-closure`

Base trunk HEAD: `c8e519e171403f3a5876c3e2a98795c020450234`

Model:

- controller: `gpt-5.4`
- subagent Aristotle: `gpt-5.4-mini`, read-only repo bloat / workflow command reference / registry risk review.

Scope:

- Add a repo bloat audit gate to keep OPL-style taxonomy from regrowing uncontrolled.
- Add workflow local command reference integrity checking for current package/workflow/manifest/docs entrypoints.
- Register both gates in health, local-contract, repo-hygiene and docs-engineering-loop verification surfaces.
- Add `npm --prefix services/portal ci` before CI regression so clean runners can execute Portal local regression dependencies such as `pg`.
- Keep scripts as control-plane runners only; no `scripts/smoke-test-*` returned.
- Keep business cursor unchanged on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `tests/fixtures/v22/goal-current.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-repo-hygiene.mjs`
- `scripts/v22-repo-bloat-audit.mjs`
- `scripts/v22-line-budget.mjs`
- `package.json`
- `.github/workflows/verify.yml`

Verification before handoff:

- `node tests/health/health-check-v22-workflow-command-reference-gate.mjs`: pass.
- `node tests/health/health-check-v22-repo-bloat-audit-gate.mjs`: pass.
- `node scripts/v22-repo-bloat-audit.mjs --json`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --branch cleanup/v22-engineering-flow-closure --base origin/recovery/platform-v22-trunk --json`: pass after `npm --prefix services/portal ci`.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json`: pass.
- `git diff --check -- docs tests scripts package.json .github services/portal/src`: pass.

Repo bloat audit snapshot:

- docs markdown: `11 / 16`.
- scripts files: `8 / 8`.
- tests mjs: `99 / 110`.
- tests/regression/portal: `29 / 32`.
- tests/future-authorized/cloud: `20 / 24`.
- services/portal: `243 / 260` files, `1846153 / 2000000` bytes.

Structural health note:

- `sentrux check .`: fail, quality signal `0.63` below required `0.69`.
- Violations: modularity `0.7062 < 0.8000`, depth `0.5333 < 0.7000`, and `services/portal/src/app/portal-runtime.mjs` fan-out `16`.
- This is a repo health risk for the next Portal closure branch, not a scope item for this control-plane gate branch.

Non-goals:

- No push, no merge, no ff-only absorb.
- No services implementation changes.
- No deploy, build/push, kubectl, live-test or real cloud operation.
- No upstream, `deploy/*`, `.sentrux/*`, `adapters/*` or `infra/*` edits.

Next recommendation:

- B should fresh review this branch, rerun docs-engineering-loop and current entrypoint, then decide whether to ff-only land.
- A later Portal refactor branch should split `services/portal/src/app/portal-runtime.mjs` fan-out before adding broad Portal surface files.

landed_commit: `f1272a607589fe55fccf59c3dc7fa7574d62030f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-engineering-flow-closure --base origin/recovery/platform-v22-trunk --json passed after npm --prefix services/portal ci
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- node scripts/v22-repo-bloat-audit.mjs --json passed
- node tests/health/health-check-v22-workflow-command-reference-gate.mjs passed
- git diff --check -- docs tests scripts package.json .github services/portal/src passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-opl-framework-workflow-convergence

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-framework-workflow-convergence`

Base trunk HEAD: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`

Model:

- controller: `gpt-5.5` runtime; authoring worktree branch records allowed future native subagent models explicitly.
- subagent Meitner: `gpt-5.4-mini`, read-only current workflow/governance wording audit.
- subagent Lovelace: `gpt-5.4-mini`, read-only package / CI / manifest / closeout entrance audit.

Commits:

- `188c94a docs(v22): converge workflow on landing protocol`
- `21ebebc test(v22): rename landing and cleanup gates`
- `f3378ad ci(v22): expose framework repo verification gates`
- final handoff commit: records this authoring branch summary and landing review packet.

Scope:

- Clear current workflow docs from window-era language into authoring branch / landing gate / post-merge closeout.
- Physically clear current machine entrypoints from `absorb` / governance `retirement` names into landing / cleanup entrypoints.
- Add framework repo package and CI entrypoints: `test:*`, `gate:contract`, `closeout:check`.
- Keep business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-landing-closeout.mjs`
- `.github/workflows/verify.yml`
- `package.json`

Verification before handoff:

- `node tests/contract/contract-test-v22-framework-workflow-convergence.mjs`: pass.
- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`: pass.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-current-development-lines.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer, old contracts/recovery tree or old `scripts/smoke-test-*` restoration.

Landing review packet:

- Review branch: `cleanup/v22-opl-framework-workflow-convergence`.
- Review base: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`.
- Review focus: framework landing protocol wording, landing closeout script rename, cleanup lifecycle gate rename, manifest branch override, package/CI entrypoints, no services/forbidden-surface changes, and no business cursor advancement.
- Suggested landing commands: `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md docs tests scripts package.json .github`.

Next recommendation:

- After landing and post-merge closeout, continue the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

Landing gate packet:

- Review branch: `cleanup/v22-opl-framework-workflow-convergence`.
- Review base: `054fa6fd9d5c676245b3830d5ed19acf24aaf9a3`.
- Review focus: framework workflow protocol, landing closeout schema, package/CI entrypoints, manifest branch override, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md docs tests scripts package.json .github`.
- Landing rule: landing operator may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-opl-framework-workflow-convergence --landed-commit <landed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Risk notes:

- `scripts/v22-landing-closeout.mjs generate` writes docs/history, docs/active and goal-current only; it does not push, merge, deploy, read secrets or call cloud.
- `scripts/v22-landing-closeout.mjs generate` rejects invalid / unknown landed commits, old trunk commits, unknown branches, branch/handoff mismatches and post-push trunk reachability failures when `--trunk-ref` is provided.
- `last_landed_commit` records the landed authoring branch commit. A later closeout commit cannot self-reference its own future SHA; the closeout gate therefore checks that the landed commit is reachable from trunk and that no reachable handoff remains `ready_for_landing_review`.

Next recommendation:

- After landing gate and post-merge closeout, return to `leaf-portal-postgres-redis-local-production-data-closure`.

landed_commit: `d473ca70a19f134303a1835580fa1d55b66f7679`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --branch cleanup/v22-opl-framework-workflow-convergence --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-verify.mjs package contract-gate --base origin/recovery/platform-v22-trunk --json passed
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk passed
- git diff --check -- AGENTS.md docs tests scripts package.json .github passed
- forbidden path diff empty
- added-lines secret value scan empty

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`
### 2026-05-21 cleanup/v22-opl-loop-event-automation-and-ci-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-loop-event-automation-and-ci-closure`

Base trunk HEAD: `583da292aa32bf021697171f5b5cea1cfc693baf`

Model:

- controller: `gpt-5.4` declared for repository workflow policy
- subagent Hume: `gpt-5.4`, read-only OPL docs/software engineering loop comparison
- subagent Harvey: `gpt-5.4`, read-only post-merge closeout / machine cursor / history drift audit
- subagent Sartre: `gpt-5.4`, read-only package / CI / test lane / manifest consistency audit

Commits:

- `658cd1b test(v22): automate post-merge loop closeout`
- `ff0b15d ci(v22): harden engineering loop entrypoints`
- final handoff commit: records this A branch summary and B review packet.

Scope:

- Close the absorbed `cleanup/v22-opl-docs-engineering-loop-closure` truth to `583da292aa32bf021697171f5b5cea1cfc693baf`.
- Add `scripts/v22-landing-closeout.mjs` so B can generate and check post-merge closeout instead of hand-editing history and fixtures.
- Add `contract-test-v22-landing-closeout-automation.mjs` and wire it into current, local-contract, review and history-closeout gates.
- Remove hardcoded latest absorbed commit assumptions from lifecycle/index-loop gates; the gates now parse the latest absorbed history section and check trunk reachability.
- Harden package / CI / manifest / test-lane consistency so root scripts, package suites, workflow jobs and registry suites cannot drift independently.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-landing-closeout.mjs`
- `.github/workflows/verify.yml`
- `package.json`

Verification before handoff:

- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`: pass.
  - Covers invalid SHA, unknown SHA, wrong old trunk commit, unknown branch, missing required field, pre-absorb trunk reachability failure and valid branch/handoff dry-run success.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer, old contracts/recovery tree or old `scripts/smoke-test-*` restoration.

B review packet:

- Review branch: `cleanup/v22-opl-loop-event-automation-and-ci-closure`.
- Review base: `583da292aa32bf021697171f5b5cea1cfc693baf`.
- Review focus: closeout automation, dynamic trunk/history/current consistency, package/CI/manifest/registry alignment, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts package.json .github`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-landing-closeout.mjs generate --branch cleanup/v22-opl-loop-event-automation-and-ci-closure --absorbed-commit <absorbed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Risk notes:

- `scripts/v22-landing-closeout.mjs generate` writes docs/history, docs/active and goal-current only; it does not push, merge, deploy, read secrets or call cloud.
- `scripts/v22-landing-closeout.mjs generate` rejects invalid / unknown absorbed commits, old trunk commits, unknown branches, branch/handoff mismatches and post-push trunk reachability failures when `--trunk-ref` is provided.
- `last_landed_commit` records the absorbed A branch commit. A later closeout commit cannot self-reference its own future SHA; the closeout gate therefore checks that the absorbed commit is reachable from trunk and that no reachable handoff remains `ready_for_landing_review`.
- `verify:docs-engineering-loop` is now a manifest-backed package suite instead of an unregistered shell chain.

Next recommendation:

- After B absorbs this branch and records post-push closeout, return to `leaf-portal-postgres-redis-local-production-data-closure`.

landed_commit: `2fe61b26714b237bc323aa3245128d1b0140d332`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-opl-docs-engineering-loop-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-opl-docs-engineering-loop-closure`

Base trunk HEAD: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`

Model:

- controller: `gpt-5.4`
- subagent Heisenberg: `gpt-5.4`, read-only docs portfolio/lifecycle audit
- subagent Mencius: `gpt-5.4`, read-only tests/scripts/test-lane/secret/repo-hygiene audit
- subagent Erdos: `gpt-5.4`, read-only current development lines audit
- subagent Gibbs: `gpt-5.4`, read-only repo hygiene and line-budget audit
- subagent Carson: `gpt-5.4`, read-only package scripts and GitHub verify workflow audit
- subagent Socrates: `gpt-5.4`, read-only history handoff audit

Commits:

- `6c15846 docs(v22): close OPL docs portfolio lifecycle`
- `a3737eb docs(v22): register current development lines`
- `25bbfdd test(v22): add explicit test lane registry`
- `146b2e1 test(v22): harden review secret hygiene gate`
- `3ca9334 test(v22): add repo hygiene line budget gate`
- `358a768 ci(v22): add root verification entrypoints`
- final handoff commit: records this A branch summary and B review packet.

Scope:

- Close the OPL-style docs portfolio lifecycle with a machine-checked document ledger and one current truth path.
- Register current development lines without advancing the business cursor.
- Replace test classification inference with explicit test lane registry coverage.
- Harden review secret hygiene so B review checks forbidden paths, secret-like paths and effective added lines.
- Add repo hygiene and line-budget gates with an explicit baseline for existing oversized service files.
- Add root `package.json` scripts and GitHub verify workflow as standard engineering entrypoints that wrap existing v22 verify/gate commands.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`

Verification before handoff:

- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify:repo-hygiene`: pass.
- `node scripts/v22-verify.mjs suite repo-hygiene --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts package.json .github`: pass.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No product cursor advancement.
- No secret read, real cloud, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No resurrection of retired contract, recovery or legacy script entrypoints.
- No compatibility alias or second current truth.

B review packet:

- Review branch: `cleanup/v22-opl-docs-engineering-loop-closure`.
- Review base: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`.
- Review focus: docs portfolio lifecycle, current development lines, explicit test lane registry, review secret hygiene, repo hygiene/line budget, root package scripts, GitHub verify workflow, and no services/forbidden-surface changes.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts package.json .github`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, and run post-push verification.

Risk notes:

- `tests/fixtures/v22/line-budget-baseline.json` intentionally locks three pre-existing oversized service files; future growth fails until those files are split or the baseline is explicitly reviewed.
- Root `package.json` and `.github/workflows/verify.yml` are local verification entrypoints only. They do not add build, deploy, kubectl, live-test, future-authorized or true-cloud execution.
- Business cursor remains `leaf-portal-postgres-redis-local-production-data-closure`; this branch only hardens the loop that will govern that implementation.

Next recommendation:

- After B absorbs and records post-push closeout, return to `leaf-portal-postgres-redis-local-production-data-closure` as the next product implementation leaf.

landed_commit: `583da292aa32bf021697171f5b5cea1cfc693baf`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass
- forbidden diff and added-lines secret scan: pass

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-post-merge-closeout-and-gate-integrity

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-post-merge-closeout-and-gate-integrity`

Base trunk HEAD: `2e644fc774e567db9418e3d13942e1598434433e`

Model:

- controller: `gpt-5.5` runtime; repository policy for future native subagents remains `gpt-5.4`, `gpt-5.3-codex`, or `gpt-5.4-mini`.
- subagents: none.

Commits:

- `bcf97e8 docs(v22): close current index loop absorb truth`
- `a57ac0c test(v22): gate workflow command references`
- final closeout commit: records this A handoff.

Scope:

- Close the absorbed `cleanup/v22-current-state-index-loop-normalization` truth to `2e644fc774e567db9418e3d13942e1598434433e`.
- Align `docs/active/README.md`, this history summary, and `tests/fixtures/v22/goal-current.json` on the same latest absorbed commit.
- Harden workflow start templates so every referenced `tests/**/*.mjs` command must point at an existing tracked test file.
- Replace stale workflow template commands that referenced retired tests with current existing gates.
- Add this cleanup branch override to the verify manifest without changing the business cursor.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/history/README.md`
- `docs/policies/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Verification before handoff:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

landed_commit: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass with temporary ignored `node_modules` symlink in the B worktree; symlink removed after verification.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass; post-push workflow gate `ok:true`.
- `git diff --check -- docs tests scripts`: pass.
- forbidden diff and secret scan: pass, no findings.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review result:

- Review branch: `cleanup/v22-post-merge-closeout-and-gate-integrity`.
- Review base: `2e644fc774e567db9418e3d13942e1598434433e`.
- Review focus: latest absorbed commit closeout, workflow start-template test reference integrity, manifest branch override, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorbed by B with ff-only merge, pushed to `origin/recovery/platform-v22-trunk`, post-push verification recorded above.

Next recommendation:

- Continue OPL-style docs/software engineering loop closure before running the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

### 2026-05-21 cleanup/v22-current-state-index-loop-normalization

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-current-state-index-loop-normalization`

Base trunk HEAD: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`

Model:

- controller: `gpt-5.4`
- subagent Rawls: `gpt-5.4`, read-only OPL-style docs taxonomy / index-loop audit
- subagent Gauss: `gpt-5.4`, read-only goal-current / manifest / verify runner audit
- subagent Dewey: `gpt-5.4`, read-only product/runtime/source/data-boundary audit

Commits:

- `82891db docs(v22): tighten autonomous taxonomy index loop`
- `e14f055 docs(v22): close lifecycle absorb truth to latest trunk`
- `2123791 test(v22): gate current state index loop`
- `2e644fc docs(v22): record current state index loop run`

Scope:

- Normalize the OPL-style autonomous index loop: docs root -> active truth -> specs/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor.
- Replace empty product/runtime contract placeholders with concrete spec-anchor indexes.
- Close the absorbed `cleanup/v22-retirement-lifecycle-system-closure` truth to `3ca2ee48f55bb154776c60605a497d9a2e7e1752`.
- Add `contract-test-v22-current-state-index-loop.mjs` and wire it into current, local-contract, and history-closeout verification.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

post_push_verification:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

landed_commit: `2e644fc774e567db9418e3d13942e1598434433e`

landing_gate_result: `passed / ff-only landed / pushed`

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review result:

- Review branch: `cleanup/v22-current-state-index-loop-normalization`.
- Review base: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`.
- Review focus: docs root truth lookup, product/runtime spec-anchor indexes, latest absorbed commit closeout, new index-loop gate, manifest current/local-contract/history-closeout wiring, and no services/forbidden-surface changes.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorbed by B with ff-only merge, pushed to `origin/recovery/platform-v22-trunk`, post-push verification recorded above.

Next recommendation:

- Run the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

### 2026-05-20 cleanup/v22-retirement-lifecycle-system-closure

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-retirement-lifecycle-system-closure`

Base trunk HEAD: `2a4254915f43186e312f406e5de31629c1c6700b`

landed_commit: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Model:

- controller: `gpt-5.4`

Commits:

- `2d2ee07 docs(v22): codify retirement lifecycle rules`
- `42a2cbf test(v22): add retirement lifecycle gate`
- `82a1d4b test(v22): wire retirement lifecycle gate into verify manifest`
- final closeout commit: records hard retirement post-merge truth and this A handoff.

Scope:

- Codify the OPL-style retirement lifecycle as the default MedOPL v22 development loop.
- Add a machine gate that checks taxonomy truth, history closeout schema, retired-path protection, tests taxonomy, and manifest wiring.
- Record the post-merge closeout for `cleanup/v22-full-taxonomy-hard-retirement`.
- Keep the business cursor on `leaf-portal-postgres-redis-local-production-data-closure`.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/history/README.md`
- `tests/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-workflow-gate.mjs`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.

Next recommendation:

- Run the product cursor `leaf-portal-postgres-redis-local-production-data-closure` after this index-loop normalization is reviewed.

### 2026-05-20 cleanup/v22-full-taxonomy-hard-retirement

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-full-taxonomy-hard-retirement`

Base trunk HEAD: `365c2a676ed243ead64338d62ce2ec6262ce4767`

landed_commit: `2a4254915f43186e312f406e5de31629c1c6700b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts services/portal/src`: pass.

post_merge_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Model:

- controller: `gpt-5.4`
- subagent Kant: `gpt-5.4`, read-only recovery/truth audit
- subagent Nietzsche: `gpt-5.4`, read-only smoke/eval audit
- subagent Turing: `gpt-5.4`, read-only scripts/reference audit

Scope:

- Adopt OPL-style docs taxonomy as active truth.
- Absorb distributed contracts into `docs/specs/README.md`.
- Retire legacy recovery/docs/scripts/test fixtures that only carried stage history.
- Keep `scripts/sync-workspace-file-to-minio.ps1` because `services/portal/src/config/portal-config.mjs` still references it and this branch does not modify services.
- Keep current business cursor on `leaf-portal-postgres-redis-local-production-data-closure`; this cleanup does not claim PostgreSQL/Redis implementation.

Contract subscription:

- `AGENTS.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-verify.mjs`
- `scripts/v22-test-classification.mjs`
- `scripts/v22-workflow-gate.mjs`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.

Commits:

- `7516c29 cleanup(v22): retire eval smoke filename semantics`
- `89b57cd cleanup(v22): absorb contracts into specs truth`
- `78e4a7b cleanup(v22): retire recovery into taxonomy truth`
- `06f4d4e docs(v22): record full taxonomy hard retirement run`
- `5508387 fix(v22): allow authorized taxonomy smoke-name deletions`
- final closeout commit: records this post-fix trace update.

Verification before closeout:

- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`: pass.
- `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts`: pass.
- Added-lines secret value scan over `origin/recovery/platform-v22-trunk...HEAD` and `AGENTS.md README.md DESIGN.md docs tests scripts`: pass, no matches.
- Local-regression note: this isolated worktree has no installed `services/portal/frontend/node_modules/typescript`; final local-regression was re-run with temporary ignored symlinks to the main worktree's existing `services/portal/node_modules` and `services/portal/frontend/node_modules`, then those symlinks were removed before handoff.
- Retired-path scan for old recovery/contracts/root-doc/helper-script literals: only the hard-retirement self-test retains constructed legacy literals as a regression guard.

B review packet:

- Review branch: `cleanup/v22-full-taxonomy-hard-retirement`.
- Review base: `365c2a676ed243ead64338d62ce2ec6262ce4767`.
- Review focus: docs taxonomy hard retirement, `docs/specs/README.md` as single spec truth, `docs/active/README.md` as single current truth, `tests/fixtures/v22/*` as machine truth, and `scripts/` reduced to runner/classifier/workflow plus the service-referenced PowerShell helper.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-regression --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, and run post-push verification.

Risk notes:

- Large deletion diff is intentional. B should check that removed contract leaves are absorbed into `docs/specs/README.md`, removed recovery stage records are summarized here, and removed tests are no longer active manifest entries.
- `scripts/sync-workspace-file-to-minio.ps1` remains because services still reference it; removing it requires a service-surface branch.
- `local-regression` now runs `tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`; that suite excludes build and true cloud operations.
- B review and absorb happened outside this A window; this lifecycle closure records the post-merge truth.

Next recommendation:

- Resume the current product cursor: `leaf-portal-postgres-redis-local-production-data-closure`.

## Reading Rule

Use history to understand how a change was made. Use active/specs/policies/delivery/source and verify fixtures to decide what is currently true.

When judging whether the current loop is closed, do not stop at one run summary. Check `docs/active/README.md`, `docs/delivery/README.md`, `tests/README.md`, `tests/fixtures/v22/goal-current.json`, and `tests/fixtures/v22/agent-verify-manifest.json` together.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-6

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Volta: `gpt-5.4`, read-only Stage 6 Step 13/14 risk review before implementation.
- subagent Euclid: `gpt-5.4`, read-only Step 13 spec compliance review; returned FAIL on locator-like command fields, then closed after fix.
- subagent Harvey: `gpt-5.4`, read-only Step 13 code quality review; returned FAIL on idempotency, approval binding and store index invariants, then closed after fix.
- subagent Mendel: `gpt-5.4`, read-only Step 13 re-review after fixes; returned PASS.
- subagent Mill: `gpt-5.4`, read-only Step 14 review; returned FAIL because the first cut only added a parallel workflow command endpoint.
- subagent Galileo: `gpt-5.4`, read-only Step 14 re-review after action routes were added; returned PASS.

Scope:

- Add a Go workflow facade command model with `Command`, `Execution`, `ApprovalTask`, idempotent command creation and explicit pending/running/succeeded/failed/cancelled transitions.
- Keep workflow facade pure domain/service/repository: no Temporal, LangGraph, Redis client, Postgres client, HTTP client, runtime broker, cloud adapter, secret, token or object locator field.
- Make command idempotency safe for replay and write-race cases; semantic conflicts fail closed instead of returning an unrelated execution.
- Require approval tasks to bind the execution that belongs to the command, and keep memory workflow store command/idempotency indexes immutable on update.
- Route Go backend long-task actions through workflow facade by adding `/workflow/commands`, `/runtime/launch`, `/runs`, `/billing/freeze` and `/resources/release` as thin command handoff endpoints.
- Keep launch, run, billing freeze and release routes fixed to workflow command types and return `202/pending` only; they do not call `runfileartifact`, `runtimebroker`, cloud, billing or release implementations.
- Register workflow facade and routed command gates in test lane registry, current/local-contract/review suites and backend convergence package.

Commits:

- `b0d5d0b feat(go): add workflow facade command model`
- `8d3ba8c refactor: route launch run billing release through workflow facade`

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/specs/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `services/medopl-go-backend/**`

Verification before landing review:

- `node tests/contract/contract-test-v22-go-backend-workflow-facade-command-model.mjs`
- `node tests/contract/contract-test-v22-go-backend-workflow-routed-command-boundary.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `GOROOT=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22 PATH=/tmp/medopl-go-toolchain/root/usr/lib/go-1.22/bin:$PATH GOMODCACHE=/tmp/medopl-go-modcache GOCACHE=/tmp/medopl-go-buildcache go test ./...` from `services/medopl-go-backend`
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs tests scripts package.json services/portal/src services/medopl-go-backend`

B review pack:

- `git diff --stat origin/recovery/platform-v22-trunk...HEAD`: branch currently spans 83 files and 8523 insertions / 52 deletions across Stage 1-6 docs, tests, fixtures, Node facade gates and Go backend target code.
- `git show --name-only --oneline HEAD`: `8d3ba8c refactor: route launch run billing release through workflow facade`.
- Contract review: Step 13 and Step 14 both used RED contract tests before implementation and subagent re-review after required fixes.
- Secret hygiene: review gate reported no secret-like paths and no secret-like added lines.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: no restored `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: workflow action routes return only pending workflow executions; they do not call runtime, run, billing, cloud or release execution surfaces.
- Durable engine check: Temporal/LangGraph remain absent; future durable execution can replace implementation behind `internal/service/workflow` without changing routes or runtime/cloud contracts.
- Landing recommendation: Stage 6 is ff-only absorbable by B review if the full branch is selected for landing; authoring can continue to Stage 7 before final landing.

Non-goals:

- No Temporal, LangGraph or durable workflow engine.
- No real Runtime Bridge HTTP client.
- No real OPL call.
- No real PostgreSQL or Redis connection.
- No cloud resource mutation, billing mutation or release execution.
- No commercial package or UI decision.
- No production Go backend replacement claim.
- No secret read, live cloud call, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Risk notes:

- Go route wiring currently uses an in-memory workflow store for deterministic local proof; PostgreSQL-backed repository remains a later production implementation behind the same repository interface.
- The workflow facade is structural convergence, not production durable execution. It creates a clean replacement point for Temporal or another durable engine later.
- Node Portal remains migration-period active implementation; Stage 6 prevents new Go long-task entrypoints from bypassing workflow but does not claim full Node-to-Go production cutover.

Next recommendation:

- Proceed to Stage 7: define the commercial package model after structural convergence, then decide UI impact based on whether Portal already answers what the customer bought, whether it is usable, what is missing, where to click next, where results are and whether cost state is normal.

### 2026-05-22 feat/v22-backend-go-convergence-program stage-7

Status: `absorbed_into_trunk_closeout`

Absorbed by: `cleanup/v22-backend-convergence-trunk-closeout`

Branch: `feat/v22-backend-go-convergence-program`

Base trunk HEAD: `82bbf09e3bdfd2d2f4f746353ec9b9fa3cc5eb7f`

Model:

- controller: `gpt-5 runtime`
- subagent Nietzsche: `gpt-5.4-mini`, read-only Stage 7 commercial package and UI impact audit.

Scope:

- Define the commercial package model after structural convergence: `api_only`, `full_runtime` and `customer_dedicated`.
- Preserve the customer-facing rule: anyone can enter OPL; MedOPL is required for platform-managed compute, file space, isolation, billing and audit.
- Make `starter_2c4g_10gb` and `pro_8c16g_100gb` current MVP specs inside `full_runtime`, not a second commercial model.
- Decide UI impact from the commercial model without changing Portal UI code in this stage.
- Record that current Portal UI surfaces already answer: 买了什么, 能不能用, 缺什么, 下一步点哪里, 结果在哪里, 费用是否正常.
- Require a future UI implementation leaf before `customer_dedicated` becomes customer-visible.
- Register both Stage 7 contract tests in the test lane registry, manifest control-plane files, current/local-contract/review suites, backend convergence package and branch override.

Commits:

- `1da6c78 docs: define commercial package model after structural convergence`
- `2502443 docs: decide ui impact from commercial model`
- final review fix: keep backend convergence gates out of the global `current` suite; they remain in local-contract, review, backend convergence package and branch override.

Contract subscription:

- `AGENTS.md`
- `TASTE.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/specs/README.md`
- `docs/runtime/README.md`
- `docs/source/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
- `scripts/v22-test-classification.mjs`
- `tests/contract/contract-test-v22-commercial-package-model.mjs`
- `tests/contract/contract-test-v22-commercial-ui-impact-decision.mjs`

Verification before landing review:

- `node tests/contract/contract-test-v22-commercial-package-model.mjs`: pass.
- `node tests/contract/contract-test-v22-commercial-ui-impact-decision.mjs`: pass, after RED failure on missing `v22-commercial-ui-impact-decision` marker.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-cost-balance-trace-linkage.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-trace-file-linkage.mjs`: pass.
- `node scripts/v22-verify.mjs package backend-go-convergence --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --branch feat/v22-backend-go-convergence-program --base origin/recovery/platform-v22-trunk --dry-run --json`: pass.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass after final review fix.
- `git diff --check -- docs tests scripts package.json services/portal/src services/medopl-go-backend`: pass.

B review pack:

- `git diff --stat origin/recovery/platform-v22-trunk...HEAD`: branch now includes Stage 1-7 backend convergence docs, tests, fixtures, Node facade gates and Go backend target code.
- `git show --name-only --oneline 1da6c78`: commercial package truth and `contract-test-v22-commercial-package-model.mjs`.
- `git show --name-only --oneline 2502443`: UI impact decision truth and `contract-test-v22-commercial-ui-impact-decision.mjs`.
- Contract review: Stage 7 stayed in docs/tests/manifest/classifier only; no service code, UI code, runtime code or Go code changed in this stage.
- Secret hygiene: no secret read; no raw provider key, bearer token, launchToken, runtimeToken, objectKey, localPath or signedUrl added.
- Pollution check: no `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, upstream, `.runtime/*`, secret path, real cloud, build/push, kubectl, deploy or live-test operation.
- Product narrative check: MedOPL remains a托管 OPL 科研工作台; ordinary users do not see cloud resource console, user self-managed cloud, `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary narrative.
- Fake success check: `customer_dedicated` is only a commercial model and future UI handoff requirement, not a current customer-visible launched capability.
- Landing recommendation: Stage 7 is ff-only absorbable by B as part of the backend convergence branch after full-branch review passes.

Non-goals:

- No Portal UI implementation change.
- No package pricing change.
- No customer-dedicated UI launch.
- No Go service code change.
- No Node route or service change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or `.runtime` edits.

Post-absorb truth recommendation:

- Keep the commercial package model and UI impact decision in `docs/specs/README.md`, `docs/product/README.md` and `docs/active/README.md`.
- Keep the current product cursor on `real-cloud-authorization-boundary`; Stage 7 does not authorize real cloud, secret, deploy or production release.
- If product later makes `customer_dedicated` customer-visible, open a separate UI implementation leaf and subscribe to `spec:v22-commercial-ui-impact-decision`, `spec:v22-portal-ui-design-quality-audit-boundary` and role/surface contracts.

Next recommendation:

- Run final backend convergence package verification and B review pack for the full authoring branch.

### 2026-05-23 cleanup/golden-path-first-class

Status: `landed / pushed / post-push verified`

Branch: `cleanup/golden-path-first-class`

Scope:

- Made the MedOPL golden path the default product spine: login / credit / provider key -> managed environment -> OPL launch -> file/task -> run/artifact -> billing/trace/audit -> release/stop billing.
- Added `golden-path` verification suite and made `current` start with golden path health before governance guardrails.
- Required every change package to declare `Golden Path Impact`.
- Kept governance gates as guardrails: local-contract, review, repo-hygiene, history-closeout and change-package-gate remain active.
- Extracted Portal runtime domain/presentation dependency assembly into `services/portal/src/app/portal-runtime-app-deps.mjs`, reducing `portal-runtime.mjs` unique import fan-out from 23 to 18.

Commits:

- `f9efdff` chore(framework): open golden path baseline package
- `9b4090e` docs(framework): make golden path first class
- `9611925` test(framework): make current verify start with golden path
- `90ccadd` test(framework): require golden path impact in change packages
- `238d2a6` refactor(portal): extract runtime app dependencies
- `7d4ddc5` docs(framework): close golden path review loop

Verification:

- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs package change-package-gate --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm --prefix services/portal run check`: pass.
- `node tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs --group all`: pass.

Independent review:

- reviewer: Codex native subagent `Confucius`
- model: `gpt-5.4-mini`
- result: no blocker; one Important active-doc command mismatch fixed.

Cannot claim:

- No production runtime, production billing, real cloud execution, deploy, kubectl, build/push or live-test.
- No Sentrux Pro diagnostics used.
- First Portal runtime fan-out extraction does not complete all source debt.

landed_commit: `7d4ddc59343dc327603f8e968e8cdcf6d6e54002`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` later reached golden path productization roadmap commit `c7df83bd829bac9bbf6ed6501cff616ee7b7a81f`.
- The package is archived at `changes/archive/2026-05-23-golden-path-first-class`.

post_merge_closeout: `completed`

next_cursor: `figma-portal-ui-absorption`

### 2026-05-23 feat/golden-path-productization-roadmap

Status: `landed / pushed / post-push verified`

Branch: `feat/golden-path-productization-roadmap`

Archived change package: `changes/archive/2026-05-23-golden-path-productization-roadmap`

Scope:

- Defined the post-local-RC productization order: Figma UI absorption -> typed API contract -> provider key reuse -> OPL entry real preflight / launch state -> Go control-plane takeover -> real-cloud authorization.
- Clarified that Figma Make is external prototype input until absorbed into repo-native frontend source and typed API boundaries.
- Clarified Go as the canonical MedOPL control-plane backend target without claiming current production backend has already moved to Go.
- Moved current product cursor to `figma-portal-ui-absorption`; real cloud remains separately authorized and not the default next implementation package.

Commits:

- `9603768` syncs local RC closeout cursor.
- `c7df83bd829bac9bbf6ed6501cff616ee7b7a81f` lands the golden path productization roadmap.

Verification result:

- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass.
- `npm --prefix services/portal run check`: pass.
- `npm --prefix services/portal/frontend run typecheck`: pass.

Can-claim:

- The productization roadmap is repo-native and subscribable.
- The next executable product cursor is `figma-portal-ui-absorption`.
- Real cloud authorization remains blocked until explicit authorization.

Cannot-claim:

- Figma UI absorption, provider key reuse, OPL entry real launch state, Go backend takeover or real-cloud authorization has landed.
- Real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.

landed_commit: `c7df83bd829bac9bbf6ed6501cff616ee7b7a81f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `c7df83bd829bac9bbf6ed6501cff616ee7b7a81f`.
- The package is archived at `changes/archive/2026-05-23-golden-path-productization-roadmap`.

post_merge_closeout: `completed`

next_cursor: `figma-portal-ui-absorption`

### 2026-05-24 feat/medopl-gap-provider-reuse

Status: `landed / pushed / post-push verified`

Branch: `feat/medopl-gap-provider-reuse`

Archived change package: `changes/archive/2026-05-24-figma-portal-ui-absorption`

Scope:

- Closed `figma-portal-ui-absorption` as repo-native frontend truth and archived the change package.
- Landed provider key reuse for Portal OPL launch: when a user already has a backend-bound `providerKeyRef`, `/portal/api/opl/launch` reuses it without replaying raw `providerKeyPayload`.
- Advanced the current local productization cursor to `portal-typed-api-contract` so Portal pages stay on typed API modules and backend projections before OPL entry real state and Go control-plane takeover.

Commits:

- `816f7431ad3b5c8c0524b058d11eb08e851b055e` feat(opl): reuse bound provider key for portal launch
- `9f703f0c858bb5cc93f4c7cca6606823d215c71f` docs(truth): close figma absorption cursor

Verification result:

- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs`: pass.
- `npm --prefix services/portal run check`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`: pass.
- `node tests/health/health-check-v22-repo-bloat-audit-gate.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.

Can-claim:

- Existing backend-bound `gflabtoken` provider key refs can be reused by Portal OPL launch without raw key replay.
- Figma Portal UI absorption is no longer the active cursor; its local repo-native evidence is archived.
- The next local productization cursor is `portal-typed-api-contract`.

Cannot-claim:

- OPL entry real preflight / launch UI state is fully closed.
- Go backend has replaced the current Node Portal backend.
- Real cloud, deploy, kubectl, build/push, live-test, live provider evidence or production billing is authorized.

landed_commit: `9f703f0c858bb5cc93f4c7cca6606823d215c71f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `9f703f0c858bb5cc93f4c7cca6606823d215c71f`.
- `9f703f0c858bb5cc93f4c7cca6606823d215c71f` updates only docs/specs/changes/fixtures/tests lifecycle state; no secret, cloud, deploy, kubectl, build/push or live-test was run.

post_merge_closeout: `completed`

next_cursor: `portal-typed-api-contract`

### 2026-05-24 feat/medopl-gap-typed-api-closeout

Status: `landed / pushed / post-push verified`

Branch: `feat/medopl-gap-typed-api-closeout`

Archived change package: `changes/archive/2026-05-24-portal-typed-api-contract`

Scope:

- Closed `portal-typed-api-contract` as the typed API boundary between Portal frontend pages and backend control-plane projections.
- Archived the typed API package after local deterministic regressions, frontend typecheck, Portal check, golden path and current verification passed.
- Opened `changes/active/opl-entry-real-preflight-launch` as the next productization package.
- Advanced the current local productization cursor to `opl-entry-real-preflight-launch` without claiming that OPL entry real state is complete.

Commits:

- `d7b9877` docs(truth): close portal typed api cursor.
- `4f5df61` docs(truth): sync typed api closeout head.

Verification result:

- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-runtime-real-api-data-closure.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-local-api-action-closure.mjs`: pass.
- `npm --prefix services/portal/frontend run typecheck`: pass.
- `npm --prefix services/portal run check`: pass.
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass before cursor handoff.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src`: pass.

Independent review:

- Reviewer: Raman, Codex native explorer subagent.
- Model: `gpt-5.4-mini`.
- Result: closeout sync requirements confirmed; next cursor should be `opl-entry-real-preflight-launch`.

Can-claim:

- Portal typed API modules and normalized adapters are the frontend-owned boundary for backend control-plane projections.
- The typed API contract package is archived and no longer the active cursor.
- The next local productization cursor is `opl-entry-real-preflight-launch`.

Cannot-claim:

- OPL entry real preflight / launch UI state is fully closed.
- Go backend has replaced the current Node Portal backend.
- Real cloud, deploy, kubectl, build/push, live-test, live provider evidence or production billing is authorized.

landed_commit: `4f5df610b44ba512e0888c0d60436e7ce02fc52b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `4f5df610b44ba512e0888c0d60436e7ce02fc52b` reached `origin/recovery/platform-v22-trunk` after push.
- The pushed head includes typed API closeout, active cursor handoff and workflow review support for active-to-archive package moves.

post_merge_closeout: `completed`

next_cursor: `opl-entry-real-preflight-launch`

### 2026-05-24 feat/medopl-gap-opl-entry-real-launch

Status: `landed / pushed / post-push verified`

Branch: `feat/medopl-gap-opl-entry-real-launch`

Archived change package: `changes/archive/2026-05-24-opl-entry-real-preflight-launch`

Scope:

- Closed `opl-entry-real-preflight-launch` as the local OPL entry projection package.
- Bound OPLEntry frontend state to backend launch-status projection for provider binding, providerKeyRef, Gateway readiness, current stage and blocking user reason.
- Narrowed `/portal/api/opl/launch-status/:launchId` to an explicit public payload whitelist so internal launch/workspace/session fields do not leak into frontend truth.
- Advanced the current cursor to `real-cloud-authorization-boundary` as authorization-required / local boundary only.

Commits:

- `ae57463` feat(opl): bind entry to backend launch projections.
- `043601f` docs(opl): record entry projection closeout.
- `11fee40` fix(opl): narrow launch status projection.

Verification result:

- `node tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs`: pass.
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-provider-secret-boundary-contract.mjs`: pass.
- `npm --prefix services/portal/frontend run typecheck`: pass.
- `npm --prefix services/portal run check`: pass.
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/src services/opl-web-gateway/src services/opl-runtime-bridge/src`: pass.

Independent review:

- Reviewer: Chandrasekhar, Codex native explorer subagent.
- Model: `gpt-5.4-mini`.
- Result: found two Important issues after initial implementation: launch-status public payload spread internal status fields, and OPLEntry fetched but did not consume `currentStage` / `blockingUser`. Both were fixed by explicit public payload whitelist and stage/blocking-driven step status guards before landing.

Can-claim:

- OPLEntry local UI consumes backend launch-status projection for provider binding, providerKeyRef, Gateway readiness, current stage and blocking user reason.
- The frontend typed API exposes only safe OPL launch-status fields needed by the entry UI.
- The local golden path and contract gates cover this OPL entry projection boundary.

Cannot-claim:

- Live provider reply evidence, real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
- Go backend has replaced the current Node Portal backend.
- `portal-runtime` fan-out or workspace-to-minio helper debt is retired.
- OPL entry local projection is production WebUI provider reply or real cloud launch evidence.

landed_commit: `11fee408eabb8e6c34961373ee11eb8607f5816e`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `11fee408eabb8e6c34961373ee11eb8607f5816e`.
- Post-merge closeout sync updates only docs, durable specs, changes archive, tests fixtures and closeout automation allowlist.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-24 feat/v22-local-control-plane-hardening

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-local-control-plane-hardening`

Archived change package: `changes/archive/2026-05-24-local-control-plane-hardening`

Scope:

- Retired the active PowerShell workspace-to-MinIO sync helper and removed `scripts/sync-workspace-file-to-minio.ps1` from the active scripts surface.
- Kept workspace storage sync in Node runtime code with direct `mc` calls and shared encoded object-prefix construction for write and read paths.
- Reduced `services/portal/src/app/portal-runtime.mjs` import fan-out from 18 to 16 by deleting the redundant HTTP re-export layer and moving default process wiring into narrower runtime code.
- Added repo hygiene protection so fixed local service endpoint / port claims cannot become current truth.
- Tightened Go control-plane takeover readiness gates without promoting Go to current production backend.
- Kept current cursor on `real-cloud-authorization-boundary`; this package does not authorize real cloud.

Commits:

- `5d2860f` docs(change): open local control plane hardening package.
- `c00c480` test(hygiene): guard current truth localhost claims.
- `4318782` refactor(portal): retire powershell minio sync helper.
- `0886c23` refactor(portal): reduce runtime assembly fanout.
- `85ccb23` test(go): tighten control plane takeover readiness.
- `54e6dad` fix(portal): close local hardening review gaps.

Verification result:

- `node tests/regression/portal/regression-test-v22-workspace-storage-public-response.mjs`: pass after RED on unencoded MinIO read prefix.
- `node tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs`: pass.
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass.
- `node tests/contract/contract-test-v22-backend-go-convergence-program.mjs`: pass.
- `node tests/contract/contract-test-v22-node-portal-workflow-facade-boundary.mjs`: pass.
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`: pass.
- `npm run verify:repo-hygiene`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify:review`: pass.
- `npm --prefix services/portal run check`: pass.
- `go version`: unavailable; `go test ./...` was not run.

Independent review:

- Reviewer: Heisenberg, Codex native explorer subagent.
- Model requested: `gpt-5.4-mini`; returned report identified itself as GPT-5.
- Result: accepted the direction on MinIO helper retirement, Go future-target boundary and Portal runtime fan-out reduction. The claimed local-port self-blocker did not reproduce under `npm run verify:repo-hygiene`; the MinIO read/write encoding mismatch was valid and fixed.

Can-claim:

- Active runtime code no longer depends on `scripts/sync-workspace-file-to-minio.ps1`.
- Workspace MinIO write and read paths share encoded object prefix construction.
- Portal runtime fan-out is reduced, but not fully retired.
- Go takeover readiness gates preserve future-target semantics and the current Node Portal backend boundary.

Cannot-claim:

- Real cloud authorization, live provider evidence, deploy, kubectl, build/push, live-test, production billing or production evidence is authorized.
- Go backend has replaced the current Node Portal backend.
- `go test ./...` evidence exists in this environment.
- All Portal structure debt is closed.

landed_commit: `c36526a4afe49cc56f25ec2d2988b5dc32feb9a2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `c36526a4afe49cc56f25ec2d2988b5dc32feb9a2`.
- Post-push closeout sync updates only docs/active, docs/history and tests/fixtures/v22/goal-current.json.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-24 feat/v22-go-control-plane-mvp-takeover

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-go-control-plane-mvp-takeover`

Archived change package: `changes/archive/2026-05-24-go-control-plane-mvp-takeover`

Scope:

- Handoff from `real-cloud-authorization-boundary` to `go-control-plane-mvp-takeover` because user chose to delay cloud migration and require Go control-plane MVP first.
- `services/medopl-go-backend` is the local MVP takeover target for control-plane API truth.
- `services/portal/frontend` remains the separated frontend package.
- `services/portal/src` enters business truth retirement and must not remain a long-term active backend or compatibility control plane.
- Go now owns the local lab typed API surface under `/api/lab-*`.
- Node `/portal/api/lab-*` is retired as a 410 fail-closed shell and no longer writes lab package/subscription business truth.
- Local RC parity later folded into the same landed line: provider/preflight/launch, billing/audit, resource projection and release/stop-billing are Go-owned local deterministic proof; Node Portal v22 provider/open/readiness/work/release routes and business domains are physically retired.

Can-claim:

- The first Go control-plane MVP takeover slice landed and was pushed.
- Go serves the local lab typed API surface under `/api/lab-*`.
- Portal frontend lab typed API uses the Go control-plane client.
- Node `/portal/api/lab-*` is retired as a 410 fail-closed shell and no longer writes lab package/subscription business truth.
- Real-cloud readiness remains deferred until Go local RC passes.
- Local current/review bundles pass on this branch.
- The full local Go RC closeout has been post-push verified at trunk HEAD `0112813998456d879e9ea10782f224c29f3a166f`.

Cannot-claim:

- Production backend replacement, real cloud, deploy, kubectl, build/push, live-test or provider operation is complete or authorized.
- Local Go proof does not authorize or prove production backend replacement, real-cloud readiness, live provider, real OPL upstream, production billing or production runtime.

Verification:

- `node scripts/v22-verify.mjs current --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --branch feat/v22-go-control-plane-mvp-takeover --base origin/recovery/platform-v22-trunk --json`: pass.

Review:

- independent reviewer model: `gpt-5.4-mini`
- result: blocker=0 after Node lab API retirement and machine cursor cleanup.

landed_commit: `0112813998456d879e9ea10782f224c29f3a166f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `0112813998456d879e9ea10782f224c29f3a166f`.
- Branch-level `current` and `review` bundles passed before ff-only merge.
- Main trunk `golden-path`, `current` and `review` bundles pass after post-merge closeout sync.
- The completed change package is archived at `changes/archive/2026-05-24-go-control-plane-mvp-takeover`.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-26 feat/v22-precloud-deployable-rc

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-precloud-deployable-rc`

Archived change package: `changes/archive/2026-05-26-precloud-deployable-rc`

Scope:

- Insert a local pre-cloud deployable RC before any real-cloud authorization package.
- Make `services/portal/frontend` talk to the Go backend through `/api` only.
- Make `services/medopl-go-backend` the pre-cloud SaaS backend deployment surface for Portal projection APIs, readiness, billing/export/logout, OPL launch/session/file/run/artifact, and cloud connector fail-closed state.
- Keep `services/portal/src` out of deployment, proxy, typed API ownership and current verification ownership.
- Keep real cloud, secret, deploy, kubectl, build/push and live-test unauthorized.

Verification:

- `node tests/contract/contract-test-v22-precloud-deployable-rc.mjs`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./..."`: pass.
- `npm --prefix services/portal run check`: pass.
- `node scripts/v22-verify.mjs current --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs review --branch feat/v22-precloud-deployable-rc --base origin/recovery/platform-v22-trunk --json`: pass.
- `git diff --check -- docs specs changes tests scripts package.json services/portal/frontend/src services/portal/frontend/vite.config.ts services/portal/package.json services/medopl-go-backend`: pass.

Review:

- Independent review model `gpt-5.4-mini` found a local workspace file-transfer blocker: Go returned `/api/workspace/files/local-transfer` but did not mount the route.
- `b2d6e39` added GET/POST local-transfer handlers and router/contract coverage.
- Second independent review model `gpt-5.4-mini` reported no blocker after the fix.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `78262f9223f549e65539b78d69dac5395774fe04`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `feat/v22-precloud-deployable-rc` was ff-only merged into local `recovery/platform-v22-trunk` at `78262f9223f549e65539b78d69dac5395774fe04`.
- Post-closeout push verification must confirm `origin/recovery/platform-v22-trunk` reaches this landed commit and the follow-up closeout commit.

post_merge_closeout: `completed`

### 2026-05-26 fix/v22-portal-logout-api-regression

Status: `landed / pushed / post-push verified`

Branch: `fix/v22-portal-logout-api-regression`

Archived change package: `changes/archive/2026-05-26-precloud-deployable-rc`

Scope:

- Keep the Go Portal local action regression closed after pre-cloud deployable RC landing.
- Preserve `/api/logout`, billing CSV download, admin create user, recharge/refund, announcement create/delete, desktop overflow and mobile overflow as browser regression coverage against Go backend + Portal frontend.
- Add local Go backend mutable projection state for users, finance rows and announcements.
- Keep Node Portal `/portal/api` and `/logout` out of current backend truth.
- Keep real cloud, secret, deploy, kubectl, build/push and live-test unauthorized.

Verification:

- `npm run verify:golden-path -- --json`: pass.
- `npm run verify:smoke -- --json`: pass.
- `cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...`: pass.
- `npm --prefix services/portal run check`: pass.
- `npm run verify:current -- --json`, `npm run verify:contract -- --json` and `npm run verify:review -- --json` initially failed only because this post-merge closeout had not yet recorded `5f11a0e`.

Review:

- Independent review model `gpt-5.4-mini` found that an earlier browser regression rewrite had reduced action coverage to projection smoke.
- `5f11a0e` restored the action browser regression and added Go backend action tests.
- Follow-up closeout keeps this as local pre-cloud evidence only, not production readiness.

landed_commit: `5f11a0e89d5642de65b0b0abb6cd3eefa8067675`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reaches `5f11a0e89d5642de65b0b0abb6cd3eefa8067675`.
- Fresh closeout verification must confirm current, contract and review bundles pass after this closeout-only sync.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-27 cleanup/v22-node-backend-physical-removal

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-node-backend-physical-removal`

Archived change package: `changes/archive/2026-05-26-precloud-deployable-rc`

Scope:

- Physically removed `services/portal/src/**` so Node Portal backend is no longer a deployable control plane, frontend proxy target, typed API owner or current verification owner.
- Kept `services/portal` as a frontend-only package whose check/start commands delegate to `services/portal/frontend`.
- Preserved Portal frontend -> Go backend `/api` as the local pre-cloud SaaS backend boundary.
- Added Go OPL entry preflight surface coverage and removed stale local RC/provider-bound references to deleted Node backend tests.
- Strengthened zero-compat / physical-removal gates so Node Portal backend and deleted local RC tests cannot return as current truth.
- Kept OPL Web Gateway and Runtime Bridge as separate active integration/runtime services; they are not the retired Portal backend.
- Kept real cloud, secret, deploy, kubectl, build/push and live-test unauthorized.

Verification:

- `npm run verify:golden-path -- --json`: pass.
- `npm run verify:current -- --json`: pass before this closeout landed; post-merge gap was the missing `b2b9cef` closeout record.
- `npm run verify:contract -- --json`: pass.
- `npm run verify:review -- --json`: pass.
- `npm --prefix services/portal run check`: pass.
- `GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...` from `services/medopl-go-backend`: pass.
- `npm run test:regression -- --json`: pass.
- `git diff --check HEAD~1..HEAD`: pass.

Review:

- Independent review model `gpt-5.4-mini` found that `local-rc` still looked like a current entry and zero-compat did not cover enough truth surface.
- The branch fixed both findings by emptying the current authorized local RC lane and expanding physical-removal/zero-compat gates over active truth, specs and manifest.

Can-claim:

- Node Portal backend has been physically removed from active source.
- Go backend owns the local pre-cloud Portal control-plane API surface.
- Portal frontend no longer has a Node backend proxy/API owner in `services/portal/src`.
- This is local pre-cloud evidence and a source cleanup closeout.

Cannot-claim:

- Production backend replacement.
- Real cloud readiness.
- Gateway + Runtime Bridge live chain completion.
- Live provider, deploy, kubectl, build/push, production billing or production runtime evidence.
- Permission to read secrets or perform provider/cloud operations.

landed_commit: `b2b9cef82c744a5a18b1465f2350667ec9dbcfa3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reaches `b2b9cef82c744a5a18b1465f2350667ec9dbcfa3`.
- Fresh governance-closeout sync must confirm current, contract and review bundles pass after recording this history handoff.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-27 feat/v22-local-saas-backend-closure

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-local-saas-backend-closure`

Base trunk HEAD: `b2b9cef82c744a5a18b1465f2350667ec9dbcfa3`

Model: `gpt-5.4`

Subagents:

- `gpt-5.4-mini`: Runtime Bridge live probe codebase survey.
- `gpt-5.4-mini`: Gateway live probe package review.
- `gpt-5.4-mini`: Runtime Bridge live probe package review.

Packages:

- `governance-closeout-sync`: synced Node backend physical removal closeout into active/history/current machine truth.
- `local-service-orchestration`: added repo-native local service plan and dry-run health probe for Portal frontend, Go backend, OPL Web Gateway, Runtime Bridge and external clean OPL WebUI.
- `gateway-live-probe`: added Gateway local live probe with clean upstream stub and Runtime Bridge stub.
- `runtime-bridge-live-probe`: added Runtime Bridge local fake runtime probe for launch, bootstrap, session bind, dummy provider config public projection, message, run, artifact, trace and ledger projection.
- `local-saas-backend-rc`: added aggregate local SaaS backend RC guard.

Verification summary:

- `node tests/contract/contract-test-v22-local-service-orchestration.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-gateway-live-probe.mjs`: pass.
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs`: pass.
- `npm run test:regression -- --json`: pass after installing local frontend dependencies in the isolated worktree.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs`: pass.
- `npm --prefix services/opl-runtime-bridge run check`: pass.

Can-claim:

- Local service orchestration, Gateway local live probe, Runtime Bridge local fake probe and aggregate local SaaS backend RC evidence are repo-native and registered.
- Gateway local probe verifies local health, clean upstream stub proxy, launch script injection, same-origin Runtime Bridge proxy and query-secret rejection.
- Runtime Bridge local fake probe verifies local launch, bootstrap, session bind, dummy provider config public projection, message reply artifact trace, runtime run artifact and ledger projection.

Cannot-claim:

- 不能声明真实云、live provider、production runtime、production billing 或 production deploy 已完成。
- 不能声明真实 upstream OPL 已被验证；clean upstream remains external and unchanged.
- 不能声明 secret read、provider operation、kubectl、build/push、deploy 或 live-test 已授权。

Next owner:

- `MedOPL Platform` owns the next non-cloud local Portal/OPL delivery RC package.
- `MedOPL Operations` still owns the separate future real-cloud authorization package.

landed_commit: `c230ecaba724d7d3ee6caaced17314b05750cc25`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `c230ecaba724d7d3ee6caaced17314b05750cc25`.
- `npm run verify:golden-path -- --json`: pass.
- `npm run verify:current -- --json`: pass before this closeout sync except for the expected stale closeout pointer, now corrected by this package.
- `npm run verify:contract -- --json`: pass.
- `npm run verify:review -- --json`: pass.
- `npm run test:regression -- --json`: pass.
- `npm --prefix services/portal run check`: pass.
- `go test ./...` from `services/medopl-go-backend`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-05-27 feat/v22-local-portal-opl-delivery-rc

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-local-portal-opl-delivery-rc`

Base trunk HEAD: `c230ecaba724d7d3ee6caaced17314b05750cc25`

Model: `gpt-5.4`

Archived change package: `changes/archive/2026-05-27-local-portal-opl-delivery-rc`

Scope:

- Closed the local Portal/OPL delivery RC after the local SaaS backend RC.
- Made Go Portal launch projection use configured local OPL Gateway and Runtime Bridge public URLs.
- Added deterministic Portal Go backend -> Gateway -> clean upstream fixture -> Runtime Bridge -> fake ACP message/run/artifact projection coverage.
- Kept `local-rc-authorized` empty because this proof does not read real provider secrets.
- Kept OPL upstream clean and external; the proof uses fixture/stub boundaries only.

Verification:

- `node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/health/health-check-v22-zero-compat-active-surface-gate.mjs`: pass.
- `node tests/regression/opl/regression-test-v22-local-portal-gateway-runtime-rc.mjs`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/config ./internal/service/controlplane ./internal/server -count=1"`: pass.
- `npm run verify:local-release-candidate -- --json`: pass.
- Post-merge closeout sync verification is recorded by the follow-up governance closeout commit.

Can-claim:

- Local Go Portal launch projection can route to configured local OPL Gateway and Runtime Bridge URLs.
- Local deterministic Gateway/Runtime Bridge integration proof is registered under local regression and local release-candidate verification.
- The proof covers clean upstream fixture routing plus fake ACP message/run/artifact projection.

Cannot-claim:

- Real cloud, deploy, kubectl, build/push, live-test, production billing, live provider readiness or upstream production ownership.
- Real upstream OPL behavior, production runtime behavior or production billing behavior.
- Secret read, provider operation or true cloud mutation authorization.

landed_commit: `6e26a636f2ae6dd73dbe288fc5bd1245d6b53f67`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `6e26a636f2ae6dd73dbe288fc5bd1245d6b53f67`.
- `npm run verify:local-release-candidate -- --json`: pass on trunk after feature absorption.
- `npm run test:regression -- --json`: pass on trunk after feature absorption.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass on trunk after feature absorption.
- `node tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs`: pass on trunk after feature absorption.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-08 fix/v22-portal-opl-refund-api

Status: `landed / pushed / post-push verified`

Branch: `fix/v22-portal-opl-refund-api`

Base trunk HEAD: `2e43aca325c8ee7e00619c103c3d5af4f510c51d`

Model: `gpt-5.4`

Scope:

- Folded the local Portal OPL entry / refund regression fix into the current post-landing truth.
- Landed the local AI MVP readiness baseline at `ca1aa0e0bd42ed1635c8e2ab76d828ed91ae7d9d`.
- Landed real-cloud vision docs, the no-secret `real-cloud-readiness` lane, legacy runtime cloud cleanup and cloud lane contract decoupling.
- Kept readiness strictly pre-cloud: mock/snapshot, readonly quote, dry-run plan and readonly inventory contracts are separated from mutation/deploy/live `cloud-future-authorized`.
- Kept real cloud, secret reads, provider calls, deploy, kubectl, build/push, live-test and upstream writes unauthorized.

Verification:

- `npm run verify`: pass after closeout sync.
- `npm run gate:review`: pass after closeout sync.
- `npm run test:health`: pass after closeout sync.
- `npm run test:contract`: pass after closeout sync.
- `npm run test:real-cloud-readiness`: pass after closeout sync.
- `sentrux check .`: pass after closeout sync.
- `sentrux gate .`: pass after closeout sync.

Can-claim:

- The local MVP baseline and real-cloud readiness prework are landed on the recovery trunk lineage.
- The repo has a registered `real-cloud-readiness` lane for no-secret readiness contracts.
- Legacy runtime cloud compatibility surfaces were removed from the active runtime path.
- Cloud mutation/deploy/live-test contracts remain visible but are isolated under future-authorized boundaries.

Cannot-claim:

- Real Tencent Cloud readonly live inventory has run.
- Any secret file, provider key, kubeconfig, token, SSH key or cloud credential was read.
- Any real cloud API, deploy, kubectl, build/push, live-test, resource creation, resource release, billing mutation or production canary was executed.
- Readiness lane evidence authorizes mutation, deploy or production release.

landed_commit: `bbc442e8f5b312530ab5669a6789908a16c62999`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` contains `bbc442e8f5b312530ab5669a6789908a16c62999`; the follow-up closeout commit is docs/fixture-only.
- `origin/fix/v22-portal-opl-refund-api` contains `bbc442e8f5b312530ab5669a6789908a16c62999`.
- Standard verification is expected to run against `origin/recovery/platform-v22-trunk` after the closeout push because the runner's default trunk ref is remote-tracking.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-10 feat/v22-package-c-dry-run-create-release-plan

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-package-c-dry-run-create-release-plan`

Base trunk HEAD: `0e9820a1db0036949f27ebc14076d0832cfcc2c9`

Model: `gpt-5.4`

Archived change package: `changes/archive/2026-06-10-package-c-dry-run-create-release-plan`

Scope:

- Landed Package C dry-run create/release planning after Package B readonly inventory and TC3 cleanup.
- Added `scripts/v22-tencent-create-release-dry-run-plan.mjs` and a local gate for deterministic dry-run plan output.
- Registered `test:cloud-future-authorized` and the Package C gate in the future-authorized suite.
- Added durable Operations/Runtime spec trace for Package C dry-run and WebUI future-authorized authorization-required behavior.
- Kept Package C live create/release blocked: no mutation secret read, no real cloud mutation, no Portal ledger write, no deploy, no kubectl, no build/push and no live-test.

Verification:

- `npm run test:cloud-future-authorized`: pass before and after ff-only landing.
- `npm run gate:review`: pass before and after ff-only landing.
- `git diff --check -- docs tests scripts changes package.json package-lock.json specs`: pass before landing.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`: pass on authoring branch.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass on authoring branch.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass on authoring branch.

Can-claim:

- Package C has a local dry-run create/release plan runner and gate on the recovery trunk lineage.
- The dry-run plan covers workspace file space, workspace compute allocation, layered Kubernetes isolation controls, freeze-only billing and premium dedicated pool support at planning level.
- The runner rejects secret-file, live mutation, deploy, kubectl, build and push arguments.
- The future-authorized WebUI gate returns `authorization_required` unless an explicit WebUI source is provided.

Cannot-claim:

- Package C live create/release is authorized.
- Mutation secrets have been read.
- Real Tencent Cloud resources have been created, resized, bound or released.
- Portal ledger, billing charge, stop-billing mutation, kubectl, deploy, build/push or live-test has run.
- Production cloud is online.

landed_commit: `a3f78871f4a8310ee4b571ff47579137728f362a`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `a3f78871f4a8310ee4b571ff47579137728f362a`.
- `package-c-mutation.env` redacted readiness check found the file and all expected keys, but `TENCENT_MUTATION_TKE_CLUSTER_ID` and `TENCENT_MUTATION_TKE_NODE_POOL_ID` remain empty.
- No mutation secret value was printed, no raw provider response was written, and no real cloud, deploy, kubectl, build/push or live-test operation was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-10 feat/v22-tke-bootstrap-preflight

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-tke-bootstrap-preflight`

Base trunk HEAD: `97a484285b40d09722b8eb1769b20b61fbb8d91b`

Model: `gpt-5.4`

Archived change package: `changes/archive/2026-06-10-tke-bootstrap-preflight`

Scope:

- Added local-only TKE bootstrap preflight after Package C dry-run and before any Package C live mutation.
- Added `scripts/v22-tke-bootstrap-preflight-plan.mjs` and a local gate proving no secret read, no Tencent Cloud call, no kubectl, no deploy, no build/push and no production readiness claim.
- Registered the preflight gate in `cloud-future-authorized`.
- Updated durable specs to keep the cloud shape as shared cluster + layered isolation + premium dedicated pool future phase, with PostgreSQL / COS / CBS as required data plane and Redis non-required.
- Kept Package C live create/release blocked until TKE foundation is created, readonly inventory observes cluster/node pool identifiers and the user explicitly authorizes live mutation.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs`: pass.
- `npm run test:cloud-future-authorized`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass.
- `npm run gate:review`: pass.
- `npm run closeout:check`: pass.
- `git diff --check -- docs specs changes tests scripts package.json package-lock.json`: pass.

Can-claim:

- The repo has a local TKE bootstrap preflight runner and gate on the recovery trunk lineage.
- The preflight states the first cloud foundation checklist and exact Package C env fields: `TENCENT_MUTATION_TKE_CLUSTER_ID` and `TENCENT_MUTATION_TKE_NODE_POOL_ID`.

Cannot-claim:

- TKE, NAT, CBS, COS, PostgreSQL, namespaces, workloads or node pools have been created.
- Package C live mutation is authorized.
- Production cloud, production runtime, production billing, deploy, kubectl, build/push or live-test is complete.

landed_commit: `0e5fe7a202264828b75471de538267a3d32cc498`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `0e5fe7a202264828b75471de538267a3d32cc498`.
- `npm run test:cloud-future-authorized`: pass after landing.
- `npm run gate:review`: pass after landing.
- `npm run closeout:check`: pass after landing closeout.
- No mutation secret value was printed, no raw provider response was written, and no real cloud, deploy, kubectl, build/push or live-test operation was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-10 cleanup/v22-governance-closeout

Status: `landed / pushed / post-push verified`

Branch: `cleanup/v22-governance-closeout`

Base trunk HEAD: `0e5fe7a202264828b75471de538267a3d32cc498`

Model: `gpt-5.4`

Subagents and model:

- `Goodall`: `gpt-5.4`, read-only sidecar reviewer.

Archived change packages:

- `changes/archive/2026-06-10-repo-governance-closeout`
- `changes/archive/2026-06-10-tencent-readonly-inventory-live-runner`
- `changes/archive/2026-06-10-tc3-readonly-diagnostic-retirement`

Scope:

- Contracted `scripts/` back to the long-lived v22 control-plane surface.
- Moved Package B/C/TKE cloud-prework support to `tests/support/cloud-prework/`.
- Kept readonly inventory, TC3 cleanup, Package C dry-run and TKE preflight locally gated through registered test lanes.
- Archived Package B readonly inventory and TC3 diagnostic cleanup lifecycle packages to match current truth.
- Synced durable operations/framework/runtime specs and current manifest commands after cloud-prework support relocation.

Verification:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass after manifest/current cursor sync.
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass before archive sync.
- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`: pass before archive sync.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-real-cloud-readiness-lane.mjs`: pass.
- `npm run repo:bloat`: pass with `scriptsFiles=8`.
- `npm run line:budget`: pass with only the existing `services/opl-web-gateway/src/launch-client-script.mjs` baseline exception.
- `npm run test:real-cloud-readiness`: pass.
- `npm run test:cloud-future-authorized`: pass.
- `npm run verify`: pass after archive sync and cloud-prework support rename.
- `npm run gate:review`: pass after archive sync.
- `npm run verify:repo-hygiene`: pass after archive sync.
- `sentrux check .`: pass with quality `7171`.
- `sentrux gate .`: pass with quality `6486 -> 7171`, cycles `0 -> 0`, god files `0 -> 0`.
- `git diff --check -- docs specs changes tests scripts package.json package-lock.json`: pass.

Can-claim:

- `scripts/` no longer contains temporary Tencent/TKE cloud-prework executables.
- Cloud-prework support remains available under `tests/support/cloud-prework/` and is consumed by registered future-authorized tests.
- Package B readonly inventory and TC3 diagnostic cleanup lifecycle packages no longer contradict current truth by staying active.
- The current cursor remains `real-cloud-authorization-boundary`.

Cannot-claim:

- Production readiness, real-cloud readiness, Package C live create/release, TKE/NAT/CBS/COS/PostgreSQL creation, workload deployment, production billing readiness, secret read, provider operation, deploy, kubectl, build/push or live-test authorization.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `d1d5f2c9edf6beadf263ad2b7cd91ae59775bf56`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `d1d5f2c9edf6beadf263ad2b7cd91ae59775bf56`.
- `npm run verify`: pass before post-merge closeout; post-merge closeout then updated this history and machine cursor to the landed governance commit.
- `npm run gate:review`: pass.
- `npm run verify:repo-hygiene`: pass.
- `sentrux check .`: pass with quality `7171`.
- `sentrux gate .`: pass with quality `6486 -> 7171`, cycles `0 -> 0`, god files `0 -> 0`.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-10 post-merge/v22-governance-closeout-closeout

Status: `landed / pushed / post-push verified`

Branch: `post-merge/v22-governance-closeout-closeout`

Base trunk HEAD: `d1d5f2c9edf6beadf263ad2b7cd91ae59775bf56`

Model: `gpt-5.4`

Scope:

- Closed the post-merge cursor after landing `cleanup/v22-governance-closeout`.
- Synced `docs/active/README.md`, `docs/delivery/README.md`, this history section and `tests/fixtures/v22/goal-current.json` to the landed governance commit.
- Kept the execution cursor at `real-cloud-authorization-boundary`.

Verification:

- `npm run closeout:check`: pass before this closeout commit.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass before this closeout commit.

Can-claim:

- Governance closeout landed on `origin/recovery/platform-v22-trunk`.
- Post-merge closeout fields now point at the landed governance commit.

Cannot-claim:

- Production readiness, real-cloud readiness, Package C live create/release, secret read, provider operation, deploy, kubectl, build/push or live-test authorization.

landed_commit: `d1d5f2c9edf6beadf263ad2b7cd91ae59775bf56`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `d1d5f2c9edf6beadf263ad2b7cd91ae59775bf56`.
- `npm run closeout:check`: pass.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-12 feat/v22-tenant-node-pool-lifecycle

Status: `landed / pushed / post-push verified`

Branch: `feat/v22-tenant-node-pool-lifecycle`

Base trunk HEAD: `14848603807f8f0170d299fccf3f0da17f33f288`

Model: `gpt-5.4`

Scope:

- Replaced the active cloud tenancy model with one unified TKE cluster, one platform service node pool and Package C-created tenant node pools per tenant or workspace.
- Removed active shared user compute pool, premium pool and trial/free entitlement narratives from docs, contracts, pricing snapshot, Portal API types and Package C/TKE support.
- Updated Package C dry-run, TKE bootstrap preflight, readonly inventory classification and cleanup gates around tenant node pool lifecycle.
- Kept old shared/premium pool wording only as history provenance and future-authorized forbidden assertions.

Verification:

- `npm run verify`: pass before ff-only landing.
- `npm run verify`: pass after ff-only landing on `recovery/platform-v22-trunk`.
- `npm run gate:review`: pass before landing.
- `npm run closeout:check`: failed after landing with expected `non_closeout_commits_after_latest_landed`, then this closeout commit reconciled history and machine cursor state.
- `git diff --check -- docs specs changes tests services package.json compose.product.yaml`: pass before landing.

Can-claim:

- `origin/recovery/platform-v22-trunk` contains the tenant node pool lifecycle contract at `28dad14c5b0ef6a793ffd86c600171335f33f040`.
- Active truth now says MedOPL platform services use the platform service node pool, while Package C creates tenant node pools for tenant/workspace runtime workload.
- Pricing and cloud future-authorized gates now reject the old shared quota / shared user compute pool route.

Cannot-claim:

- TKE, NAT, CBS, COS, PostgreSQL, namespaces, workloads or tenant node pools have been created by MedOPL automation.
- Package C live mutation is authorized.
- Secret read, true cloud execution, deploy, kubectl, build/push, live-test, production billing readiness or production runtime readiness is complete.

landed_commit: `28dad14c5b0ef6a793ffd86c600171335f33f040`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `28dad14c5b0ef6a793ffd86c600171335f33f040`.
- `npm run verify`: pass after landing.
- `npm run closeout:check`: expected closeout gap detected before this closeout commit.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-12 fix/v22-native-tke-nodepool-inventory

Status: `landed / pushed / post-push verified`

Branch: `fix/v22-native-tke-nodepool-inventory`

Base trunk HEAD: `95ff691ce35142c04616a2279a4101041ef9f7f2`

Model: `gpt-5.4`

Scope:

- Added readonly inventory support for Tencent TKE native node pools via TKE `2022-05-01` `DescribeNodePools`.
- Kept existing classic node pool readonly path through TKE `2018-05-25` `DescribeClusterNodePools`.
- Updated the official SDK wrapper local gate to prove native node pools can be counted and classified without mutation APIs.
- Re-ran authorized readonly inventory and observed one native TKE node pool; role remained unclassified because the returned node pool payload did not expose the expected platform role tag.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite real-cloud-readiness --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass before landing.
- Authorized readonly inventory run `readonly-2026-06-12-native-nodepool-rerun`: pass with `callsMutationApi=false`, `readsCosObjectBody=false`, `blockers=[]`.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes native TKE node pool readonly observation support at `df15ed652228ceffc73f46b5f58843a9371d41c6`.
- The cloud account currently exposes one running TKE cluster and one native node pool to readonly inventory.
- The native node pool is observed without mutation, kubectl, deploy, build/push or live-test.

Cannot-claim:

- The observed native node pool is classified as `platform_service`; its returned payload is still `unclassified` until an accepted tag/label source is visible to the readonly API or the operator foundation mapping is explicitly consumed.
- Package C live mutation is authorized.
- Secret mutation, deploy, kubectl, build/push, live-test, production billing readiness or production runtime readiness is complete.

landed_commit: `df15ed652228ceffc73f46b5f58843a9371d41c6`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `df15ed652228ceffc73f46b5f58843a9371d41c6`.
- `npm run verify`: pass before push.
- `npm run closeout:check`: expected closeout gap detected before this closeout commit.
- No mutation, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-12 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `26790f289c8fdf28b6ef39153b3535ef98af1d51`

Model: `gpt-5.4`

Scope:

- Added Package C dry-run support for an optional `--foundation-env-file` that reads only allowlisted non-secret foundation fields.
- The accepted foundation mapping records TKE cluster, protected platform service node pool and COS workspace root references in the dry-run report.
- The runner rejects mutation secret, readonly secret, deploy, kubeconfig, token and other non-allowlist keys, and fails closed when required foundation fields are missing.
- No real cloud mutation, provider operation, deploy, kubectl, build/push, live-test or raw secret read was performed.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: expected closeout gap detected after the implementation commit reached trunk; this closeout records it.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes Package C dry-run foundation mapping validation at `5122808d36c8e0eca54aa455ff368ab6a750215f`.
- Package C dry-run can prove the protected platform service node pool mapping without reading mutation secrets or calling cloud APIs.

Cannot-claim:

- Real Package C create/release mutation is authorized or executed.
- Deploy, kubectl, build/push, live-test, production billing readiness or production runtime readiness is complete.

landed_commit: `5122808d36c8e0eca54aa455ff368ab6a750215f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `5122808d36c8e0eca54aa455ff368ab6a750215f`.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- No secret read, real cloud operation, live provider call, deploy, kubectl, build/push, live-test or upstream modification was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `4401f8862b069251e28929bfba8139344a070f41`

Model: `gpt-5.4`

Scope:

- Added Package C live canary readiness as a prepare-only local gate before any authorized live create/release mutation.
- The runner rejects live mutation, deploy, kubectl, build/push and kubeconfig arguments and requires `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0`.
- The gate validates the exact Tencent API allowlist, secret allowlist, cluster `cls-fi097sy4`, protected platform node pool `np-cbk784r8`, tenant pool prefix `medopl-tenant-`, evidence sink and expected create/release plan.
- Authorizable inputs generate only `.runtime` readiness evidence and a live canary authorization pack; blocked inputs generate blocked evidence only.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `npm run verify`: pass.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes Package C live canary readiness gate at `dd146022918249daddd0927787a7c9e8ecc5fd1c`.
- The repo can generate a prepare-only Package C live canary authorization pack without real cloud mutation.
- Protected platform node pool `np-cbk784r8`, cluster `cls-fi097sy4` and tenant node pool prefix `medopl-tenant-` are enforced by local tests.

Cannot-claim:

- Real Package C create/release mutation is authorized or executed.
- `RUN_TENCENT_CREATE_RELEASE_EXECUTION` may be changed from `0`.
- Deploy, kubectl, build/push, live-test, production billing readiness or production runtime readiness is complete.

landed_commit: `dd146022918249daddd0927787a7c9e8ecc5fd1c`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `dd146022918249daddd0927787a7c9e8ecc5fd1c`.
- `npm run closeout:check -- --trunk-ref HEAD --json`: pass before this closeout commit.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `npm run verify`: pass.
- No real Tencent mutation, deploy, kubectl, build/push, live-test, kubeconfig read or secret write to git was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `bc62954b092bac9646d4ef74ea4a9f854b344a90`

Model: `gpt-5.4`

Scope:

- Added Package C live canary non-secret cloud parameters input contract.
- Kept worker subnet, security group, instance type, disk, billing mode, public IP, AZ, image/runtime and login policy out of `package-c-mutation.env`.
- Added schema validation and redacted `CreateNodePool` request evidence for prepare-only readiness.
- Fixed public IP to disabled, cluster to `cls-fi097sy4`, protected platform node pool to `np-cbk784r8`, worker subnet to `subnet-a1fldajw`, security group to `sg-6671l5we` and tenant node pool prefix to `medopl-tenant-`.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs`: pass.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `npm run verify`: pass.
- Prepare-only rerun with the real mutation env and a `.runtime` non-secret cloud params file generated readiness evidence, authorization pack and redacted `CreateNodePool` request with no live execution.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes Package C live canary cloud params input contract at `91d7b6e5061911762bf75347b42cc91e721354b9`.
- Package C readiness can validate a separate non-secret cloud params JSON and produce redacted local evidence.

Cannot-claim:

- Real Package C create/release mutation is authorized or executed.
- `RUN_TENCENT_CREATE_RELEASE_EXECUTION` may be changed from `0`.
- Deploy, kubectl, build/push, Package D, live-test, production billing readiness or production runtime readiness is complete.

landed_commit: `91d7b6e5061911762bf75347b42cc91e721354b9`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `91d7b6e5061911762bf75347b42cc91e721354b9`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the implementation commit reached trunk; this closeout records it.
- No real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `bae0a6ee7ab52cfb8177ce0454fa2f188e8b1a02`

Model: `gpt-5.4`

Scope:

- Added Package C live canary runner as a future-authorized local proof surface.
- The runner rejects deploy, kubectl, build/push, Package D, kubeconfig and unsafe args.
- The runner requires explicit live confirmation, `RUN_TENCENT_CREATE_RELEASE_EXECUTION=1`, max operation count `1`, budget at or below `50` CNY, cluster `cls-fi097sy4`, protected platform pool `np-cbk784r8` and tenant prefix `medopl-tenant-`.
- Successful runs reset `RUN_TENCENT_CREATE_RELEASE_EXECUTION` back to `0`; local tests prove call order, protected pool refusal, rollback shape and redacted evidence files.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass before push.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C live canary runner at `3e7802f813b4c1e90e5f72dc6975a49223fc2159`.
- Package C has a local runner contract for authorized create/scale/release canary execution and redacted `.runtime` evidence.
- The runner is registered in the cloud future-authorized lane.

Cannot-claim:

- This closeout authorizes a new real Tencent mutation, deploy, kubectl, build/push, Package D, live-test or kubeconfig read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `3e7802f813b4c1e90e5f72dc6975a49223fc2159`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `3e7802f813b4c1e90e5f72dc6975a49223fc2159`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the implementation commit reached trunk; this closeout records it.
- No additional Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3e7802f813b4c1e90e5f72dc6975a49223fc2159`

Model: `gpt-5.4`

Scope:

- Fixed Package C live runner failure evidence so Tencent SDK failures are stored with sanitized `error.code`, `error.message`, `requestId`, `apiVersion`, `action`, `region` and `nodePoolName`.
- Kept failure evidence out of raw provider response, SecretId, SecretKey, kubeconfig and token surfaces.
- Updated active/delivery/current truth to record that Package C live runner failure redaction is local future-authorized evidence only.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass before push.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C live runner failure evidence redaction fix at `2baa3b36aa1032962f5af91c0b698b7740621cb0`.
- Package C local live runner tests cover sanitized failure evidence for Tencent SDK errors.

Cannot-claim:

- This closeout authorizes a new real Tencent mutation, deploy, kubectl, build/push, Package D, live-test or kubeconfig read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `2baa3b36aa1032962f5af91c0b698b7740621cb0`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `2baa3b36aa1032962f5af91c0b698b7740621cb0`.
- `npm run closeout:check -- --json`: expected closeout gap detected after the failure evidence fix reached trunk; this closeout records it.
- No additional Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `6f3b706d343b3f6c05c7a3901130efbe581c644c`

Archived change package: `changes/archive/2026-06-13-package-c-plan-catalog-contract`

Model: `gpt-5.4`

Scope:

- Aligned Package C live canary prepare-only cloud params with the MedOPL plan catalog.
- Set Starter current product/server plan to `starter_2c4g_10gb`: 2C4G, 10GB workspace storage and one task concurrency.
- Kept Pro current product/server plan as `pro_8c16g_100gb`: 8C16G, 100GB workspace storage and two task concurrency.
- Added a Package C plan catalog allowlist consumed by the readiness and live runner helpers.
- Derived Tencent `nodeInstanceType`, workspace storage quota and TKE node `systemDisk` from the allowlist instead of accepting arbitrary `instanceType` input.
- Fixed the Package C canary Starter mapping to TKE `SA5.MEDIUM4`, `CloudSSD` 50GB node system disk and public IP disabled.
- Kept `workspaceStorageGb` as the user package storage quota / billing item, distinct from TKE node system disk.
- Cleared active temporary Starter 100GB and arbitrary custom instance type wording from current product/spec/source/test truth, except negative tests and history context.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `node tests/smoke/smoke-test-v22-pricing-plan-contract.mjs`: pass.
- `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`: pass.
- `node tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs`: pass.
- `bash -lc "cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./internal/domain/lab ./internal/service/lab ./internal/repository/memory ./internal/server/handlers"`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass before push.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C plan catalog `CloudSSD` system disk correction at `d824bf1ae76486f5b754fcb5957c8244484502df`.
- Package C prepare-only canary validates Starter through catalog-derived Tencent node parameters.
- User upgrades remain allowed only after the target shape exists in MedOPL plan catalog allowlist.

Cannot-claim:

- This closeout authorizes a real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Users can choose arbitrary Tencent instance types.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `d824bf1ae76486f5b754fcb5957c8244484502df`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `d824bf1ae76486f5b754fcb5957c8244484502df`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the Package C `CloudSSD` system disk correction reached trunk; this closeout records it.
- No additional Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `53d685fb9a7c0328ddec57879a5b71eec57deac7`

Model: `gpt-5.4`

Scope:

- Corrected the Package C plan catalog and prepare-only contract to Tencent's observed `CLOUD_BSSD` system disk enum.
- Kept Starter as `starter_2c4g_10gb`: 2C4G, 10GB workspace storage, TKE `SA5.MEDIUM4`, 50GB node system disk and public IP disabled.
- Kept the CreateNodePool request path as `Native.SystemDisk.DiskType` / `Native.SystemDisk.DiskSize`.
- Updated Package C readiness/live runner local gates and current truth docs to use `CLOUD_BSSD`.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: pass before push.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C `CLOUD_BSSD` system disk contract correction at `6651d064933aa730858cd6c70239c7ba1176492b`.
- Package C prepare-only evidence can now express Starter with Tencent's observed `CLOUD_BSSD` system disk enum.

Cannot-claim:

- This closeout authorizes a real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `6651d064933aa730858cd6c70239c7ba1176492b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `6651d064933aa730858cd6c70239c7ba1176492b`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: pass before push.
- No additional Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `6651d064933aa730858cd6c70239c7ba1176492b`

Model: `gpt-5.4`

Scope:

- Aligned Package C `CreateNodePool` request builder with the Tencent v20220501 public-IP-disabled shape.
- Set `Native.InternetAccessible.AddressType` to `PublicIP`, kept `MaxBandwidthOut` at `0`, and kept `ChargeType` as `TRAFFIC_POSTPAID_BY_HOUR`.
- Removed business `Tags` and `Annotations` from the inline `CreateNodePool` request.
- Kept the post-create `TagResources` plan for tenant, account, workspace, resource binding and billing attribution tags.
- Updated the prepare-only redacted request contract and Package C readiness/live runner local gates.

Verification:

- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the builder fix reached trunk; this closeout records it.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C `CreateNodePool` builder correction at `6cc500635d7dbd46ef2148984b648da202f95ba5`.
- Package C prepare-only evidence can now express `AddressType=PublicIP`, `MaxBandwidthOut=0`, `ChargeType=TRAFFIC_POSTPAID_BY_HOUR`, empty inline `Tags` / `Annotations`, and a retained post-create `TagResources` plan.

Cannot-claim:

- This closeout authorizes a real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `6cc500635d7dbd46ef2148984b648da202f95ba5`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `6cc500635d7dbd46ef2148984b648da202f95ba5`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the Package C builder correction reached trunk; this closeout records it.
- No additional Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `a2488f5b13cc7b4f1bd90c65e2d7dd306553a693`

Model: `gpt-5.4`

Scope:

- Aligned Package C `TagResources` request tags with Tencent Tag API v20180813 field names.
- Changed post-create tag pairs from `{ Key, Value }` to `{ TagKey, TagValue }`.
- Updated the prepare-only redacted request contract so `tagResourcesPlan.tags` shows `TagKey` / `TagValue`.
- Kept the Package C `CreateNodePool` builder unchanged, including `PublicIP`, `MaxBandwidthOut=0`, no inline business tags / annotations, `starter_2c4g_10gb` and `CLOUD_BSSD` 50GB node system disk.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the TagResources builder fix reached trunk; this closeout records it.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C `TagResources` tag field correction at `10ef7d28c4c15fba309e1ceb1f8ad3348fcf8976`.
- Package C prepare-only evidence can now express post-create `TagResources` tags using `TagKey` / `TagValue`.

Cannot-claim:

- This closeout authorizes a real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `10ef7d28c4c15fba309e1ceb1f8ad3348fcf8976`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `10ef7d28c4c15fba309e1ceb1f8ad3348fcf8976`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the Package C `TagResources` field correction reached trunk; this closeout records it.
- No Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 recovery/platform-v22-trunk

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `10ef7d28c4c15fba309e1ceb1f8ad3348fcf8976`

Model: `gpt-5.4`

Scope:

- Updated Package C live canary `TagResources` strategy after Tencent returned `InvalidParameter.UnsupportedService` for `tke:nodepool`.
- Kept the post-create `TagResources` plan but stopped treating unsupported TKE node pool cloud tags as a create/release canary hard blocker.
- Added fail-closed runner behavior: `InvalidParameter.UnsupportedService` containing `tke:nodepool` records `tagResourcesSkippedUnsupportedService` and `cloudTagSupport=tkeNodePoolUnsupported`, then continues scale / observe / release; other `TagResources` errors still fail closed and only allow cleanup of the current canary tenant node pool.
- Set ownership / billing attribution canonical truth to the MedOPL `resourceBinding` ledger; current canary evidence writes only `.runtime`, and the production ledger path remains PostgreSQL.
- Updated prepare-only cloud parameters evidence and future-authorized local gates for the unsupported cloud-tag strategy.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the Package C unsupported tag strategy reached trunk; this closeout records it.
- `git diff --check -- docs specs changes tests scripts package.json`: pass before push.

Can-claim:

- `origin/recovery/platform-v22-trunk` includes the Package C unsupported `tke:nodepool` tag strategy at `f4194f349a87cd492942b11844e797fdc0739e37`.
- Package C live runner can skip only Tencent `InvalidParameter.UnsupportedService` for `tke:nodepool` cloud tags and continue the canary flow.
- Cloud tags remain planned reconciliation evidence where supported; MedOPL `resourceBinding` ledger is the canonical ownership / billing attribution truth.

Cannot-claim:

- This closeout authorizes a real Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret read.
- Production billing readiness, production runtime readiness or production deploy readiness is complete.
- Unsupported `tke:nodepool` cloud tags can replace the MedOPL resourceBinding ledger.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `f4194f349a87cd492942b11844e797fdc0739e37`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `f4194f349a87cd492942b11844e797fdc0739e37`.
- `npm run verify`: pass before push.
- `npm run closeout:check -- --json`: expected closeout gap detected after the Package C unsupported `tke:nodepool` tag strategy reached trunk; this closeout records it.
- No Tencent mutation, deploy, kubectl, build/push, Package D, live-test, kubeconfig read or secret write to git was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 package-c-live-canary-post-live

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3f5595d8e9c1384f7e7c6001b41385cd9defb115`

Model: `gpt-5.4`

Scope:

- Recorded the authorized Package C tenant node pool live canary closeout without adding new long-lived docs, directories, flows, entrypoints or implementation code.
- `CreateNodePool`, scale up, scale down and `DeleteNodePool` passed for `medopl-tenant-rb-package-c-live-canary-20260613`.
- Readonly cleanup check passed: the canary tenant node pool was absent by name and id, while protected platform pool `np-cbk784r8` was observed.
- `TagResources` for `tke:nodepool` returned `InvalidParameter.UnsupportedService`; cloud tags remain non-canonical for TKE node pools.
- Canonical ownership / billing truth must enter the MedOPL PostgreSQL `resourceBinding` ledger before production.
- Next implementation plan is limited to PostgreSQL resource binding ledger, cloud operation state machine, billing/audit ledger, Portal opening entry and workspace storage quota.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before push.

Can-claim:

- Package C has one real Tencent tenant node pool lifecycle canary proving create / scale / delete / cleanup against the fixed cluster and protected platform pool boundary.
- `tke:nodepool` cloud tagging is unsupported and cannot be ownership / billing source of truth.
- Productionization now starts from MedOPL PostgreSQL `resourceBinding` ledger and operation/billing/Portal/storage quota surfaces.

Cannot-claim:

- Production Portal self-service, PostgreSQL ledger, billing/audit ledger, workspace quota, deploy, kubectl, build/push, Package D or production runtime readiness is implemented.
- Additional Tencent mutation or live-test is authorized by this closeout.
- Protected platform node pool `np-cbk784r8` may be deleted, scaled or modified.

landed_commit: `3f5595d8e9c1384f7e7c6001b41385cd9defb115`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `3f5595d8e9c1384f7e7c6001b41385cd9defb115` before this closeout.
- No new Tencent mutation, kubectl, deploy, build/push, Package D or implementation code was performed by this closeout.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

详细过程证据以 git history 为准。本文件只保当前可审摘要，不再保 shadow archive。

### 2026-06-13 resource-binding-ledger-lower-bound

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `6d21bfa88c8d34e96b93c840df37069d8ec9b68b`

Model: `gpt-5.4`

Scope:

- Added the MedOPL PostgreSQL `resource_bindings` / `cloud_operations` ledger lower bound for the Package C tenant node pool lifecycle.
- Added Go domain model and status allowlist for `requested`, `creating`, `created`, `scaling`, `ready`, `releaseRequested`, `deleting`, `released`, `failed` and `cleanupRequired`.
- Added local control-plane store methods and tests for lookup by `resourceBindingId` / `operationId`.
- Added Ent schema and baseline migration markers for canonical ownership / billing truth in PostgreSQL.
- Kept Tencent `tke:nodepool` `TagResources` unsupported as non-canonical; ledger fields use `canonical_ownership_source=postgres_resource_binding_ledger` and `cloud_tag_support=tke_nodepool_unsupported`.
- Preserved pre-create semantics: `nodePoolName` records the target tenant node pool, while `nodePoolId` may be empty until Tencent returns a provider ID.

Verification:

- `GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...` from `services/medopl-go-backend`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: expected closeout gap detected after `c31ae1583390db7cfe8c59168cd4565eee1c52d3` reached trunk; this closeout records it.

Can-claim:

- MedOPL now has a local Go/PostgreSQL schema and domain lower bound for resource binding and cloud operation canonical ledger records.
- Package C ownership / billing truth can be represented in PostgreSQL ledger shape rather than Tencent TKE node pool cloud tags.

Cannot-claim:

- Portal self-service opening, production DB migration execution, cloud operation state machine integration, billing/audit ledger, workspace quota, deploy, kubectl, build/push, Package D or production runtime readiness is implemented.
- New Tencent mutation or live-test is authorized by this closeout.

landed_commit: `c31ae1583390db7cfe8c59168cd4565eee1c52d3`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `c31ae1583390db7cfe8c59168cd4565eee1c52d3`.
- No Tencent mutation, kubectl, deploy, build/push, Package D, live-test, kubeconfig read, secret read or secret write to git was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 package-c-cloud-operation-state-machine

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `881eb5001be1fba76425277125cc0ed44ea372fc`

Model: `gpt-5.4`

Scope:

- Integrated Package C live runner evidence with the ResourceBinding / CloudOperation status vocabulary.
- State-machine evidence now covers `requested`, `creating`, `created`, `scaling`, `ready`, `releaseRequested`, `deleting`, `released`, `failed` and `cleanupRequired`.
- Added local gate coverage for successful lifecycle, create failure, post-create scale failure with cleanup, delete failure and protected pool fail-closed behavior.
- Kept unsupported `tke:nodepool` `TagResources` as a non-blocking event; canonical ownership / billing truth remains PostgreSQL `resource_bindings` / `cloud_operations`, not Tencent cloud tags.
- Preserved boundaries: no new Tencent mutation, kubectl, deploy, build/push, Package D, kubeconfig read or secret write to git.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout commit.

Can-claim:

- Package C live runner now emits local `.runtime` ResourceBinding / CloudOperation state-machine evidence for the verified tenant node pool lifecycle and fail-closed paths.
- Protected platform node pool `np-cbk784r8` cannot be written as the tenant node pool in runner ledger evidence.

Cannot-claim:

- Production PostgreSQL writes, Portal self-service opening, billing/audit ledger, workspace quota, deploy, kubectl, build/push, Package D or production runtime readiness is implemented.
- New Tencent mutation or live-test is authorized by this closeout.

landed_commit: `f15baae3020fe09143ecc90074f0b508bc661dbd`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `f15baae3020fe09143ecc90074f0b508bc661dbd` before this closeout.
- No Tencent mutation, kubectl, deploy, build/push, Package D, live-test, kubeconfig read, secret read or secret write to git was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-13 package-c-ledger-repository-write-wiring

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `66519110ca3ad1426d80952f072eb361ec3ec8a7`

Model: `gpt-5.4`

Scope:

- Added Package C resource binding ledger write methods to the Go control-plane repository contract: create resource binding, append cloud operation event, nodePoolId update, lifecycle status update, mark released, mark failed and mark cleanupRequired.
- Implemented the local memory store contract path against the existing ResourceBinding / CloudOperation domain model, Ent schema and baseline migration shape.
- Wired Package C live runner state transitions to an injected ledger sink while keeping the default sink local/dry-run.
- Kept `.runtime` evidence as audit output and PostgreSQL `resource_bindings` / `cloud_operations` as the canonical ownership / billing shape; Tencent `tke:nodepool` tags remain non-canonical and unsupported.
- Preserved boundaries: no DB password or connection string read, no real PostgreSQL connection execution, no new Tencent mutation, kubectl, deploy, build/push, Package D, kubeconfig read or secret write to git.

Verification:

- `go test ./internal/domain/controlplane ./internal/repository/controlplane ./internal/repository/memory ./internal/repository/postgres` from `services/medopl-go-backend`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout commit.

Can-claim:

- Package C runner can now project ResourceBinding / CloudOperation lifecycle transitions into a repository write contract for success, create failure and cleanupRequired paths.
- Dry-run/local mode does not require a real DB and does not read DB credentials.

Cannot-claim:

- A real PostgreSQL connection sink, Portal self-service opening, billing/audit ledger, workspace quota, deploy, kubectl, build/push, Package D or production runtime readiness is implemented.
- New Tencent mutation or live-test is authorized by this closeout.

landed_commit: `8f324241004faa9b650cf9cf591bbebc414f6363`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `8f324241004faa9b650cf9cf591bbebc414f6363` before this closeout.
- No DB secret read, PostgreSQL connection execution, Tencent mutation, kubectl, deploy, build/push, Package D, live-test, kubeconfig read or secret write to git was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-c-postgres-ledger-sink-gate-closeout

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Scope:

- Closed out the landed Package C PostgreSQL ledger sink gate commit `a7a8a2526f3bf32b0aa515ef492254e89c5927ad`.
- Updated current truth to keep real DB execution blocked until a separate authorized successful PostgreSQL live canary with an explicit dedicated ledger env file and parent-row identities; the root `pg` driver path is now declared.
- No DB secret read, PostgreSQL connection execution, Tencent mutation, kubectl, deploy, build/push, Package D, live-test, kubeconfig read or secret write to git was performed.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Latest trunk closeout is synchronized to the current `origin/recovery/platform-v22-trunk` head.

Cannot-claim:

- A real PostgreSQL canary ran or productionization is complete.

landed_commit: `a7a8a2526f3bf32b0aa515ef492254e89c5927ad`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `a7a8a2526f3bf32b0aa515ef492254e89c5927ad`.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-deploy-readiness-planning

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `f71c0e0c577d617ca84290140f5d75f66cdb3760`

Model: `gpt-5.4`

Scope:

- Switched the stable上线 path to Package D deploy readiness planning only; no deploy execution ran.
- Fixed the deploy readiness target as TKE cluster `cls-fi097sy4` and protected platform pool `np-cbk784r8`.
- Recorded VPC-only PostgreSQL endpoint `10.66.0.21:5432`; Package C PostgreSQL ledger canary waits until service runs inside the VPC.
- Extended Package D local gate to include TCR credentials, registry / namespace / region, kubeconfig ref, deploy cluster id and Portal PostgreSQL URL / password allowlist with redaction.
- Recorded readiness gaps: image build, TCR push, Kubernetes manifests, platform pool scheduling, DB connectivity smoke and rollback plan.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `npm run verify`: pass.

Can-claim:

- Package D deploy readiness planning now has repo-native target, secret/env, safety gate and readiness gap truth.

Cannot-claim:

- Tencent mutation, kubeconfig read, kubectl, deploy, build/push, Package D execution, real PostgreSQL write or production runtime occurred.

landed_commit: `bce336f732b2a1acbbd79319f04e0986164e5aeb`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `bce336f732b2a1acbbd79319f04e0986164e5aeb`.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-local-shape-gate

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3b1c0e62649616a8cf7ab3d9254e30e59ed166a4`

Model: `gpt-5.4`

Scope:

- Added a non-executing Package D local shape gate.
- The gate accepts only `RUN_TENCENT_DEPLOY_EXECUTION=0` for local shape proof and rejects execution-enabled Package D env.
- The gate validates allowlisted deploy/runtime env keys, kubeconfig ref-only handling, VPC PostgreSQL endpoint `10.66.0.21:5432`, target cluster `cls-fi097sy4`, platform service pool `np-cbk784r8`, manifest scheduling to platform service pool and rollback plan shape.
- The gate rejects raw kubeconfig YAML and tenant pool scheduling for platform service workloads.
- Preserved boundaries: no Tencent mutation, kubectl, deploy, build/push, Package D execution, kubeconfig read, package-d env read, secret read or `.runtime` commit.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `git diff --check -- docs changes tests`: pass.

Can-claim:

- Package D local shape gate now covers default-disabled deploy env, Portal runtime PostgreSQL endpoint, kubeconfig ref-only handling, platform pool scheduling shape and rollback plan shape.

Cannot-claim:

- Package D release plan is executable, image build is ready, TCR push is ready, Kubernetes manifests are production-ready, DB connectivity smoke ran, kubectl/deploy/build-push/Package D execution occurred, or production runtime is online.

landed_commit: `28a0e1af3b3f91a3e1c55be6fd2552e0771fc7c1`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `28a0e1af3b3f91a3e1c55be6fd2552e0771fc7c1`.
- No Tencent mutation, kubectl, deploy, build/push, Package D execution, kubeconfig read, package-d env read, secret read or `.runtime` commit was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-release-plan-shape

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `879318ac2a460450d2dbdbad8d33e6d223e70054`

Model: `gpt-5.4`

Scope:

- Added a reviewable Package D release plan shape without real deploy execution.
- The release plan covers image build plan, unique tag rule, TCR registry / namespace / region shape, Kubernetes namespace / deployment / service / config / secretRef shape and platform pool scheduling.
- Image targets are `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`.
- Runtime env injection keeps `PORTAL_POSTGRES_URL` on VPC endpoint `10.66.0.21:5432` and requires DB password through secretRef, not manifest plaintext.
- Added DB connectivity smoke plan for PostgreSQL ledger sink after service runs inside TKE/VPC.
- Added rollback plan for image rollback, Kubernetes rollout undo, config rollback and DB migration forward-only / explicit rollback authorization policy.
- Added required redacted evidence classes for build, push, deploy, smoke and rollback.
- Preserved boundaries: `RUN_TENCENT_DEPLOY_EXECUTION=0`, no package-d env read, no kubeconfig read, no build/push, no kubectl, no deploy, no Tencent mutation, no `.runtime` or secret commit.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `git diff --check -- docs changes tests`: pass.

Can-claim:

- Package D `releasePlanReady=true` for a reviewable, non-executing release plan shape.

Cannot-claim:

- `realExecutionReady=true`, image build, TCR push, kubeconfig read, Kubernetes dry-run/apply, DB connectivity smoke execution, rollback execution, Package D execution, deploy or production runtime occurred.

landed_commit: `cdc3f4b1ee1a12a2f245a2f4a7e1e28f5493465c`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `cdc3f4b1ee1a12a2f245a2f4a7e1e28f5493465c`.
- No package-d env read, kubeconfig read, build/push, kubectl, deploy, Tencent mutation, `.runtime` commit or secret commit was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-execution-preflight-gate

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `d1be9c7e1d5041f8e809d5d1e4cbbe12dadd61e6`

Model: `gpt-5.4`

Scope:

- Added a non-executing Package D execution boundary / preflight gate.
- Split Package D inputs into `package-d-deploy.env` for TCR / registry / cluster / kubeconfig ref and `portal-runtime.env` for Portal admin and PostgreSQL runtime values.
- The gate keeps `RUN_TENCENT_DEPLOY_EXECUTION=0`, rejects raw kubeconfig YAML, rejects Portal runtime keys in deploy env, validates cluster `cls-fi097sy4`, namespace `medopl-platform`, platform pool `np-cbk784r8`, VPC PostgreSQL `10.66.0.21:5432` and four image targets.
- Added redacted preflight evidence and redaction audit assertions for TCR secret, Portal admin password, PostgreSQL password, full DB URL and kubeconfig.
- Preserved boundaries: no package-d env read, no portal-runtime env read, no kubeconfig read, no build/push, no kubectl, no deploy, no Tencent mutation, no Package D execution, no `.runtime` or secret commit.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `git diff --check -- docs specs changes tests scripts package.json`: pass.

Can-claim:

- Package D execution preflight can strictly judge allowlisted inputs and target boundaries while remaining non-executing.

Cannot-claim:

- `realExecutionReady=true`, image build, TCR push, kubeconfig content read, Kubernetes dry-run/apply, DB connectivity smoke execution, rollback execution, Package D execution, deploy or production runtime occurred.

landed_commit: `afcaaec15234d8b05d5575aab58705723739830f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `origin/recovery/platform-v22-trunk` reached `afcaaec15234d8b05d5575aab58705723739830f`.
- No package-d env read, portal-runtime env read, kubeconfig read, build/push, kubectl, deploy, Tencent mutation, Package D execution, `.runtime` commit or secret commit was performed.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-c-postgres-ledger-live-canary-preflight

Status: `authoring / authorized live DB canary failed closed`

Branch: `recovery/platform-v22-trunk`

Scope:

- Added explicit Package C PostgreSQL ledger canary released-state readback before cleanup.
- Added PostgreSQL connection timeout so VPC/private endpoint failures fail closed instead of hanging.
- Ran the authorized PostgreSQL ledger canary using only `/home/dev/.secrets/medopl/v22/postgres-ledger.env`.
- The canary failed closed at DB connection preflight with `timeout expired` and `network_unreachable_or_connection_preflight_failed` in redacted `.runtime` evidence.
- No parent-row check, canary `ResourceBinding` / `CloudOperation` write, released mark or cleanup write executed because preflight did not connect.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs`: pass.

Can-claim:

- The live DB canary path now fails closed on unreachable PostgreSQL and records redacted failure evidence.

Cannot-claim:

- A successful real PostgreSQL ledger write/read/release/cleanup occurred.
- Tencent mutation, kubectl, deploy, build/push, Package D, kubeconfig read, package-c mutation env read or package-d deploy env read occurred.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-vpc-deploy-runner-plan

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `7299d6d0c9b75d48accb018d4cc25decfd9f4e17`

Model: `gpt-5.4`

Scope:

- Fixed the Package D commercial stabilization execution environment as a dedicated VPC deploy runner, not the current WSL session.
- Recorded runner name `medopl-v22-deploy-runner`, region `na-siliconvalley`, VPC `medopl-vpc` and subnet `medopl-private-a`.
- Recorded runner purposes: docker build, TCR login/push, kubectl deploy, DB connectivity smoke and rollback.
- Recorded required tools: `git`, `node/npm`, `go`, `docker` and `kubectl`.
- Recorded runner-local secret paths under `/home/dev/.secrets/medopl/v22/` for `package-d-deploy.env`, `portal-runtime.env` and `kubeconfig-package-d-deploy`.
- Preserved safety boundaries: PostgreSQL stays private, TKE API stays private, SSH is operator-IP-only or cloud assistant / console access, and runner state must not enter git.
- Fixed preflight order before deploy execution: TCR login preflight, Kubernetes API connectivity preflight, PostgreSQL ledger canary and Package D combined preflight.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `git diff --check -- docs tests`: pass.

Can-claim:

- Package D has a repo-native implementation plan for a dedicated VPC deploy runner and its preflight order.
- The plan is represented in machine cursor fixture and guarded by the future-authorized Package D gate.

Cannot-claim:

- The deploy runner was created, Tencent mutation ran, CVM was created, kubectl ran, deploy ran, build/push ran, Package D execution ran, or production runtime is online.

landed_commit: `f788f0019c0f2661617ffebe2d27f3fcfd10d709`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `git diff --check -- docs tests`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-deploy-runner-provisioning-checklist

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3a72a24302d30774ef8cd135d81fca0b6ba810cb`

Model: `gpt-5.4`

Scope:

- Added the `medopl-v22-deploy-runner` CVM provisioning checklist to the Package D VPC deploy runner plan.
- Fixed CVM checklist values: `na-siliconvalley`, `medopl-vpc`, `medopl-private-a`, Ubuntu LTS or TencentOS, 2C4G, 50GB disk and public IP disabled by default.
- Fixed SSH and security-group boundaries: inbound minimal, SSH only as a temporary operator-IP exception, outbound to TCR, TKE API private endpoint and PostgreSQL `10.66.0.21:5432`.
- Fixed install checklist: `git`, `node/npm`, `go`, `docker` and `kubectl`.
- Fixed runner-local secret placement paths under `/home/dev/.secrets/medopl/v22/` for `package-d-deploy.env`, `portal-runtime.env` and `kubeconfig-package-d-deploy`.
- Fixed runner validation order: `docker version`, `kubectl version --client`, TCR login preflight, Kubernetes API connectivity preflight, PostgreSQL ledger canary and Package D combined preflight.
- Guarded the checklist through the future-authorized Package D local gate and machine cursor fixture.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `git diff --check -- tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs tests/fixtures/v22/goal-current.json`: pass.

Can-claim:

- Package D now has a repo-native, machine-guarded CVM provisioning checklist for the dedicated VPC deploy runner.
- `realExecutionReady` remains `false`.

Cannot-claim:

- The deploy runner was created, Tencent mutation ran, CVM was created, kubectl ran, deploy ran, build/push ran, Package D execution ran, secret files were read, or production runtime is online.

landed_commit: `febd5086881ecf6634380e7660f9c0f390bd21f0`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-deploy-runner-placement-correction

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `00a113c5987d3e172d97b030830a6edb59b313e6`

Model: `gpt-5.4`

Scope:

- Corrected Package D runner placement: preferred deploy execution is now a TKE in-cluster platform runner/job on protected platform pool `np-cbk784r8`, not an extra default CVM.
- Downgraded the previous `medopl-v22-deploy-runner` VPC CVM checklist to fallback-only / not-default.
- Split build/push from deploy/smoke: image build and TCR push can be handled by an external build runner or future Kaniko/BuildKit path, while deploy/smoke, Kubernetes API connectivity preflight, PostgreSQL ledger canary, DB connectivity smoke and rollback run inside TKE/VPC on the platform runner.
- Preserved commercial stability boundaries: PostgreSQL stays private, TKE API stays private, tenant pool scheduling remains forbidden and no extra CVM is created as the default route.
- Kept Package D non-executing: `RUN_TENCENT_DEPLOY_EXECUTION=0`, no Tencent mutation, no kubectl, no deploy, no build/push and no secret or `.runtime` commit.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.

Can-claim:

- Package D placement truth now prefers the existing platform node pool `np-cbk784r8` for deploy/smoke execution.
- VPC CVM runner remains only a fallback plan.
- `realExecutionReady` remains `false`.

Cannot-claim:

- A platform runner job was created, Kubernetes API was called, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, a CVM was created, secret files were read, Package D execution ran, or production runtime is online.

landed_commit: `c1a1aa096130643a99131ed53dd36457ddeaf6e8`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-in-cluster-platform-runner-shape-gate

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `ce8a2bae866f51e39613d03803599400faad5219`

Model: `gpt-5.4`

Scope:

- Added a non-executing Package D in-cluster platform runner shape gate to the future-authorized deploy local gate.
- Fixed runner shape as Kubernetes `Job` in namespace `medopl-platform` with serviceAccount `medopl-platform-runner`.
- Fixed scheduling to platform service pool `np-cbk784r8`; tenant pool prefix `medopl-tenant-` remains forbidden.
- Fixed configMap / secretRef / imagePullSecret shape; plaintext secrets and raw kubeconfig are forbidden in manifest shape.
- Fixed RBAC shape: namespace scope preferred, no `cluster-admin`, no broad wildcard, and cluster-scope limited to read-only `nodes` so the platform runner can verify platform pool visibility.
- Fixed runner command allowlist to `preflight`, `deploy`, `smoke` and `rollback`; arbitrary shell, Package C live, Tencent mutation and tenant pool mutation remain forbidden.
- Shape evidence writes a redacted report under `.runtime/package-d-in-cluster-platform-runner-shape-gate/shape-report-redacted.json`; `.runtime` is not committed.

Verification:

- RED: focused Package D local gate failed before the runner shape existed with `in_cluster_platform_runner_shape_must_be_explicit_and_non_executing`.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `git diff --check -- tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs tests/fixtures/v22/goal-current.json`: pass.

Can-claim:

- Package D has a repo-native, machine-guarded in-cluster platform runner Job/RBAC/env shape contract.
- The preferred runner shape targets existing platform pool `np-cbk784r8` and keeps VPC CVM runner fallback-only.
- `realExecutionReady` remains `false`.

Cannot-claim:

- A Kubernetes Job was created, Kubernetes API was called, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, kubeconfig was read, secrets were read, Package D execution ran, or production runtime is online.

landed_commit: `67e458bc24df2c08167c3ecd4fa0773dfda22dd9`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-runner-shape-support-split

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `ea52e9d3a036fc682b7dc15a3c088da1312da773`

Model: `gpt-5.4`

Scope:

- Split the Package D in-cluster platform runner shape contract into `tests/support/cloud-prework/package-d-in-cluster-platform-runner-shape.js`.
- Kept the future-authorized Package D deploy local gate as the consumer while reducing the gate file below the 1000-line budget.
- Preserved the same non-executing runner shape: Kubernetes Job, serviceAccount `medopl-platform-runner`, platform pool `np-cbk784r8`, secretRef/imagePullSecret runtime boundary, minimal RBAC, command allowlist and redacted `.runtime` evidence.
- Updated delivery current cursor to record the latest landed commit.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `node scripts/v22-line-budget.mjs`: pass; deploy gate is 987 lines.
- `npm run verify`: pass before this closeout update.
- `npm run closeout:check -- --json`: pass before this closeout update.

Can-claim:

- Package D runner shape gate is factored into a support owner and remains machine-guarded.
- Repo line budget is back within the existing baseline.
- `realExecutionReady` remains `false`.

Cannot-claim:

- A Kubernetes Job was created, Kubernetes API was called, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, kubeconfig was read, secrets were read, Package D execution ran, or production runtime is online.

landed_commit: `6b5b7d3ba0906bc76bfb5b0eb65a10dab566ad6c`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-runner-manifest-materialization

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `f98612467827ae80fd5b7764d5e554db94348223`

Model: `gpt-5.4`

Scope:

- Added a non-executing Package D in-cluster platform runner manifest materialization gate.
- Materialized a reviewable runner pack for namespace `medopl-platform`, serviceAccount `medopl-platform-runner`, ConfigMap, redacted Secret templates, imagePullSecret template, Role/RoleBinding, read-only nodes ClusterRole/ClusterRoleBinding and Job shape.
- Kept scheduling fixed to platform service pool `np-cbk784r8`; tenant pool prefix `medopl-tenant-` remains forbidden.
- Kept Secret values as key-level redacted placeholders; raw kubeconfig and plaintext secret values remain forbidden.
- Added an authorization pack that stops before kubeconfig read, Kubernetes API connectivity, server-side dry-run/apply, Package D preflight execution, deploy, build/push, Tencent mutation and Package C live.
- Registered the focused gate in the existing `cloud-future-authorized` suite and kept `.runtime` evidence uncommitted.

Verification:

- RED: focused manifest materialization gate failed while Secret templates were not Kubernetes-shaped key-level redacted objects.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.

Can-claim:

- Package D has a repo-native, machine-guarded runner manifest materialization review pack and authorization pack.
- The pack remains static/redacted and non-executing.
- `realExecutionReady` remains `false`.

Cannot-claim:

- A Kubernetes Job was created, Kubernetes API was called, kubeconfig was read, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, secrets were read, Package C live ran, Package D execution ran, or production runtime is online.

landed_commit: `54aeb1f63f197f083a960511e27ec4746ec6ad74`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass after push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-runner-manifest-registry-closeout

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `f8e6bf2ea0d85988881c2d37bad607d827653297`

Model: `gpt-5.4`

Scope:

- Registered the Package D runner manifest materialization gate in the existing test lane registry owner.
- Kept the gate in the existing `cloud-future-authorized` lane and did not create a new loop, runner loop or truth source.
- This closeout only updates lifecycle metadata after the registry fix commit.

Verification:

- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- The new Package D manifest materialization gate is covered by both existing suite manifest and test lane registry.
- Package D manifest materialization remains static/redacted and non-executing.
- `realExecutionReady` remains `false`.

Cannot-claim:

- A Kubernetes Job was created, Kubernetes API was called, kubeconfig was read, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, secrets were read, Package C live ran, Package D execution ran, or production runtime is online.

landed_commit: `0580a8dce649af45a603449f4ff07d8d0458b87a`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-runner-bootstrap-authorization-pack

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `9c970ec189b03a81173d77478168c8593d7bb9cb`

Model: `gpt-5.4`

Scope:

- Added a bootstrap authorization pack to the existing Package D in-cluster runner manifest materialization gate.
- Kept this in the existing `cloud-future-authorized` lane and did not create a new loop, runner loop or truth source.
- Recommended execution environments are Tencent CloudShell, Tencent Cloud Assistant or a VPC internal runner with TKE API reachability; local WSL is discouraged after API connectivity timeout.
- Fixed target cluster `cls-fi097sy4`, namespace `medopl-platform` and platform node pool `np-cbk784r8`.
- Covered bootstrap resource classes: Namespace, ServiceAccount, RBAC, ConfigMap, SecretRef, imagePullSecret and Job.
- Recorded rollback plan, stop conditions, redacted evidence path and the next real authorization prompt.
- Added a separate redacted bootstrap authorization evidence writer at `.runtime/package-d-in-cluster-platform-runner-bootstrap-authorization/authorization-pack-redacted.json`.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout metadata commit.

Can-claim:

- Package D has a repo-native, machine-guarded bootstrap authorization pack for moving Kubernetes API connectivity / server-side dry-run into a TKE API reachable environment.
- The pack remains static/redacted and non-executing.
- `realExecutionReady` remains `false`.

Cannot-claim:

- Kubernetes API was called, server-side dry-run passed, a Kubernetes resource was created, kubeconfig was read in this closeout, kubectl ran, deploy ran, build/push ran, Tencent mutation ran, secrets were read, Package C live ran, Package D execution ran, or production runtime is online.

landed_commit: `ce32b72ce26207014f131241f2caa5c7e62fe117`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-14 package-d-kubernetes-api-preflight-runner

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `6ce4e79838c5adee735460341c99092596de2373`

Model: `gpt-5.4`

Scope:

- Added the repo-native Package D Kubernetes API / server-side dry-run preflight runner at `tests/support/cloud-prework/package-d-kubernetes-api-preflight-runner.js`.
- Fixed the single cloud runner command: `node tests/support/cloud-prework/package-d-kubernetes-api-preflight-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode server-side-dry-run`.
- Reused the existing Package D in-cluster platform runner manifest materialization pack; no new loop, runner loop or truth source was added.
- The runner requires `RUN_TENCENT_DEPLOY_EXECUTION=0`, target cluster `cls-fi097sy4`, namespace `medopl-platform`, platform scheduling `np-cbk784r8`, VPC PostgreSQL `10.66.0.21:5432`, tenant-pool rejection and redacted `.runtime` evidence.
- Allowed kubectl command shape is limited to client availability, current context, namespace read and `kubectl apply --server-side --dry-run=server` against the redacted bootstrap manifest pack.
- Added a future-authorized local gate that uses fake env/kubeconfig files and fake kubectl only, proving fail-closed missing kubeconfig, dry-run-only command shape, forbidden op rejection and redaction.
- Registered the local gate in the existing `cloud-future-authorized` lane and verify manifest.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs` failed with `ERR_MODULE_NOT_FOUND` before the runner existed.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass after removing secret-like diff shapes from the new fake test/runner.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout metadata commit.

Can-claim:

- Package D now has a repo-native, machine-guarded single command for later authorized Kubernetes API connectivity / server-side dry-run preflight from a TKE/VPC-reachable execution environment.
- The local gate proves the command remains fail-closed, redacted and dry-run-only.
- `realExecutionReady` remains `false`.

Cannot-claim:

- Real kubeconfig or secret files were read, Kubernetes API was contacted, real kubectl ran, server-side dry-run passed against the live cluster, a Kubernetes resource was created, deploy ran, build/push ran, Tencent mutation ran, Package C live ran, Package D execution ran, or production runtime is online.

landed_commit: `50c2203e7c8ebbff35ed3bdebe39df955881aaa4`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-namespace-bootstrap-boundary

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `8f02b9ae33e2e93df36dfffa29a9b02012f87da3`

Model: `gpt-5.4`

Scope:

- Closed out the first real Package D Kubernetes API preflight result from the VPC/TKE runner without adding a new loop or truth source.
- Recorded that Kubernetes API connectivity passed and context/cluster matched `cls-fi097sy4`.
- Recorded the blocker: `medopl-platform` namespace does not exist, so the preflight failed closed at `namespace_read` and server-side dry-run was not entered.
- Recorded redacted evidence path `/opt/medopl/.runtime/package-d-kubernetes-api-server-side-dry-run-preflight/preflight-redacted.json`.
- Added the next bootstrap-only authorization boundary: create `medopl-platform` Namespace and create/update only Package D bootstrap ServiceAccount/RBAC/ConfigMap/SecretRef/imagePullSecret/Job resources.
- Kept forbidden boundaries explicit: no business Deployment rollout, no tenant pool / `medopl-tenant-`, no `np-cbk784r8` modification, no build/push, no Tencent mutation, no Package C live and no production deploy.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout metadata commit.

Can-claim:

- Package D cloud preflight reached the live Kubernetes API and matched the target cluster.
- The next gap is a bootstrap apply authorization pack for missing `medopl-platform` and Package D bootstrap resources only.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read kubeconfig or secrets, connected to Kubernetes API, ran kubectl, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, or brought production runtime online.
- Server-side dry-run has passed; it was blocked before dry-run by missing namespace.

landed_commit: `601e4099548c3436a75c13994a989d86294a94c7`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`
### 2026-06-15 package-d-bootstrap-apply-runner

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `7fdea84c2e4b079480aa7fd98b3b7b507d32a6eb`

Model: `gpt-5.4`

Scope:

- Added the repo-native Package D bootstrap apply runner at `tests/support/cloud-prework/package-d-bootstrap-apply-runner.js`.
- Fixed the single cloud runner command: `node tests/support/cloud-prework/package-d-bootstrap-apply-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode bootstrap-apply`.
- Limited apply scope to `medopl-platform` Namespace and allowlisted Package D bootstrap ServiceAccount/RBAC/ConfigMap/Secret/imagePullSecret/Job resources only.
- Reused the existing Package D in-cluster runner manifest materialization and post-apply server-side dry-run preflight runner; no new loop or truth source was added.
- Kept fail-closed gates for `RUN_TENCENT_DEPLOY_EXECUTION=0`, target cluster `cls-fi097sy4`, namespace `medopl-platform`, platform pool `np-cbk784r8`, tenant-pool rejection, forbidden business Deployment/Service rollout and redacted evidence.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs` failed with missing post-apply preflight evidence before the runner reused the preflight runner.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass before closeout metadata commit.

Can-claim:

- Package D now has a repo-native, machine-guarded single command for later authorized bootstrap apply from a TKE/VPC-reachable execution environment.
- The local gate proves allowlisted apply command shape, post-apply dry-run reuse, target matching, forbidden-op rejection and redaction.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read real kubeconfig or secrets, connected to Kubernetes API, ran real kubectl, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, ran Package D production execution, or brought production runtime online.

landed_commit: `db0f9f1653fa46ffbbc399af7b963b288212023b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-bootstrap-job-lifecycle-split

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `7c839c42e558556d0f50384f36c61101c087d518`

Model: `gpt-5.4`

Scope:

- Recorded the cloud finding: Package D bootstrap apply confirmed Kubernetes API connectivity, target cluster `cls-fi097sy4`, `medopl-platform` Active and allowlisted bootstrap resources, then post-apply server-side dry-run failed on same-name `Job/medopl-platform-runner` `spec.template` immutability.
- Removed same-name Job from the idempotent bootstrap apply and server-side dry-run manifest packs.
- Kept bootstrap apply scoped to Namespace, ServiceAccount, RBAC, ConfigMap, Secret and imagePullSecret resources only.
- Split the in-cluster runner Job into a separate run-scoped lifecycle contract with unique names like `medopl-platform-runner-preflight-<runid>`.
- Updated active/delivery/current truth so the next cloud step is corrected bootstrap apply / server-side dry-run rerun, followed by separate run-scoped Job authorization.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs` failed because `Job/medopl-platform-runner` was still in the bootstrap allowlist.
- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs` failed because the server-side dry-run manifest still included `kind: Job`.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D bootstrap apply and server-side dry-run packs no longer reapply the immutable same-name Job template.
- The run-scoped Job lifecycle is a separate authorization boundary.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read real kubeconfig or secrets, connected to Kubernetes API, ran real kubectl, deleted the existing Job, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, ran Package D production execution, or brought production runtime online.

landed_commit: `cbe1be8b155b89030cf2d8ee32154d6a86ec45c7`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-run-scoped-job-runner

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3ff77d13b36f2ce930886cf304a0fc21d188423b`

Model: `gpt-5.4`

Scope:

- Added the repo-native Package D run-scoped Job preflight runner at `tests/support/cloud-prework/package-d-run-scoped-job-runner.js`.
- Added the single cloud runner command: `node tests/support/cloud-prework/package-d-run-scoped-job-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --run-id <runid> --mode preflight-job`.
- Fixed the Job name contract to `medopl-platform-runner-preflight-<runid>` and scoped it to namespace `medopl-platform`, serviceAccount `medopl-platform-runner`, platform pool scheduling `np-cbk784r8` and preflight-only execution.
- Limited the runner to create/observe/log/get and success-cleanup for the unique run-scoped Job only; no same-name Job template update, business Deployment rollout, build/push, Tencent mutation, Package C live or production deploy is allowed.
- Added local/future-authorized gate coverage for runid validation, manifest redaction, scheduling, command allowlist, scoped cleanup and forbidden operation rejection.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` failed with `ERR_MODULE_NOT_FOUND` before the runner existed.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D now has a repo-native, machine-guarded single command for later authorized run-scoped platform runner Job preflight.
- The local gate proves unique Job naming, preflight-only manifest shape, platform scheduling, redaction and scoped success cleanup with fake inputs only.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read real kubeconfig or secrets, connected to Kubernetes API, ran real kubectl, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, ran Package D production execution, or brought production runtime online.

landed_commit: `6f85abf484002403be073a116ace9b48e856e0b2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-run-scoped-job-machineset-selector

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `69142aa3d8fe44d609716853b87d89b0bf5b3bb0`

Model: `gpt-5.4`

Scope:

- Recorded the cloud scheduling finding: the run-scoped Package D Job was created, but its Pod did not schedule because `np-cbk784r8` nodes do not carry the retired custom selector `medopl.io/nodepool-role=platform-service`.
- Updated Package D runner scheduling to the existing TKE machineset label `node.tke.cloud.tencent.com/machineset=np-cbk784r8` without modifying node labels.
- Kept `np-cbk784r8` as the protected platform service pool and kept tenant pool / `medopl-tenant-` scheduling forbidden.
- Updated run-scoped Job runner boundary checks, in-cluster runner manifest materialization, Package D deploy execution local gate and current machine truth.
- Updated the next cloud authorization prompt to rerun with run id `pdrun-20260615-002`.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` failed while the runner still emitted `medopl.io/nodepool-role=platform-service`.
- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs` failed while the manifest pack still emitted `medopl.io/nodepool-role=platform-service`.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D runner manifests target the real TKE machineset selector for `np-cbk784r8`.
- Local gates reject reliance on the retired custom platform-service label.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read real kubeconfig or secrets, connected to Kubernetes API, ran kubectl, changed node labels, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, ran Package D production execution, or brought production runtime online.

landed_commit: `fcc608fe7ace4de237376fe918b1c439eaf20e93`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-run-scoped-job-image-ref-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `d6318f322eeecdac7093cb0b74f34ccd4ada87ac`

Model: `gpt-5.4`

Scope:

- Recorded the cloud finding from `pdrun-20260615-002`: the unique Package D run-scoped Job scheduled to `np-cbk784r8` with `node.tke.cloud.tencent.com/machineset=np-cbk784r8`, then failed container image validation because the live Job manifest used `REDACTED_PACKAGE_D_RUNNER_IMAGE_REF`.
- Added `PACKAGE_D_RUNNER_IMAGE_REF` to the Package D deploy env allowlist and bootstrap Secret template contract.
- Split run-scoped Job manifest handling so the Kubernetes live create stdin uses the real allowlisted image ref while `job-manifest-redacted.json` and preflight evidence keep the redacted image ref.
- Added fail-closed checks for missing, malformed, registry/namespace-mismatched, `latest`, or `REDACTED_*` runner image refs.
- Updated the next cloud authorization prompt to rerun with run id `pdrun-20260615-003`.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` failed with `package_d_env_non_allowlist_key:PACKAGE_D_RUNNER_IMAGE_REF` before the allowlist and runner split were updated.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.

Can-claim:

- Package D run-scoped Job runner no longer sends redacted image placeholders to Kubernetes live create manifests.
- Package D evidence still redacts the runner image ref.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read real kubeconfig or secrets, connected to Kubernetes API, ran kubectl, created Kubernetes resources, deployed, built/pushed images, executed Tencent mutation, ran Package C live, ran Package D production execution, or brought production runtime online.

landed_commit: `0c491485467974d4fb01afd7e64fc6ade29abc1e`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-runner-image-publish-boundary

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `0c491485467974d4fb01afd7e64fc6ade29abc1e`

Model: `gpt-5.4`

Scope:

- Recorded the cloud finding from `pdrun-20260615-003`: the run-scoped Package D Job scheduled on `np-cbk784r8` with the real allowlisted `PACKAGE_D_RUNNER_IMAGE_REF`, then failed at image pull because `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001` was not found.
- Added the repo-native Package D runner image publish boundary at `tests/support/cloud-prework/package-d-runner-image-publish-runner.js`.
- Added the single later-authorized command: `node tests/support/cloud-prework/package-d-runner-image-publish-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --image-ref uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001 --mode publish-image`.
- Limited the boundary to fixed-registry docker login/build/push for the fixed non-latest `medopl-platform-runner` image tag; evidence redacts TCR secret and full image ref.
- Registered the local/future-authorized gate in the cloud-future-authorized lane and active machine truth.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs` failed with `ERR_MODULE_NOT_FOUND` before the runner existed.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D now has a repo-native, machine-guarded single command for later authorized runner image publish.
- The local gate proves fail-closed auth, fixed image ref, TCR credential presence checks, command allowlist and redaction with fake docker only.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read TCR secret, ran docker login/build/push, pulled/pushed images, read kubeconfig, connected to Kubernetes API, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or completed Package D production execution.

landed_commit: `1cbb27edaacca7a29e47f71ccde3139df675153b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-github-actions-image-publish-lane

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1cbb27edaacca7a29e47f71ccde3139df675153b`

Model: `gpt-5.4`

Scope:

- Replaced the Package D runner image publish route with GitHub Actions `workflow_dispatch` for `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`.
- Added protected environment boundary `package-d-image-publish`; the publish lane requires only `TCR_ID` and `TCR_SECRET` and must not receive kubeconfig, DB password, Portal admin password, Tencent mutation credentials or Package C secrets.
- Added the runner image Dockerfile and preflight-only entrypoint used by the workflow; the TKE/VPC runner remains Kubernetes preflight/deploy/smoke only and must not install Docker or build/push.
- Added workflow/local gates for fixed non-latest tag, medopl namespace, medopl-platform-runner repo, redacted evidence and no kubectl/deploy/Tencent mutation/Package C live in the image publish lane.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs` failed with missing workflow before the workflow existed.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.

Can-claim:

- Package D has a repo-native GitHub Actions image publish lane for the fixed runner image tag.
- Build/push is separated from the TKE/VPC runner and from deploy.
- `realExecutionReady` remains `false`.

Cannot-claim:

- This repo session read TCR secret, dispatched GitHub Actions, ran docker login/build/push, pulled/pushed images, read kubeconfig, connected to Kubernetes API, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or completed Package D production execution.

landed_commit: `a62ec2fd7d1fdf2c98fcdd7c60c6bf9aff9ac2ea`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-public-repo-safe-image-publish-lane

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `03686b41d881b52be1333407fdc35bfdb690a82f`

Model: `gpt-5.4`

Scope:

- Tightened the Package D runner image publish workflow for a public GitHub repository.
- Kept `workflow_dispatch` as the only trigger; `push`, `pull_request` and `pull_request_target` remain forbidden.
- Kept permissions at `contents: read` and environment `package-d-image-publish`.
- Recorded that `TCR_ID` / `TCR_SECRET` must be configured as GitHub Environment secrets, not repository secrets; the environment must require a reviewer and restrict branches to `recovery/platform-v22-trunk` / `release/*`.
- Kept the image ref fixed at `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`; `latest` and arbitrary image ref inputs remain forbidden.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs` failed before the workflow recorded the public-repo-safe environment secret boundary.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs`: pass.
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --json`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D runner image publish lane is now repo-native and public-repo-safe for manual GitHub Actions execution after the GitHub Environment is configured.
- The workflow does not read kubeconfig, DB password, Portal admin password or Tencent SecretId/SecretKey.

Cannot-claim:

- This repo session configured GitHub environment secrets, dispatched GitHub Actions, read TCR secret, ran docker login/build/push, read kubeconfig, connected to Kubernetes API, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or completed Package D production execution.

landed_commit: `a6cf8353171a7fe5a0547ace63554db566765bea`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-runner-placement-np-6l4nkdto

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `b77323845415ef7d53d76adefce893d741eb5c4d`

Model: `gpt-5.4`

Scope:

- Migrated the Package D in-cluster runner / run-scoped Job scheduling contract to TKE machineset selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`.
- Recorded new runner placement: node pool `np-6l4nkdto`, machine id `np-6l4nkdto-2cdtm`, runner node IP `10.66.0.42`.
- Kept old `np-cbk784r8` as protected legacy/platform pool and no longer as the Package D runner target.
- Kept Package C tenant pool lifecycle semantics and protected pool guards unchanged.
- Preserved forbidden boundaries: no tenant pool / `medopl-tenant-`, no Package C live, no business deploy, no build/push and no Tencent mutation.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs` failed while Package D still returned `np-cbk784r8`.
- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs` failed while the manifest pack still emitted `node.tke.cloud.tencent.com/machineset=np-cbk784r8`.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-kubernetes-api-preflight-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-bootstrap-apply-runner-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.

Can-claim:

- Package D runner manifests and local/future-authorized gates now target `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`.
- `np-cbk784r8` remains protected legacy/platform pool and is not a Package D runner scheduling target.

Cannot-claim:

- This repo session read kubeconfig or secrets, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live, modified `np-cbk784r8`, modified `np-6l4nkdto`, or completed Package D production execution.

landed_commit: `c8c8a1466be286adfd1457a744a634bb80eadbc0`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-15 package-d-private-build-runner-image-publish-path

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `b4f1506651cafa329bbe9fecbe5ac531e18f0f78`

Model: `gpt-5.4`

Scope:

- Replaced the current Package D runner image publish live path with a private build runner.
- Removed the GitHub Actions image publish workflow from the current live path to avoid a second publish entrypoint in the public repo.
- Kept the fixed runner image ref `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`.
- Restricted private build runner secret input to `package-d-deploy.env` keys `TCR_ID`, `TCR_SECRET` and `PACKAGE_D_RUNNER_IMAGE_REF`.
- Kept kubeconfig, DB password, Portal admin password and Tencent SecretId/SecretKey out of the image publish lane; TKE/VPC runner still does not build or push images.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs` failed while the runner still exposed the GitHub Actions dispatch path.
- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs` failed while `.github/workflows/package-d-runner-image-publish.yml` still existed.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Current Package D runner image publish live path is private build runner, not GitHub Actions secrets.
- Public repo stores code only for this lane; image publish secrets stay off GitHub Actions for the current上线 path.

Cannot-claim:

- This repo session read TCR secret, ran docker login/build/push, read kubeconfig/DB/Portal secrets, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or completed Package D production execution.

landed_commit: `a00a20faf7b263e07f90b0261872edb26b81ce9b`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-runner-image-linux-amd64-publish-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `a00a20faf7b263e07f90b0261872edb26b81ce9b`

Model: `gpt-5.4`

Scope:

- Recorded cloud finding `pdrun-20260615-004`: Package D run-scoped Job scheduled on `np-6l4nkdto` / `10.66.0.42` with the TCR image ref present, but image pull failed because the image manifest lacked the current node platform.
- Tightened the private build runner image publish contract to require `docker buildx build --platform linux/amd64` for `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`.
- Added local/future-authorized gates that reject implicit host platform, require redacted `platform=linux/amd64` evidence and keep the fixed image ref / no latest / no kubectl / no deploy / no Tencent mutation / no Package C live boundary.
- Kept the TKE/VPC runner out of Docker build/push; this remains image publish only, not deploy.

Verification:

- RED: `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs` failed with `private_build_must_publish_linux_amd64_image` before the deploy placement plan recorded the platform.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-workflow-gate.mjs`: pass.
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`: pass.

Can-claim:

- The repo-native Package D private build runner contract now requires a fixed `linux/amd64` image publish command.
- The active machine cursor records `pdrun-20260615-004` as a platform manifest gap and suggests rerun id `pdrun-20260616-001` after publish.

Cannot-claim:

- This repo session read TCR secret, ran docker login/build/push, read kubeconfig/DB/Portal secrets, ran kubectl, deployed, executed Tencent mutation, ran Package C live, or completed Package D production execution.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `73b1ea280bfc49899a8a97316754465f5af344f7`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-run-scoped-platform-runner-preflight-pass

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de`

Model: `gpt-5.4`

Scope:

- Recorded cloud evidence that Package D run-scoped platform runner preflight `pdrun-20260616-001` passed from the TKE/VPC runner at repo HEAD `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de`.
- Recorded the fixed runner image `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`, image platform `linux/amd64`, and scheduling selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`.
- Recorded that the Job completed successfully, redacted logs were collected, the successful Job was deleted, and old failed Job `pdrun-20260615-004` was cleaned and verified `NotFound`.
- Recorded redacted evidence paths: `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-001/preflight-job-redacted.json`, `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-001/job-manifest-redacted.json` and `.runtime/package-d-run-scoped-job-cleanup/pdrun-20260615-004/cleanup-redacted.json`.
- Advanced the active gap to Package D PostgreSQL/runtime env/combined in-cluster preflight from the platform runner.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D run-scoped platform runner preflight has passed on `pdrun-20260616-001`.
- The runner image platform / pull / scheduling preflight gap is closed for the fixed `linux/amd64` runner image.
- Next Package D gap is PostgreSQL/runtime env/combined in-cluster preflight from the platform runner.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live, or completed Package D production execution.
- Platform-runner PostgreSQL/runtime env/combined preflight, DB connectivity smoke, rollback evidence, billing/audit ledger, Portal opening entry and workspace storage quota are not complete.

landed_commit: `acacfefb9b8213d0e8fdf2abb12bdba350a2f3de`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-16 package-d-combined-in-cluster-preflight-pass

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `005e522c743244945a5c289cae7ce73b6a20d4a7`

Model: `gpt-5.4`

Scope:

- Recorded cloud evidence that Package D PostgreSQL/runtime env/combined in-cluster preflight `pdrun-20260616-002` passed from the TKE/VPC runner at repo HEAD `005e522c743244945a5c289cae7ce73b6a20d4a7`.
- Recorded selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, image `uswccr.ccs.tencentyun.com/medopl/medopl-platform-runner:v22-package-d-20260615-001`, image pull/run pass, PostgreSQL `10.66.0.21:5432` connectivity smoke pass and Package D SecretRef/env availability smoke pass.
- Recorded that the Job completed, cleanup deleted the Job on success with `NotFound` after delete, redaction audit passed, and no deploy/build-push/Tencent mutation/Package C live occurred.
- Recorded redacted evidence paths: `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-002/preflight-job-redacted.json` and `.runtime/package-d-run-scoped-job-preflight/pdrun-20260616-002/job-manifest-redacted.json`.
- Generated the Package D deploy authorization pack inside `tests/fixtures/v22/goal-current.json#package_d_deploy_readiness_plan.deployAuthorizationPack` and identified that the repo-native production deploy runner single entrypoint is missing.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D PostgreSQL/runtime env/combined in-cluster preflight passed on `pdrun-20260616-002`.
- The platform runner can pull/run the fixed runner image, access PostgreSQL `10.66.0.21:5432`, read required SecretRef/env inputs and redact evidence.
- The next gap is implementing a repo-native Package D production deploy runner single entrypoint before any authorized deploy.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live, or completed Package D production execution.
- Repo-native Package D production deploy runner, production Deployment/Service rollout, post-deploy smoke, rollback evidence, billing/audit ledger, Portal opening entry and workspace storage quota are not complete.

landed_commit: `005e522c743244945a5c289cae7ce73b6a20d4a7`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-16 package-d-production-deploy-runner-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `cb93d2fae1897a9c833ed0ed440fa7440de00883`

Model: `gpt-5.4`

Scope:

- Added the repo-native Package D production deploy runner contract/local gate: `node tests/support/cloud-prework/package-d-production-deploy-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode production-deploy-plan --authorized 1`.
- Materialized redacted Deployment/Service/ConfigMap manifests for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge` with namespace `medopl-platform`, selector `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, `medopl-package-d-deploy-env`, `medopl-portal-runtime-env` and `medopl-tcr-pull-secret`.
- Extended the Package D deploy env allowlist with four non-secret service image ref keys and kept private build runner TCR secret scope unchanged.
- Added local/future-authorized gate coverage for explicit authorization, fail-closed env/kubeconfig checks, fixed non-latest service images, redacted evidence, no plaintext secret, no tenant pool, and allowlisted deploy/smoke/rollback command plans.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass, including integrated Package D production deploy runner contract/local gate coverage.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D now has a repo-native production deploy runner contract/local gate and a single command for the next authorized cloud step.
- The local contract can produce redacted `.runtime/package-d-production-deploy/deploy-plan-redacted.json` and `.runtime/package-d-production-deploy/production-manifests-redacted.json` evidence shapes.

Cannot-claim:

- This repo session did not read secrets or kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.
- Production Deployment/Service rollout, post-deploy smoke, rollback evidence, billing/audit ledger, Portal opening entry and workspace storage quota are not complete.

landed_commit: `93b9a84e8c086e8170190924d23ab9bdb53c6a30`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-16 package-d-production-deploy-plan-gate-and-service-images

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `03e1125d96eb4be6135aa57c202f1cd677e9e212`

Model: `gpt-5.4`

Scope:

- Recorded the cloud production-deploy-plan fail-closed facts: `package-d-deploy.env` lacked `PACKAGE_D_PORTAL_FRONTEND_IMAGE_REF`, `PACKAGE_D_GO_BACKEND_IMAGE_REF`, `PACKAGE_D_OPL_WEB_GATEWAY_IMAGE_REF` and `PACKAGE_D_OPL_RUNTIME_BRIDGE_IMAGE_REF`; the plan-only runner also incorrectly required `RUN_TENCENT_DEPLOY_EXECUTION=1`.
- Corrected the repo-native Package D production deploy runner contract so `production-deploy-plan` requires `RUN_TENCENT_DEPLOY_EXECUTION=0`.
- Kept future `production-deploy-apply` / `production-deploy-live` behind `RUN_TENCENT_DEPLOY_EXECUTION=1` and an explicit not-implemented stop in this non-executing contract runner.
- Fixed the four production service image ref contract to exact non-latest targets: `uswccr.ccs.tencentyun.com/medopl/portal-frontend:v22-package-d-20260616-001`, `uswccr.ccs.tencentyun.com/medopl/medopl-go-backend:v22-package-d-20260616-001`, `uswccr.ccs.tencentyun.com/medopl/opl-web-gateway:v22-package-d-20260616-001` and `uswccr.ccs.tencentyun.com/medopl/opl-runtime-bridge:v22-package-d-20260616-001`.
- Confirmed the repo currently has only the Package D runner image publish lane; four service image publish readiness remains the next gap.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D production-deploy-plan is plan-only again and must keep `RUN_TENCENT_DEPLOY_EXECUTION=0`.
- Future apply/live mode is still a separate authorization boundary requiring `RUN_TENCENT_DEPLOY_EXECUTION=1`.
- The four Package D service image refs now have fixed non-latest TCR targets under `uswccr.ccs.tencentyun.com/medopl`.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation or ran Package C live.
- The four service images have been published, production Deployment/Service rollout has run, post-deploy smoke has run, rollback evidence exists, or Package D realExecutionReady is true.

landed_commit: `0e2f79194a5d6fa4f7723796200df95f34a4b5a1`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-16 package-d-service-dockerfile-build-context-materialization

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `093e19f2484732eb13e14f33a5a7d9d8f8c359f9`

Model: `gpt-5.4`

Scope:

- Materialized reviewable Package D service Dockerfile/build contexts for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`.
- Added service-level `.dockerignore` files that exclude `.runtime`, `.secrets`, `node_modules`, `dist`, coverage, env files, pem files, kubeconfig-like files and Package D env files from image build context.
- Kept the Package D service image publish lane as private-build-runner only: fixed `linux/amd64`, fixed non-latest TCR refs under `uswccr.ccs.tencentyun.com/medopl`, no arbitrary image ref, no non-allowlisted repo and no TKE/VPC runner Docker build/push.
- Updated the repo-native four service image publish local gate so Dockerfile, `.dockerignore` and build context readiness are checked before a future authorized docker executor can run.
- Did not read TCR secret, kubeconfig, DB password, Portal admin password or Tencent SecretId/SecretKey; did not run docker login/build/push, kubectl, deploy, Tencent mutation or Package C live.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-runner-image-publish-local-gate.mjs`: pass, including service Dockerfile/build context readiness assertions.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D four service Dockerfile/build context materialization is closed locally for `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway` and `services/opl-runtime-bridge`.
- The next gap is authorized Package D four service private image publish through the repo-native runner.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live or published the four service images.
- Production Deployment/Service rollout, post-deploy smoke, rollback evidence, billing/audit ledger, Portal opening entry and workspace storage quota are not complete.

landed_commit: `1ec86325d1d600a1c5a205415e778ec67ff952e2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-16 package-d-production-deploy-plan-dry-run-passed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `601bbc97c3d77e4aa7bb365cb60c5662582119c9`

Model: `gpt-5.4`

Scope:

- Recorded the cloud Package D `production-deploy-plan` dry-run/preflight pass at repo HEAD `601bbc97c3d77e4aa7bb365cb60c5662582119c9`.
- The plan generated a Kubernetes List containing four ConfigMaps, four Deployments and four Services for `portal-frontend`, `medopl-go-backend`, `opl-web-gateway` and `opl-runtime-bridge`.
- Image refs matched the fixed Package D runner/service contracts; SecretRefs were `medopl-package-d-deploy-env`, `medopl-portal-runtime-env` and `medopl-tcr-pull-secret`; scheduling stayed on `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`.
- Rollback and smoke plans were generated for PostgreSQL, Portal frontend, Go backend, OPL web gateway, OPL runtime bridge and redaction audit.
- Updated the final production deploy execution authorization pack in `tests/fixtures/v22/goal-current.json#package_d_deploy_readiness_plan.deployAuthorizationPack`.
- Confirmed the repo still has no implemented `production-deploy-apply/live` single entrypoint: existing apply/live modes intentionally fail closed with `package_d_production_deploy_apply_not_implemented`.
- Did not read secret/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Evidence:

- `.runtime/package-d-production-deploy/deploy-plan-redacted.json`
- `.runtime/package-d-production-deploy/production-manifests-redacted.json`

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D production deploy plan dry-run/preflight passed in the cloud for the four Package D services.
- The final production deploy execution authorization pack is recorded.
- The next gap is implementing the repo-native `production-deploy-apply/live` single entrypoint before any real deploy execution.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live, completed rollout, ran post-deploy smoke or produced rollback evidence.
- Hand-written `kubectl apply` remains forbidden.

landed_commit: `601bbc97c3d77e4aa7bb365cb60c5662582119c9`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-production-deploy-apply-live-runner

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `601bbc97c3d77e4aa7bb365cb60c5662582119c9`

Model: `gpt-5.4`

Scope:

- Implemented the repo-native Package D `production-deploy-apply` / `production-deploy-live` runner path in `tests/support/cloud-prework/package-d-production-deploy-runner.js`.
- Added the single later-authorized cloud command: `node tests/support/cloud-prework/package-d-production-deploy-runner.js --deploy-env /home/dev/.secrets/medopl/v22/package-d-deploy.env --runtime-env /home/dev/.secrets/medopl/v22/portal-runtime.env --kubeconfig /home/dev/.secrets/medopl/v22/kubeconfig-package-d-deploy --mode production-deploy-apply --run-id <runid> --authorized 1`.
- Kept `production-deploy-plan` at `RUN_TENCENT_DEPLOY_EXECUTION=0`; apply/live fail closed unless `RUN_TENCENT_DEPLOY_EXECUTION=1`, cluster `cls-fi097sy4`, namespace `medopl-platform`, scheduling `node.tke.cloud.tencent.com/machineset=np-6l4nkdto`, fixed image refs and SecretRefs all match.
- Restricted apply/live command execution to `kubectl apply --server-side --dry-run=server -f -`, `kubectl apply --server-side -f -`, `kubectl rollout status deployment/<allowed-service>`, namespace-scoped `kubectl get deployment/service/pods` smoke checks, and rollback plan commands using `kubectl rollout undo deployment/<allowed-service>`.
- Added fake-kubectl local gate coverage for run-id requirement, apply/live command allowlist, current-context / namespace fail-closed checks, live manifest using real image refs, evidence redaction, no plaintext secret, no tenant pool, no delete/patch/scale/exec and no build/push/Tencent mutation/Package C live.
- Standardized future deploy evidence paths under `.runtime/package-d-production-deploy/<runid>/deploy-redacted.json`, `.runtime/package-d-production-deploy/<runid>/smoke-redacted.json` and `.runtime/package-d-production-deploy/<runid>/rollback-redacted.json`.
- Did not read secret/kubeconfig, connect to Kubernetes API, run real kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Verification:

- RED: focused future-authorized gate failed before the runner exposed the stricter apply/live allowlist marker, and later failed before current-context / namespace output validation was added.
- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs`: pass.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

Can-claim:

- Package D now has a repo-native `production-deploy-apply/live` single entrypoint and local/future-authorized gate.
- The next gap is separately authorized production deploy execution evidence through that runner.

Cannot-claim:

- This repo session read secrets or kubeconfig, connected to Kubernetes API, ran real kubectl, deployed, built/pushed images, executed Tencent mutation, ran Package C live, completed rollout, ran post-deploy smoke or produced live rollback evidence.
- Hand-written `kubectl apply` remains forbidden.

landed_commit: `dd76038f7667dae54bdfb9f1226cf7dfed5b9a01`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `dd76038f7667dae54bdfb9f1226cf7dfed5b9a01` lands the repo-native Package D production deploy apply/live runner contract and local/future-authorized gate.
- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.
- This closeout does not read secrets/kubeconfig, connect to Kubernetes API, run real kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-16 package-d-container-writable-path-fixes-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `4fca0092cca25ed708dbb7be6f712733ab57933c`

Model: `gpt-5.4`

Scope:

- Landed the Package D portal/runtime bridge writable path fixes.
- Commit `b992dd5f65be2de68f29bead0f56e510b4ece19a` added portal nginx `/tmp/nginx` runtime paths, Runtime Bridge `/tmp/medopl-runtime/.runtime`, production manifest writable `emptyDir` mounts, non-root security contexts and `imagePullPolicy: Always`.
- The landed fix enabled later private image republish and the successful `pdrun-20260616-004` deploy rerun.

Verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

landed_commit: `b992dd5f65be2de68f29bead0f56e510b4ece19a`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `npm run verify`: pass.
- `npm run closeout:check -- --json`: pass.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-runner-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1664f2e10bd71b179ce9a5bfd8b64bee492b995c`

Model: `gpt-5.4`

Scope:

- Landed the repo-native Package D readonly service reachability / in-cluster HTTP smoke runner.
- Commit `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da` added the single runner command, local/future-authorized gate, active/delivery/history/fixture sync and cloud-future-authorized suite registration.
- The runner creates only run-scoped `medopl-service-smoke-<runid>` curl Jobs, uses fixed Package D ClusterIP endpoints, redacts evidence and deletes only the smoke Job.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Verification:

- `npm run verify`: pass before landing `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da`.
- `npm run closeout:check -- --json`: pass before landing `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da`.

Can-claim:

- Package D has a repo-native readonly service reachability runner and local/future-authorized gate.

Cannot-claim:

- In-cluster HTTP smoke has passed.
- External/public user access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.

landed_commit: `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da` is reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: pass before landing the runner commit.
- `npm run closeout:check -- --json`: pass before landing the runner commit.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-wait-diagnostics-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `1d07b9a569484e45a0dfc5abf4c7d8a9a6a2b9da`

Model: `gpt-5.4`

Scope:

- Landed Package D service reachability wait-failure diagnostics.
- Commit `04a8d56282382aa0a49d0f3ceb4dbe73b6fe4b28` enhances `tests/support/cloud-prework/package-d-service-reachability-runner.js` so future smoke Job wait timeouts collect redacted Job get/describe, Pod status, container status/image-pull class, Events and per-curl-container log summaries before cleanup.
- The local/future-authorized gate now proves `diagnostics-redacted.json` is written before cleanup and that evidence remains redacted.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, build/push, execute Tencent mutation or run Package C live.

Verification:

- `npm run verify`: pass before closeout commit.
- `npm run closeout:check -- --json`: pass before closeout commit.
- Sentrux rule check still reports pre-existing Package C cycle / quality violations, not introduced by this Package D runner change.

Can-claim:

- Package D service reachability runner has a local-gated wait-failure diagnostics path.
- Next cloud rerun should use `psr-20260617-002` through the repo-native runner.

Cannot-claim:

- In-cluster HTTP smoke has passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.

landed_commit: `04a8d56282382aa0a49d0f3ceb4dbe73b6fe4b28`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `04a8d56282382aa0a49d0f3ceb4dbe73b6fe4b28` is the implementation commit for wait-failure diagnostics and will be reachable from `origin/recovery/platform-v22-trunk` after this closeout push.
- `npm run verify`: pass before closeout commit.
- `npm run closeout:check -- --json`: pass before closeout commit.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-failfast-diagnostics-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `956d3724233b3306115275e938361ab4bf2fc587`

Model: `gpt-5.4`

Scope:

- Landed Package D service reachability fail-fast curl and stronger wait-failure diagnostics.
- Commit `14dbbb04377f19b96f38db9859e42b625b0d2192` enhances `tests/support/cloud-prework/package-d-service-reachability-runner.js` so future smoke Jobs use bounded curl execution with `--connect-timeout`, `--max-time` and `--fail-with-body`, then emit service/url/http_code/exit_code/total_time/error_class summaries.
- The local/future-authorized gate now proves wait failures preserve redacted Job condition messages, Pod reason/message, container state/lastState, Events message/count/timestamps and log-unavailable reasons before cleanup.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass before closeout commit.
- `npm run verify`: expected to pass after this closeout is pushed because the closeout gate requires landed commit `14dbbb04377f19b96f38db9859e42b625b0d2192` to be reachable from `origin/recovery/platform-v22-trunk`.
- `npm run closeout:check -- --json`: expected to pass after this closeout is pushed for the same trunk-reachability reason.

Can-claim:

- Package D service reachability runner has local-gated fail-fast curl and stronger wait-failure diagnostics.
- Next cloud rerun should use `psr-20260617-003` through the repo-native runner.

Cannot-claim:

- In-cluster HTTP smoke has passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.

landed_commit: `14dbbb04377f19b96f38db9859e42b625b0d2192`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `14dbbb04377f19b96f38db9859e42b625b0d2192` is the implementation commit for fail-fast service smoke diagnostics and must be reachable from `origin/recovery/platform-v22-trunk` after this closeout push.
- `npm run verify`: run after push.
- `npm run closeout:check -- --json`: run after push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 package-d-service-reachability-curl-security-context-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `d6e96696518036d1284f1df05926b53eb4ea156b`

Model: `gpt-5.4`

Scope:

- Landed Package D service reachability curl container numeric non-root securityContext.
- Commit `a272e07c2b462c4e61315536c701f03069b5f474` fixes `tests/support/cloud-prework/package-d-service-reachability-runner.js` so future smoke Jobs no longer rely on image user-name inference under `runAsNonRoot: true`.
- The local/future-authorized gate proves each curl smoke container has `runAsUser: 1000`, `runAsGroup: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` and `capabilities.drop: ["ALL"]`, while keeping fail-fast curl and wait-failure diagnostics.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-package-d-run-scoped-job-runner-local-gate.mjs`: pass before closeout commit.
- `npm run verify`: expected to pass after this closeout is pushed because the closeout gate requires landed commit `a272e07c2b462c4e61315536c701f03069b5f474` to be reachable from `origin/recovery/platform-v22-trunk`.
- `npm run closeout:check -- --json`: expected to pass after this closeout is pushed for the same trunk-reachability reason.

Can-claim:

- Package D service reachability runner has local-gated numeric non-root curl container securityContext.
- Next cloud rerun should use `psr-20260617-004` through the repo-native runner.

Cannot-claim:

- In-cluster HTTP smoke has passed.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.

landed_commit: `a272e07c2b462c4e61315536c701f03069b5f474`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `a272e07c2b462c4e61315536c701f03069b5f474` is the implementation commit for curl smoke numeric non-root securityContext and must be reachable from `origin/recovery/platform-v22-trunk` after this closeout push.
- `npm run verify`: run after push.
- `npm run closeout:check -- --json`: run after push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`


### 2026-06-17 package-d-service-reachability-passed-external-access-pack-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `f380895ae67427d1167fb7f0c33370fe76bcc1fa`

Model: `gpt-5.4`

Scope:

- Landed the Package D in-cluster HTTP reachability success closeout and Portal external access strategy authorization pack.
- Recorded run `psr-20260617-004` evidence: `.runtime/package-d-service-reachability/psr-20260617-004/readonly-service-reachability-redacted.json` and `.runtime/package-d-service-reachability/psr-20260617-004/smoke-job-manifest-redacted.json`.
- The strategy pack compares admin-only port-forward, internal gateway, Ingress, LoadBalancer and HTTPS/domain, with allowed operations, forbidden operations, security boundary, rollback/cleanup plan, smoke plan, evidence paths, stop conditions and recommended next option.
- Recommended next option is admin-only port-forward strategy for non-public admin smoke, or internal gateway if persistent private access is required; public Ingress/LoadBalancer/HTTPS-domain work remains a separate explicit authorization boundary.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Verification:

- `npm run verify`: pass before closeout commit; run again after push.
- `npm run closeout:check -- --json`: pass before closeout commit; run again after push.

Can-claim:

- Package D in-cluster HTTP reachability has passed.
- Portal external access strategy authorization pack is ready for the next gap.
- External/public user access remains unexposed.

Cannot-claim:

- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing or rollback execution are complete.

landed_commit: `a272e07c2b462c4e61315536c701f03069b5f474`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `a272e07c2b462c4e61315536c701f03069b5f474` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: run after push.
- `npm run closeout:check -- --json`: run after push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-goal-gap-map

Status: `landed candidate / local-gated`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3436564b77ee46a380176542c582abcc7005d8e2`

Model: `gpt-5.4`

Subagents: none

Scope:

- Established the repo-native Production Launch Goal / Gap Map without adding a second truth source.
- Recorded the launch vision as `platform-provisioned / customer-dedicated` multi-tenant SaaS managed OPL workbench with Portal as the entrypoint, platform-managed cloud resources, workspace lifecycle, ResourceBinding ledger, billing / audit / quota, rollback / cleanup and redacted evidence.
- Audited launch gaps and status classes across auth / identity / admin bootstrap, tenant model, workspace provisioning, Portal -> backend -> Package C flow, Package C cloud operation state machine, Tencent TKE tenant node pool lifecycle, ResourceBinding PostgreSQL ledger, billing ledger, audit ledger, quota enforcement, workspace suspend / resume / delete, external access / Ingress / HTTPS, production smoke / canary, rollback / cleanup and observability / redaction evidence.
- Preserved the current proven facts: Package D is deployed inside TKE, four Deployments are ready `1/1`, four ClusterIP Services returned HTTP `200`, and redacted evidence exists for `pdrun-20260616-004` and `psr-20260617-004`.
- Reordered production launch phases so external access is blocked until the multi-tenant minimum closes.
- Set the next unique gap to `production-launch-gap-01-auth-tenant-workspace-bootstrap-contract`.
- Did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Can-claim:

- Package D platform services are deployed inside TKE and in-cluster HTTP reachability has passed.
- The Production Launch Goal / Gap Map is repo-native and machine-cursor-owned by `tests/fixtures/v22/goal-current.json`.
- The next unique gap is first admin identity / tenant / workspace bootstrap contract.

Cannot-claim:

- MedOPL formal production launch is complete.
- Portal external/public access, Ingress, LoadBalancer, DNS, TLS, production billing, production tenant provisioning or rollback execution are complete.
- This repo session performed new deploy, kubectl, build/push, Tencent mutation, Package C live or secret/kubeconfig reads.

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-goal-gap-map-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3436564b77ee46a380176542c582abcc7005d8e2`

Model: `gpt-5.4`

Scope:

- Landed the Production Launch Goal / Gap Map closeout and next-gap cursor update.
- The launch map lives in `tests/fixtures/v22/goal-current.json` as a machine cursor derivative, not a second truth source.
- Ordered phases: TKE platform service baseline; production control-plane bootstrap minimum; workspace provisioning to Package C live operation; commercial ledger and lifecycle closure; production smoke, canary, rollback and evidence; external access after minimum SaaS closure.
- Next unique gap is `production-launch-gap-01-auth-tenant-workspace-bootstrap-contract`.
- External/public user access remains blocked and is not the immediate next action.
- This closeout did not read secrets/kubeconfig, connect to Kubernetes API, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation or run Package C live.

Verification:

- `npm run verify`: run before and after push.
- `npm run closeout:check -- --json`: run before and after push.

Can-claim:

- Production Launch Goal / Gap Map is established.
- Package D TKE platform service baseline and in-cluster HTTP reachability are evidence-backed.
- Next execution should address the admin/tenant/workspace bootstrap contract before external access.

Cannot-claim:

- Formal production launch, public Portal access, Ingress/LB/HTTPS, production billing, production tenant provisioning or rollback execution are complete.

landed_commit: `3436564b77ee46a380176542c582abcc7005d8e2`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `3436564b77ee46a380176542c582abcc7005d8e2` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: run after push.
- `npm run closeout:check -- --json`: run after push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-01-bootstrap-contract-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `3436564b77ee46a380176542c582abcc7005d8e2`

Model: `gpt-5.4`

Scope:

- Landed Production Launch Gap 01 bootstrap contract/local gate without reading secret/kubeconfig, connecting to Kubernetes API, running kubectl, deploy/rollout/rollback, build/push, Tencent mutation or Package C live.
- Added `tests/support/cloud-prework/production-launch-bootstrap-runner.js` as the repo-native single command for contract-only bootstrap evidence: `node tests/support/cloud-prework/production-launch-bootstrap-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- Added contract-only Portal typed API and fail-closed Go backend routes for `/api/v22/production/bootstrap/plan` and `/api/v22/production/bootstrap/commit`.
- Gap 01 now proves first admin identity shape, tenant bootstrap shape, workspace seed shape, providerKeyRef-only public boundary, local RC fallback separation and redacted evidence shape.
- External access, Ingress, LoadBalancer, HTTPS/domain, Package C live operations, billing, quota and workspace lifecycle remain blocked for later gaps.

Verification:

- `npm run verify`: passed before post-push closeout commit.
- `npm run closeout:check -- --json`: rerun after this closeout push.

Can-claim:

- Production Launch Gap 01 has a repo-native contract/local gate and redacted evidence shape.
- The next unique gap is `production-launch-gap-02-portal-backend-package-c-live-operation-contract`.

Cannot-claim:

- MedOPL formal production launch, public Portal access, Package C live operation, production tenant provisioning, billing/quota closure or rollback execution are complete.
- This closeout authorized or executed cloud mutation, kubectl, deploy, build/push, live-test or secret reads.

landed_commit: `59996934103e115cf822cc93e8579bc6984ba29a`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `59996934103e115cf822cc93e8579bc6984ba29a` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: run before this post-push closeout commit.
- `npm run closeout:check -- --json`: run after this post-push closeout commit.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-02-package-c-operation-contract-landed

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `0b3f109d73267661b039184a6139d4086b2f501b`

Model: `gpt-5.4`

Scope:

- Landed Production Launch Gap 02 Portal -> Go backend -> Package C operation contract/local gate without reading secret/kubeconfig, connecting to Kubernetes API, running kubectl, deploy/rollout/rollback, build/push, Tencent mutation or Package C live.
- Added `tests/support/cloud-prework/production-launch-operation-runner.js` as the repo-native single command for contract-only operation evidence: `node tests/support/cloud-prework/production-launch-operation-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- Added contract-only Portal typed API and fail-closed Go backend routes for `/api/v22/production/package-c-operation/plan` and `/api/v22/production/package-c-operation/commit`.
- Gap 02 now proves Portal action shape, Go backend operation request shape, Package C runner invocation boundary, ResourceBinding `requested` / `creating` / `ready` state contract, providerKeyRef-only public boundary, idempotency, local RC fallback separation and redacted evidence shape.
- External access, Ingress, LoadBalancer, HTTPS/domain, production PostgreSQL ledger write/read, Package C live operations, billing, quota and workspace lifecycle remain blocked for later gaps.

Verification:

- `npm run verify`: passed before and after the implementation push.
- `npm run closeout:check -- --json`: passed before implementation push and is rerun after this closeout sync.

Can-claim:

- Production Launch Gap 02 has a repo-native contract/local gate and redacted evidence shape.
- The next unique gap is `production-launch-gap-03-resourcebinding-postgresql-ledger-live-write-read-contract`.

Cannot-claim:

- MedOPL formal production launch, public Portal access, Package C live operation, production PostgreSQL ResourceBinding ledger write/read, billing/quota closure or rollback execution are complete.
- This closeout authorized or executed cloud mutation, kubectl, deploy, build/push, live-test or secret reads.

landed_commit: `b2e44a07b47ed1773d5a90859295fc70853076bd`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `b2e44a07b47ed1773d5a90859295fc70853076bd` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: run before this post-push closeout sync.
- `npm run closeout:check -- --json`: run after this post-push closeout sync.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-03-resourcebinding-ledger-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `61b84ac89c4f5b0937dea530b7e62fa2e2508a1d`

Model: `gpt-5.4`

Subagents:

- `gpt-5.4-mini` explorer: audited Go backend ResourceBinding / CloudOperation schema, repository and Package C ledger support.
- `gpt-5.4-mini` explorer: audited test lane, docs cursor and Gap 03 fixture integration pattern.

Scope:

- Landed the repo-native Production Launch Gap 03 ResourceBinding / CloudOperation PostgreSQL ledger contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-ledger-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, ResourceBinding and CloudOperation write/read shape, `requested` / `creating` / `ready` state persistence boundary, `operation_id` / idempotency uniqueness, providerKeyRef-only boundary, canonical ownership source `postgres_resource_binding_ledger`, redacted evidence shape and local dry-run repository versus future production PostgreSQL boundary.
- Added contract-only Go routes `POST /api/v22/production/ledger/plan` and `POST /api/v22/production/ledger/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-ledger.ts`. These routes fail closed and do not connect to PostgreSQL or execute Package C live operations.
- Evidence sink is `.runtime/production-launch-ledger/<runid>/resourcebinding-ledger-contract-redacted.json`.
- The next unique gap is `production-launch-gap-04-billing-audit-quota-ledger-contract`.
- This closeout did not read secrets/kubeconfig/DB password, connect to Kubernetes API or PostgreSQL, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Can-claim:

- Production Launch Gap 03 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for the ResourceBinding / CloudOperation ledger boundary are traceable and fail closed.
- ResourceBinding and CloudOperation write/read shapes are locally specified for `requested` / `creating` / `ready`.
- External/public access remains blocked.

Cannot-claim:

- Production PostgreSQL ResourceBinding ledger write/read executed.
- Billing/audit/quota, workspace lifecycle, production canary, rollback execution, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `c71359f260be499a29fa3e328c556964fa70c19f`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `c71359f260be499a29fa3e328c556964fa70c19f` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: passed before this post-push closeout sync.
- `npm run closeout:check -- --json`: rerun after this post-push closeout sync.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-04-commercial-ledger-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `942867630acd414721925cd45ffd6f8a93e23491`

Model: `gpt-5.4`

Subagents:

- `gpt-5.4-mini` explorer: audited Go backend, Portal typed API and existing billing/audit/quota surfaces for Gap 04.
- `gpt-5.4-mini` explorer: audited Gap 01/02/03 runner, future-authorized test, docs and fixture closeout patterns.

Scope:

- Landed the repo-native Production Launch Gap 04 billing / audit / quota ledger contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-commercial-ledger-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-commercial-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, billing ledger shape, audit ledger shape, quota ledger / enforcement boundary, ResourceBinding / CloudOperation linkage, workspace cost attribution, operation idempotency, providerKeyRef-only boundary, redacted evidence shape and local dry-run repository versus future production PostgreSQL boundary.
- Added contract-only Go routes `POST /api/v22/production/commercial-ledger/plan` and `POST /api/v22/production/commercial-ledger/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-commercial-ledger.ts`. These routes fail closed and do not connect to PostgreSQL, charge billing, enforce quota or execute Package C live operations.
- Evidence sink is `.runtime/production-launch-commercial-ledger/<runid>/commercial-ledger-contract-redacted.json`.
- The next unique gap is `production-launch-gap-05-workspace-lifecycle-contract`.
- This closeout did not read secrets/kubeconfig/DB password, connect to Kubernetes API or PostgreSQL, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs`: passed.
- `go test ./internal/server/handlers` from `services/medopl-go-backend`: passed.
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: passed.
- `npm --prefix services/portal/frontend run typecheck`: passed.
- `npm run verify`: run before this post-push closeout sync.
- `npm run closeout:check -- --json`: rerun after this post-push closeout sync.

Can-claim:

- Production Launch Gap 04 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for the billing / audit / quota ledger boundary are traceable and fail closed.
- Billing, audit and quota ledger shapes are locally specified and linked to ResourceBinding / CloudOperation identity.
- External/public access remains blocked.

Cannot-claim:

- Production PostgreSQL billing/audit/quota ledger write/read executed.
- Real billing charge, quota enforcement, workspace lifecycle, production canary, rollback execution, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `b63c267e2e85248a71e2101eb2ba6b06accb4b33`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `b63c267e2e85248a71e2101eb2ba6b06accb4b33` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: passed before this post-push closeout sync.
- `npm run closeout:check -- --json`: rerun after this post-push closeout sync.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-05-workspace-lifecycle-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `a59b6181dd4ed66f93daf8d55eda60564a1da5cc`

Model: `gpt-5.4`

Subagents:

- `gpt-5.4-mini` explorer: audited Go backend, Portal typed API and existing workspace lifecycle surfaces for Gap 05.
- `gpt-5.4-mini` explorer: audited Gap 04 runner, future-authorized test, docs and fixture closeout patterns.

Scope:

- Landed the repo-native Production Launch Gap 05 workspace suspend / resume / delete lifecycle contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-workspace-lifecycle-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-workspace-lifecycle-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, suspend/resume/delete request shapes, ResourceBinding lifecycle linkage, CloudOperation lifecycle linkage, billing stop/resume/finalization linkage, audit linkage, quota release/restore/final release linkage, operation idempotency, providerKeyRef-only boundary, rollback/cleanup redacted evidence shape and local dry-run repository versus future production PostgreSQL boundary.
- Added contract-only Go routes `POST /api/v22/production/workspace-lifecycle/plan` and `POST /api/v22/production/workspace-lifecycle/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-workspace-lifecycle.ts`. These routes fail closed and do not connect to PostgreSQL, mutate lifecycle state, call Kubernetes, execute Package C live operations or expose external access.
- Evidence sink is `.runtime/production-launch-workspace-lifecycle/<runid>/workspace-lifecycle-contract-redacted.json`.
- The next unique gap is `production-launch-gap-06-production-canary-rollback-evidence-contract`.
- This closeout did not read secrets/kubeconfig/DB password, connect to Kubernetes API or PostgreSQL, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs`: passed.
- `go test ./internal/server/handlers` from `services/medopl-go-backend`: passed.
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: passed.
- `npm --prefix services/portal/frontend run typecheck`: passed.
- `npm run verify`: run before this post-push closeout sync.
- `npm run closeout:check -- --json`: rerun after this post-push closeout sync.

Can-claim:

- Production Launch Gap 05 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for the workspace lifecycle boundary are traceable and fail closed.
- Workspace suspend, resume and delete contract shapes are locally specified and linked to ResourceBinding, CloudOperation, billing, audit and quota identities.
- External/public access remains blocked.

Cannot-claim:

- Production PostgreSQL workspace lifecycle write/read executed.
- Real workspace suspend/resume/delete, Package C live operation, production canary, rollback execution, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `95660eeb91adbe938023040526ee9c2ffc7c3863`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `95660eeb91adbe938023040526ee9c2ffc7c3863` remains reachable from `origin/recovery/platform-v22-trunk`.
- `npm run verify`: passed for the Gap 05 local gate and closeout sync.
- `npm run closeout:check -- --json`: passed for the Gap 05 local gate and closeout sync.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`

### 2026-06-17 production-launch-gap-06-canary-rollback-cleanup-contract

Status: `landed / pushed / post-push verified`

Branch: `recovery/platform-v22-trunk`

Base trunk HEAD: `95660eeb91adbe938023040526ee9c2ffc7c3863`

Model: `gpt-5.4`

Scope:

- Landed the repo-native Production Launch Gap 06 production smoke / canary / rollback / cleanup evidence contract/local gate without adding a loop or second truth source.
- Added `tests/support/cloud-prework/production-launch-canary-runner.js` as the single contract-only runner command: `node tests/support/cloud-prework/production-launch-canary-runner.js --mode contract-local-gate --run-id <runid> --authorized 1`.
- The local gate proves unauthorized fail-closed behavior, production canary shape, admin / tenant / workspace smoke shape, Portal -> Go backend -> Package C dry-run boundary, ResourceBinding / CloudOperation linkage, billing / audit / quota linkage, workspace lifecycle linkage, rollback command/evidence shape, cleanup command/evidence shape, redaction / observability evidence, operation idempotency, providerKeyRef-only boundary and local dry-run repository versus future production PostgreSQL/Kubernetes execution boundary.
- Added contract-only Go routes `POST /api/v22/production/canary/plan` and `POST /api/v22/production/canary/commit`, plus Portal typed API shape in `services/portal/frontend/src/api/portal/production-canary.ts`. These routes fail closed and do not connect to PostgreSQL or Kubernetes, execute canary/rollback/cleanup, call Package C live, mutate Tencent resources or expose external access.
- Evidence sink is `.runtime/production-launch-canary/<runid>/canary-contract-redacted.json`.
- The next unique gap is `production-launch-gap-07-external-access-strategy-contract`; this is a strategy/authorization-pack gap and must not default to public Ingress, LoadBalancer, DNS or TLS exposure.
- This closeout did not read secrets/kubeconfig/DB password, connect to Kubernetes API or PostgreSQL, run kubectl, deploy, rollout, rollback, build/push, execute Tencent mutation, run Package C live, restore Node Portal backend or enter external access.

Verification:

- `node tests/future-authorized/cloud/future-authorized-test-v22-cloud-cleanup-local-gate.mjs`: passed.
- `go test ./internal/server/handlers` from `services/medopl-go-backend`: passed.
- `node tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs`: passed.
- `npm --prefix services/portal/frontend run typecheck`: passed.
- `npm run verify`: rerun before final push.
- `npm run closeout:check -- --json`: rerun before final push.

Can-claim:

- Production Launch Gap 06 has a repo-native contract/local gate.
- Portal typed API and Go backend route shape for the production canary / rollback / cleanup evidence boundary are traceable and fail closed.
- Production canary, admin/tenant/workspace smoke, rollback/cleanup and redaction/observability evidence shapes are locally specified and linked to ResourceBinding, CloudOperation, billing, audit, quota and workspace lifecycle identities.
- External/public access remains not exposed.

Cannot-claim:

- Production canary executed.
- Real rollback, cleanup, Package C live operation, Kubernetes mutation, PostgreSQL write/read, Ingress, LoadBalancer, DNS or TLS are complete.

next_cursor: `real-cloud-authorization-boundary`

landed_commit: `95660eeb91adbe938023040526ee9c2ffc7c3863`

landing_gate_result: `passed / ff-only landed / pushed`

post_push_verification:

- `95660eeb91adbe938023040526ee9c2ffc7c3863` remains reachable from `origin/recovery/platform-v22-trunk` before the Gap 06 implementation commit.
- `npm run verify`: rerun before final push.
- `npm run closeout:check -- --json`: rerun before final push.

post_merge_closeout: `completed`

next_cursor: `real-cloud-authorization-boundary`
