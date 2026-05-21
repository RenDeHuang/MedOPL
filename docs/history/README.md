# History Truth

Owner: `MedOPL`
Purpose: `history_evidence_index`
State: `active`
Machine boundary: 本文是历史和证据入口，不是 current truth。当前事实看 `docs/active/README.md`；合同看 `docs/specs/README.md`；机器 cursor 和 verify manifest 看 `tests/fixtures/v22/*`。

## Scope

History 承接：

- agent-run evidence 摘要
- B review / absorb / post-push records 摘要
- cleanup closeout
- superseded stage boards 摘要
- provenance and retirement summaries

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
- B review result when absorbed
- non-goals
- risk notes
- next recommendation

吸收后的记录还必须补齐：

- absorbed_commit
- b_review_result
- post_push_verification
- post_absorb_truth_closeout
- next_cursor

`ready_for_b_review` 只能出现在未吸收 A 分支的临时 handoff 中。B 已 ff-only absorb 并 push 后，history 摘要必须改为 `absorbed / pushed / post-push verified`。历史细节不再展开成独立 `agent-runs/` 文件；详细证据以 git history 和 B review 输出为准。

## Tombstone Map

| Retired path or pattern | Retired reason | Current owner | Must not return as |
| --- | --- | --- | --- |
| distributed contract leaf docs | distributed contract leaves were absorbed into single specs truth | `docs/specs/README.md` | current contract leaf tree, compatibility alias, default verification input |
| recovery process docs | recovery process docs were absorbed into active/history taxonomy | `docs/active/README.md`, `docs/history/README.md` | current truth tree, agent-run archive tree, stage board |
| legacy root product doc | product truth moved into taxonomy views | `docs/product/README.md`, `docs/active/README.md` | second product truth or root entrypoint |
| legacy root architecture doc | architecture truth moved into runtime/source/specs views | `docs/runtime/README.md`, `docs/source/README.md`, `docs/specs/README.md` | second architecture truth |
| legacy root status doc | current status moved into active truth and machine cursor | `docs/active/README.md`, `tests/fixtures/v22/goal-current.json` | second current status board |
| legacy root invariants doc | durable invariants moved into policies/specs | `docs/policies/README.md`, `docs/specs/README.md` | root governance doc |
| legacy root decisions doc | decisions are now summarized by absorbed run history | `docs/history/README.md` | rolling decision log that overrides current truth |
| legacy root vibe-coding doc | agent workflow discipline moved into policies and AGENTS | `AGENTS.md`, `docs/policies/README.md` | default workflow entrypoint |
| `scripts/smoke-test-*` | eval files moved to `tests/**`, scripts reduced to runner/classifier/workflow | `tests/**`, `scripts/v22-verify.mjs` | repo-local eval location, compatibility script family |

## Current Run Summaries

详细过程证据以 git history 为准。本文件只保当前可审摘要，不再保 shadow archive。

### 2026-05-21 cleanup/v22-opl-loop-event-automation-and-ci-closure

Status: `absorbed / pushed / post-push verified`

Branch: `cleanup/v22-opl-loop-event-automation-and-ci-closure`

Base trunk HEAD: `583da292aa32bf021697171f5b5cea1cfc693baf`

Model:

- controller: `gpt-5.4` declared for repository workflow policy
- subagent Hume: `gpt-5.4`, read-only OPL docs/software engineering loop comparison
- subagent Harvey: `gpt-5.4`, read-only post-absorb closeout / machine cursor / history drift audit
- subagent Sartre: `gpt-5.4`, read-only package / CI / test lane / manifest consistency audit

Commits:

- `658cd1b test(v22): automate post-absorb loop closeout`
- `ff0b15d ci(v22): harden engineering loop entrypoints`
- final handoff commit: records this A branch summary and B review packet.

Scope:

- Close the absorbed `cleanup/v22-opl-docs-engineering-loop-closure` truth to `583da292aa32bf021697171f5b5cea1cfc693baf`.
- Add `scripts/v22-absorb-closeout.mjs` so B can generate and check post-absorb truth closeout instead of hand-editing history and fixtures.
- Add `contract-test-v22-absorb-closeout-automation.mjs` and wire it into current, local-contract, review and history-closeout gates.
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
- `scripts/v22-absorb-closeout.mjs`
- `.github/workflows/verify.yml`
- `package.json`

Verification before handoff:

- `node tests/contract/contract-test-v22-absorb-closeout-automation.mjs`: pass.
  - Covers invalid SHA, unknown SHA, wrong old trunk commit, unknown branch, missing required field, pre-absorb trunk reachability failure and valid branch/handoff dry-run success.
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs`: pass.
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`: pass.
- `node tests/contract/contract-test-v22-full-taxonomy-hard-retirement.mjs`: pass.
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
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, then run `node scripts/v22-absorb-closeout.mjs generate --branch cleanup/v22-opl-loop-event-automation-and-ci-closure --absorbed-commit <absorbed_branch_head> --trunk-ref origin/recovery/platform-v22-trunk ...` or an equivalent closeout commit for this branch.

Risk notes:

