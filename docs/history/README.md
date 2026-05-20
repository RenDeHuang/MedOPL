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

## Current Run Summaries

详细过程证据以 git history 为准。本文件只保当前可审摘要，不再保 shadow archive。

### 2026-05-21 cleanup/v22-current-state-index-loop-normalization

Status: `ready_for_b_review`

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
- final closeout commit: records this A handoff.

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

Verification before handoff:

- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`: pass.
- `node tests/contract/contract-test-v22-retirement-lifecycle-system.mjs`: pass.
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`: pass.
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`: pass.
- Final A handoff verification must re-run current, local-contract, workflow review, diff check and added-lines secret scan.

Non-goals:

- No PostgreSQL/Redis implementation.
- No services business code change.
- No real cloud, secret read, build/push, kubectl, deploy or live-test.
- No upstream modification.
- No Figma UI visual/layout/information-architecture change.
- No compatibility layer or old contracts/recovery/scripts resurrection.

B review packet:

- Review branch: `cleanup/v22-current-state-index-loop-normalization`.
- Review base: `3ca2ee48f55bb154776c60605a497d9a2e7e1752`.
- Review focus: docs root truth lookup, product/runtime spec-anchor indexes, latest absorbed commit closeout, new index-loop gate, manifest current/local-contract/history-closeout wiring, and no services/forbidden-surface changes.
- Verify: run `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk --json`, `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`, and `git diff --check -- docs tests scripts`.
- Absorb rule: only B may fresh review, ff-only merge to `recovery/platform-v22-trunk`, push, and run post-push verification.

Next recommendation:

- After B absorbs this index-loop normalization and post-absorb closeout is recorded, run `leaf-portal-postgres-redis-local-production-data-closure`.

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
