# MedOPL Platform Framework

Owner: `MedOPL`
Purpose: `platform_framework_view`
State: `active_framework_view`
Machine boundary: 本文是人读 framework 模型入口，不是第二份 current truth、不是机器合同、不是生产证据。当前状态看 `docs/active/README.md`；合同/spec 看 `docs/specs/README.md`；证据等级看 `docs/evidence/README.md`；机器 cursor 和 verify manifest 看 `tests/fixtures/v22/*`。

## Framework Identity

MedOPL Platform Framework 是把 clean One Person Lab upstream 交付为 `platform-provisioned / customer-dedicated` OPL SaaS 托管科研工作台的平台框架。它不复制 One Person Lab 的 AI runtime 业务语义，不持有 OPL domain truth，不重写 OPL chatbot、agent、科研任务判断或 upstream 内部状态。

本 framework 持有的是 SaaS platform truth：

- Portal control plane
- OPL Web Gateway integration boundary
- Runtime Bridge / Runtime Agent projection boundary
- platform-managed resource lifecycle
- billing, freeze, audit and admin ops
- contract subscription, authorization, evidence and closeout discipline

## Imported Discipline From one-person-lab

本仓只吸收 one-person-lab 的 framework 组织纪律，不照抄它的 executor、family runtime、MAS/MAG/RCA、App/operator 或 AI domain 语义。

| Mechanism | MedOPL interpretation |
| --- | --- |
| rules before status | `docs/policies/README.md` 和 `docs/specs/README.md` 固定长期边界；`docs/active/README.md` 只描述当前状态。 |
| contract-light lower bound | specs 只保边界、安全、权限、字段、验收、blocker 和 cannot-claim，不写阶段流水。 |
| evidence-after-contract | smoke、proof、canary、live evidence 只证明限定范围，不能自动升级为 production truth。 |
| surface budget | 默认读面 summary-first；完整 evidence、history、diagnostic 和 landing detail 只通过显式 drilldown 读取。 |
| owner boundary | clean OPL upstream 持有 OPL runtime/domain truth；MedOPL 持有 SaaS platform、Gateway、Runtime Bridge、resource、billing、audit 和 projection truth。 |
| fail-closed admission | 缺 owner、scope、authorization、evidence、secret allowlist 或 contract subscription 时，进入 blocker / human gate，不做隐式默认。 |

## Core Reading Path

新 agent 开工默认按下列顺序读取：

```text
docs/README
-> docs/active/README
-> docs/product/README
-> docs/runtime/README
-> docs/framework/README
-> docs/specs/README
-> docs/evidence/README
-> docs/policies/README
-> docs/delivery/README
-> tests/fixtures/v22/goal-current.json
-> tests/fixtures/v22/agent-verify-manifest.json
```

旧分散 root truth 文件、旧合同叶子树和旧 recovery 树不得恢复为 current truth、contract truth 或默认读入口；具体 tombstone map 只看 `docs/README.md` 和 `docs/history/README.md`。

## Four Platform Planes

### Product Plane

Owner: `MedOPL Portal`

Active surface:

- `services/portal`
- `services/portal/frontend`
- `docs/product/README.md`
- user-facing Portal routes and sanitized Portal API projections

Contract package:

- `spec:v22-mvp-managed-opl-loop`
- `spec:v22-saas-control-plane-user-experience-boundary`
- `spec:v22-saas-portal-opl-ops-surface-boundary`
- `spec:v22-resource-plan-boundary`
- `spec:v22-managed-environment-open-boundary`
- `spec:v22-portal-files-billing-trace-boundary`

Canonical source:

- Portal store / state / route / domain source.
- `docs/active/README.md` for current product status.
- `tests/fixtures/v22/goal-current.json` for machine cursor.

Public projection:

- 用户看到账号、工作空间、文件空间、计算资源、套餐、任务并发、余额、冻结金额、账单、任务、结果和 OPL 入口。
- 普通用户不看到 CVM、COS、K8s、TKE、节点池或云控制台配置。

Evidence requirement:

