# 2026-05-19 Leaf Portal Workspace File Action Closure

## leaf_id

leaf-portal-workspace-file-action-closure

## goal

Record the absorbed Portal workspace file action closure leaf and preserve the local runtime notes needed by the next worker to distinguish code regressions from local runtime drift.

## model

gpt-5.4

## post_absorb_trace_branch_model_record

- Controller / integration model: `gpt-5.4`
- Subagent Worker A: `gpt-5.4`; responsibility: create the absorbed leaf agent-run record and local runtime health runbook.
- Subagent Worker B: `gpt-5.4`; responsibility: create the agent-run record gate and connect it to repo-local eval classification.
- Subagent Schrodinger: `gpt-5.4`; responsibility: read-only final compliance review of the post-absorb trace branch diff.

## branch

feat/v22-portal-workspace-file-action-closure

## base_trunk_head

4eaa3e7d739850e37a328d6cd626ee1377e448fd

## absorbed_commit

6b9485c0a9a02e23524c4776e6e0d2ef76ac6670

## contract_subscription

- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-portal-structure-failure-isolation-boundary.md`
- `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`
- `docs/contracts/README.md`
- `docs/recovery/mvp-contract-acceptance.md`
- `docs/recovery/status-matrix.md`

## allowed_write_scope

- `services/portal/**` for the absorbed feature branch implementation.
- `scripts/smoke-test-v22-*` only where local contract gates were required by the absorbed feature branch.
- `docs/recovery/**` and `docs/contracts/**` only for subscribed contract/status writeback where required by the absorbed feature branch.

For this cleanup trace branch, the allowed write scope is limited to:

- `docs/recovery/agent-runs/2026-05-19-leaf-portal-workspace-file-action-closure.md`
- `docs/recovery/portal-local-runtime-health-runbook.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `scripts/smoke-test-v22-agent-run-record-gate.mjs`
- `scripts/v22-smoke-classification.mjs`

## forbidden_scope

- Do not read secrets.
- Do not call real cloud APIs.
- no real cloud.
- no secret.
- no upstream.
- Do not run build/push/kubectl/deploy/live-test.
- Do not modify `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*`, or one-person-lab upstream.
- Do not commit `.runtime`.
- Do not restore `user_owned`, `resource-order`, old runner/provisioner, OpenCost primary narrative, or Langfuse primary product narrative.

## implementation_summary

The absorbed leaf completed the `/workspace` file space action loop in Portal:

- Added frontend fetch paths for `fetchWorkspaceStorage` and `fetchStorageEntitlement`.
- Added workspace file upload and download action APIs with `createWorkspaceFileUploadUrl` and `createWorkspaceFileDownloadUrl`.
- Wired file input to upload-url creation, multipart signed upload, and Portal refresh.
- Wired download action to download-url creation and signed browser download.
- Derived the active storage binding on the backend from the current user's workspace instead of trusting user-provided binding identity.
- Kept public responses clean: no `storageKey`, `objectKey`, `localPath`, `storageRootPrefix`, `resourceBindingId`, or `signedUrl` leaks in Portal public payloads.
- Preserved the v22 product narrative: workspace file actions are part of the managed OPL research workspace, not a cloud storage console.

## blocker_review_and_fix_log

- Blocker: workspace file actions needed to close the UI loop without exposing internal storage implementation fields.
- Fix: backend action handlers derive active binding from authenticated workspace context and expose only public file/action references.
- Blocker: upload/download flows needed to use signed URL mechanics while keeping signed URLs out of canonical Portal responses.
- Fix: signed URLs are one-time action results used by the browser action flow; stable Portal state remains public references and sanitized metadata.
- Blocker: local runtime reports of blank or broken UI could be caused by stale local processes rather than the absorbed code.
- Fix: this follow-up trace branch adds `docs/recovery/portal-local-runtime-health-runbook.md` so later workers first separate code regression from local runtime drift.

## verification_commands

Absorbed feature branch verification recorded by B review:

```bash
node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all
git diff --check
```

This cleanup trace branch verification:

```bash
git diff -- docs/recovery/agent-runs/2026-05-19-leaf-portal-workspace-file-action-closure.md docs/recovery/portal-local-runtime-health-runbook.md
git diff --check
rg -n "leaf_id|goal|model|branch|base_trunk_head|absorbed_commit|contract_subscription|allowed_write_scope|forbidden_scope|implementation_summary|blocker_review_and_fix_log|verification_commands|b_review_result|runtime_notes|non_goals|next_leaf" docs/recovery/agent-runs/2026-05-19-leaf-portal-workspace-file-action-closure.md
rg -n "5173|17080|stale|Tailwind|preflight|ECONNREFUSED|PORTAL_RUNTIME_ROOT|/overview|/portal/api/me|/portal/api/overview|.runtime" docs/recovery/portal-local-runtime-health-runbook.md
```

## b_review_result

ff-only absorbed and pushed per B review, no push in this cleanup branch

## runtime_notes

- Local UI blank or broken state must first be classified as either code regression or local runtime drift.
- The common local runtime drift cases are a stale Vite process on port `5173`, missing Portal backend on port `17080`, Tailwind preflight/path cache drift, or backend `ECONNREFUSED`.
- `PORTAL_RUNTIME_ROOT` changes the local runtime seed/state root; switching it can make demo data appear reset without implying that repo-tracked data was cleared.
- Runtime evidence and scratch state belong under `.runtime` and must not be committed.

## non_goals

- No new product contract.
- No Portal code changes in this cleanup trace branch.
- No service implementation changes in this cleanup trace branch.
- No real cloud, secret, deploy, build/push, kubectl, live-test, or upstream operation.
- No `.runtime` evidence committed to git.

## next_leaf

Use `docs/recovery/portal-local-runtime-health-runbook.md` before opening a code regression leaf for local Portal UI blank/broken reports. If the runbook proves a deterministic code regression, open a new `feat/*` or `cleanup/*` branch from the latest `recovery/platform-v22-trunk`, subscribe the relevant Portal/UI contracts, and add a branch-specific local verification command.
