# Evidence Truth

Owner: `MedOPL`
Purpose: `evidence_model_view`
State: `active_evidence_view`
Machine boundary: 本文是人读证据模型入口，不是 current truth、不是 secret storage、不是 production evidence 本体。当前状态看 `docs/active/README.md`；spec 看 `docs/specs/README.md`；framework owner/readiness 看 `docs/framework/README.md`；机器 cursor 和 verify manifest 看 `tests/fixtures/v22/*`。

## Evidence-After-Contract Rule

MedOPL 先定义 contract/spec/admission，再接受 evidence。任何 smoke、proof、canary、live output、review 或 production report 都只能证明它实际覆盖的 scope。证据不得自动升级为 current truth、production truth、billing truth、cloud inventory truth 或 upstream domain truth。

证据必须回答：

- owner 是谁
- contract/spec anchor 是什么
- scope 是什么
- evidence source 在哪里
- can-claim 是什么
- cannot-claim 是什么
- 是否需要授权
- 是否允许进入 git
- closeout 后写回哪个 human summary 和 machine cursor

## Evidence Levels

| Level | Source | Can claim | Cannot claim | Git policy |
| --- | --- | --- | --- | --- |
| local smoke evidence | `tests/smoke/*.mjs` via `scripts/v22-verify.mjs suite smoke` | 用户 golden path 的本地合同级行为成立 | 真实云、真实 upstream、真实 provider、production runtime | command result may be summarized in history |
| local contract proof | `tests/contracts/*.mjs`, `tests/hygiene/*.mjs`, `tests/suites/*.mjs`, `tests/health/*.mjs`, local regression tests | spec shape, fail-closed gate, taxonomy, lifecycle and projection rules hold locally | live capability, production deploy, real billing | command result may be summarized in history |
| local integration proof | local fake/relay/runtime regression under `tests/regression/**` | specific local integration path and projection behavior | external system capability outside local profile | command result may be summarized in history |
| local RC authorized proof | current lane is empty; historical provider-bound proof lives in `docs/history/README.md`; any future local RC eval requires a new authorized package | bounded local release-candidate path using the authorized local provider secret boundary | current default smoke health, production provider readiness, real cloud or deploy | sanitized summary only; raw secret and raw logs stay out of git |
| authorized canary evidence | explicit user-authorized canary runner and `.runtime` evidence | observed external capability for the authorized path | production readiness, future authorization, broader external capability | sanitized summary only; raw evidence stays out of git |
| live evidence | explicitly authorized live provider/cloud/upstream run | bounded live behavior for the authorized environment and time | ongoing permission, production release, unobserved tenants/resources | sanitized summary only unless approved |
| production evidence | explicitly authorized deploy/cloud/billing/runtime release evidence | scoped production release state after review and closeout | unobserved systems or future mutation authority | summary in history; sensitive evidence outside git |
| historical evidence | `docs/history/README.md`, git history, landed commit messages | provenance, landed closeout and previous decisions | current truth if superseded by active/spec/framework/status | summary only |

## Storage Boundaries

Allowed in git:

- sanitized command summaries
- test names and pass/fail status
- contract/spec anchors
- landed commit IDs
- can-claim / cannot-claim notes
- non-sensitive evidence refs

Not allowed in git:

- raw provider key
- bearer token
- launch token
- runtime token
- kubeconfig
- SecretId / SecretKey
- SSH private key
- object key, local path or signed URL if it can reveal private storage
- raw external payload containing secrets or tenant-private material

`.runtime` is allowed for local/private evidence, but `.runtime` is not current truth and is not a repo-tracked production proof surface.

## Evidence Requirements By Plane

| Plane | Minimum local evidence | External evidence before production claim |
| --- | --- | --- |
| Product Plane | Portal smoke/regression proves sanitized user projection, storage/file refs and billing/audit receipts and no cloud-console language | production Portal deployment, real tenant data projection review, admin/customer acceptance as applicable |
| Integration Plane | Gateway/preflight local tests prove clean upstream boundary and no raw token persistence | authorized upstream/WebUI canary and Gateway proxy evidence |
| Runtime Plane | Runtime Bridge local tests prove launch/session/message/file/run/artifact projection with internal audit correlation and fail-closed unsupported capabilities | authorized Runtime Agent / real OPL / production runtime evidence |
| Operations Plane | billing/freeze/admin/cloud future-authorized gates prove local contract and authorization boundaries | separate readonly inventory, mutation, deploy, billing reconciliation and audit evidence |

## Can-Claim / Cannot-Claim Discipline

Every branch closeout must state:

- `can_claim`: the exact bounded conclusion supported by the executed commands.
- `cannot_claim`: adjacent claims that remain unsupported.

Examples:

- A local smoke can claim: `Portal OPL connection contract shape passes locally`.
- It cannot claim: `real OPL production connection is live`.
- A provider message canary can claim: `authorized provider message reply was observed for that path`.
- It cannot claim: `file/run/artifact production workflow is complete`.
- A dry-run cloud plan can claim: `resource plan shape and authorization gate pass locally`.
- It cannot claim: `real cloud resources were created`.

## Review Routing

Evidence changes route through:

- `docs/framework/README.md` for owner/readiness impact.
- `docs/specs/README.md` for contract/spec changes.
- `docs/policies/README.md` for authorization or lifecycle policy changes.
- `docs/delivery/README.md` for current execution command and authorization sequence.
- `docs/history/README.md` for landed summaries and post-merge closeout.
- `tests/fixtures/v22/*` for machine cursor and verify manifest changes.

If evidence would change current status, the current status change belongs in `docs/active/README.md` and `tests/fixtures/v22/goal-current.json`, not in this file.

## False-Claim Guards

The following statements are forbidden unless backed by matching production evidence and user authorization:

- true cloud resources are created, released, scaled or deployed
- real billing is reconciled or charged
- production deploy is complete
- kubectl rollout succeeded
- live provider, Langfuse or COS integration is production ready
- clean upstream OPL internals are MedOPL source truth
- canary/proof/smoke is production truth

The following retired surfaces must not return as evidence authorities:

- retired distributed contract leaf tree
- retired recovery process tree
- retired root current/product/architecture/invariant truth files
- `scripts/smoke-test-*`
- `user_owned`
- `resource-order`
- old runner/provisioner
- OpenCost or Langfuse primary product narrative

## Closeout Format

History summaries that cite evidence should include:

- branch
- base trunk HEAD
- model and subagent models
- subscribed docs/spec/policy files
- affected plane(s)
- commands and results
- can-claim
- cannot-claim
- non-goals
- forbidden operations not performed
- next owner / next cursor

Detailed logs stay in command output, git history, `.runtime` or external approved evidence stores.