- local smoke/regression proves Portal sanitized projection and product loop.
- production claim requires authorized production evidence, not local smoke.
- default verification starts with golden path health before governance guardrails.

Cannot claim:

- 不能声明真实云已开通。
- 不能声明真实价格审批、真实扣费、真实账单核对或 production release ready。
- 不能把 Portal UI 状态写成云资源 actual state。

Smoke/eval gate:

- `node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs`
- `node tests/smoke/smoke-test-v22-resource-plan-contract.mjs`
- `node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs`
- `node tests/regression/portal/regression-test-v22-portal-files-billing-trace-flow.mjs` when present via suite wrappers.

History boundary:

- Product run and landing summaries go to `docs/history/README.md`.
- Detailed run output stays in command output or git history.

### Integration Plane

Owner: `MedOPL Gateway`

Active surface:

- `services/opl-web-gateway`
- Portal OPL launch routes
- Gateway bootstrap and preflight surfaces

Contract package:

- `spec:v22-portal-opl-connection-boundary`
- `spec:v22-opl-entry-preflight-auth-boundary`
- `spec:v22-saas-portal-opl-ops-surface-boundary`
- `spec:v22-token-provider-boundary`
- `spec:v22-upstream-opl-boundary`

Canonical source:

- Gateway source and local Gateway/OPL regression evals.
- clean upstream OPL remains external reference, not MedOPL source.

Public projection:

- Portal "进入 OPL 工作台" and `/opl/entry/preflight`.
- Gateway injects only sanitized context such as `workspaceId`, session/launch status, provider bound status and return URL.

Evidence requirement:

- local proxy/preflight smoke proves MedOPL Gateway boundary.
- real upstream behavior requires authorized canary evidence.

Cannot claim:

- 不能声明修改过 upstream。
- 不能把 upstream internal API/DOM/database/session model 写成 MedOPL contract.
- 不能把 `/api/opl/*` placeholder 或 local fake profile 写成 Product API truth.

Smoke/eval gate:

- `node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs`
- `node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs`
- `node tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs`

History boundary:

- upstream discovery, real WebUI canary and provider canary summaries go to `docs/history/README.md` or `.runtime` evidence; they do not enter current truth as production completion.

### Runtime Plane

Owner: `MedOPL Runtime Bridge`

Active surface:

- `services/opl-runtime-bridge`
- Runtime Bridge state store, launch/session/run/message/file/artifact/trace routes
- Runtime Agent relay boundary

Contract package:

- `spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary`
- `spec:v22-opl-work-message-file-run-boundary`
- `spec:v22-portal-opl-context-backflow-boundary`
- `spec:v22-real-opl-capability-canary-boundary`
- `spec:v22-real-opl-provider-message-canary-boundary`
- `spec:v22-real-opl-file-run-artifact-canary-boundary`
- `spec:v22-trace-metadata-boundary`

Canonical source:

- Runtime Bridge source and local runtime regression evals.
- Runtime Bridge projection is not billing ledger truth and not cloud inventory truth.

Public projection:

- Portal sees sanitized session, run, message, artifact, output file and trace metadata.
- Raw prompt, raw provider key, bearer token, launch token, runtime token, object key, local path and signed URL stay outside public projection, logs, evidence and git.

Evidence requirement:

- local relay proof can prove fileRef/run/artifact projection shape.
- authorized canary can prove specific real OPL capability.
- production runtime readiness requires authorized deploy/runtime evidence.

Cannot claim:

- 不能把 local Runtime Agent relay proof 写成 production runtime.
- 不能把 provider message canary 写成 file/run/artifact completion.
- 不能把 Langfuse metadata attachment 写成 Portal canonical source.

Smoke/eval gate:

- `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`
- `node tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs`
- `node tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs`
- `node tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs`

History boundary:

- Runtime proof and canary details stay in `.runtime`, command output, git history or `docs/history/README.md` summary.

### Operations Plane

Owner: `MedOPL Operations`

Active surface:

- Portal admin/ops routes and projections
- cloud workflow specs and future-authorized test lane
- billing/freeze/audit state and admin operation projection