- `scripts/v22-absorb-closeout.mjs generate` writes docs/history, docs/active and goal-current only; it does not push, merge, deploy, read secrets or call cloud.
- `scripts/v22-absorb-closeout.mjs generate` rejects invalid / unknown absorbed commits, old trunk commits, unknown branches, branch/handoff mismatches and post-push trunk reachability failures when `--trunk-ref` is provided.
- `last_absorbed_commit` records the absorbed A branch commit. A later closeout commit cannot self-reference its own future SHA; the closeout gate therefore checks that the absorbed commit is reachable from trunk and that no reachable handoff remains `ready_for_b_review`.
- `verify:docs-engineering-loop` is now a manifest-backed package suite instead of an unregistered shell chain.

Next recommendation:

- After B absorbs this branch and records post-push closeout, return to `leaf-portal-postgres-redis-local-production-data-closure`.

absorbed_commit: `2fe61b26714b237bc323aa3245128d1b0140d332`

b_review_result: `passed / ff-only absorbed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs package docs-engineering-loop --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass

post_absorb_truth_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-opl-docs-engineering-loop-closure

Status: `absorbed / pushed / post-push verified`

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

absorbed_commit: `583da292aa32bf021697171f5b5cea1cfc693baf`

b_review_result: `passed / ff-only absorbed / pushed`

post_push_verification:

- node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-verify.mjs package root-verify --base origin/recovery/platform-v22-trunk --json: pass
- node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk: pass
- git diff --check -- docs tests scripts package.json .github: pass
- forbidden diff and added-lines secret scan: pass

post_absorb_truth_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

### 2026-05-21 cleanup/v22-post-absorb-closeout-and-gate-integrity

Status: `absorbed / pushed / post-push verified`

Branch: `cleanup/v22-post-absorb-closeout-and-gate-integrity`

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
- `node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs`: pass.
- `node tests/health/health-check-v22-workflow-gate.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

absorbed_commit: `c66d8d86b05d0673d320d6798d9b4192deb8d4cd`

b_review_result: `passed / ff-only absorbed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass with temporary ignored `node_modules` symlink in the B worktree; symlink removed after verification.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass; post-push workflow gate `ok:true`.
- `git diff --check -- docs tests scripts`: pass.
- forbidden diff and secret scan: pass, no findings.

post_absorb_truth_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review result:

- Review branch: `cleanup/v22-post-absorb-closeout-and-gate-integrity`.
- Review base: `2e644fc774e567db9418e3d13942e1598434433e`.
- Review focus: latest absorbed commit closeout, workflow start-template test reference integrity, manifest branch override, no services/forbidden-surface changes, and no business cursor advancement.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorbed by B with ff-only merge, pushed to `origin/recovery/platform-v22-trunk`, post-push verification recorded above.

Next recommendation:

- Continue OPL-style docs/software engineering loop closure before running the product cursor `leaf-portal-postgres-redis-local-production-data-closure`.

### 2026-05-21 cleanup/v22-current-state-index-loop-normalization

Status: `absorbed / pushed / post-push verified`

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
- `node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite health --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs suite smoke --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.


absorbed_commit: `2e644fc774e567db9418e3d13942e1598434433e`

b_review_result: `passed / ff-only absorbed / pushed`

post_absorb_truth_closeout: `completed`

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

Status: `absorbed / pushed / post-push verified`

Branch: `cleanup/v22-retirement-lifecycle-system-closure`

Base trunk HEAD: `2a4254915f43186e312f406e5de31629c1c6700b`

absorbed_commit: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`

b_review_result: `passed / ff-only absorbed / pushed`

post_push_verification:

- `node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs`: pass.
- `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- docs tests scripts`: pass.

post_absorb_truth_closeout: `completed`

next_cursor: `leaf-portal-postgres-redis-local-production-data-closure`

Model:

- controller: `gpt-5.4`

Commits:

- `2d2ee07 docs(v22): codify retirement lifecycle rules`
- `42a2cbf test(v22): add retirement lifecycle gate`
- `82a1d4b test(v22): wire retirement lifecycle gate into verify manifest`
- final closeout commit: records hard retirement post-absorb truth and this A handoff.

Scope:

- Codify the OPL-style retirement lifecycle as the default MedOPL v22 development loop.
- Add a machine gate that checks taxonomy truth, history closeout schema, retired-path protection, tests taxonomy, and manifest wiring.
- Record the post-absorb closeout for `cleanup/v22-full-taxonomy-hard-retirement`.
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

Status: `absorbed / pushed / post-push verified`

Branch: `cleanup/v22-full-taxonomy-hard-retirement`

Base trunk HEAD: `365c2a676ed243ead64338d62ce2ec6262ce4767`

absorbed_commit: `2a4254915f43186e312f406e5de31629c1c6700b`

b_review_result: `passed / ff-only absorbed / pushed`

post_push_verification:

- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass.
- `git diff --check -- AGENTS.md README.md DESIGN.md docs tests scripts services/portal/src`: pass.

post_absorb_truth_closeout: `completed`

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
- B review and absorb happened outside this A window; this lifecycle closure records the post-absorb truth.

Next recommendation:

- Resume the current product cursor: `leaf-portal-postgres-redis-local-production-data-closure`.

## Reading Rule

Use history to understand how a change was made. Use active/specs/policies/delivery/source and verify fixtures to decide what is currently true.

When judging whether the current loop is closed, do not stop at one run summary. Check `docs/active/README.md`, `docs/delivery/README.md`, `tests/README.md`, `tests/fixtures/v22/goal-current.json`, and `tests/fixtures/v22/agent-verify-manifest.json` together.
