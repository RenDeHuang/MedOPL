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

Status: `landed / pushed / post-push verified`

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

Status: `landed / pushed / post-push verified`

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

Status: `landed / pushed / post-push verified`

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

详细过程证据以 git history 为准。本文件只保当前可审摘要，不再保 shadow archive。