Contract package:

- `spec:v22-billing-freeze-boundary`
- `spec:v22-release-stop-billing-audit-boundary`
- `spec:v22-admin-ops-console-boundary`
- `spec:v22-cloud-onboarding-workflow-boundary`
- `spec:v22-production-cloud-topology-boundary`
- `spec:v22-authorized-tencent-create-release-boundary`
- `spec:v22-authorized-tencent-create-release-execution-boundary`
- `spec:v22-authorized-tencent-deploy-execution-boundary`

Canonical source:

- Portal ledger/audit state for local business truth.
- future-authorized cloud inventory/deploy evidence only after user authorization.

Public projection:

- Ordinary users see balance, freeze amount, release status, audit status and service state.
- Admin/ops users see management projections only through authorized admin surfaces.

Evidence requirement:

- local eval proves contract, projection and fail-closed behavior.
- readonly inventory, mutation and deploy require separate authorization, separate secret allowlist, separate runner and separate evidence.

Cannot claim:

- 不能声明真实资源创建/释放、真实扣费、真实部署、kubectl rollout 或 production canary。
- 不能用 local dry-run、mock quote or future-authorized test lane close production evidence.
- 不能将 OpenCost or Langfuse old primary narrative restored as product truth.

Smoke/eval gate:

- `node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs`
- `node tests/regression/portal/regression-test-v22-admin-ops-local-projection-view.mjs`
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk --dry-run --json` for visibility only.

History boundary:

- Real cloud, deploy and production evidence summaries require explicit authorization record and cannot be written as default current truth without landing closeout.

## Surface Budget

Default surface:

- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `tests/fixtures/v22/*`
- `scripts/v22-verify.mjs`

Drilldown surface:

- `docs/source/README.md`
- `docs/public/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- specific `tests/**/*.mjs`
- git history and command output

Promotion rule:

- A fact enters default surface only if it changes launch safety, authorization boundary, contract subscription, evidence requirement, audit/review route, current cursor, or cannot-claim status.
- Implementation detail, canary transcript, agent-run log, detailed command output and historical rationale stay in drilldown/history.

## Admission Model

Every authoring branch must declare:

- branch intent and base trunk HEAD
- golden path impact
- subscribed docs/spec/policy/runtime/source files
- affected plane(s)
- owner boundary
- surface impact
- evidence requirement
- cannot-claim list
- allowed files
- forbidden files and operations
- verification commands
- expected history closeout target

Missing golden path impact, missing subscription, missing owner, missing authorization or missing evidence must fail closed as blocker or human gate.

Golden Path Impact must state whether the change preserves, improves, narrows, defers or does not affect the default product spine:

```text
login / credit / provider key
-> open managed environment
-> launch OPL
-> upload file / task
-> run / artifact
-> billing / trace / audit
-> release / stop billing
```

Governance gates remain mandatory guardrails, but they must not become the default narrative center. A branch cannot use contract, cleanup or closeout success to mask a golden path regression.

## Readiness Model

| Readiness | Meaning | Can claim | Cannot claim |
| --- | --- | --- | --- |
| local contract readiness | repo-local deterministic tests prove contract shape, projection and fail-closed behavior | local boundary matches specs | real cloud, real provider, production runtime |
| integration readiness | authorized canary or local relay proves a specific integration path | bounded capability for that path | broader capability outside observed evidence |
| production readiness | authorized production deploy/runtime/cloud/billing evidence passes and lands with closeout | scoped production release state | unobserved regions, tenants, resources or external systems |

Readiness must be traceable to evidence and cannot be inferred from prose, old recovery state, user memory or provider success without receipt/projection.

## Cannot-Claim Summary

- Local smoke does not prove production.
- Contract proof does not prove live external readiness.
- Canary does not prove more than the observed path.
- Authorized live evidence does not authorize future live operations.
- History does not override current active truth.
- Clean upstream reference does not become MedOPL source.
- Portal projection does not become cloud inventory truth.
- Runtime Bridge projection does not become billing ledger truth.
