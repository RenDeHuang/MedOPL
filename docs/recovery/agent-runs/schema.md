# Agent Run Record Schema

Schema version: `1`

This schema applies to new agent-run records created after `cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization`. Historical records remain legacy evidence until a dedicated migration leaf updates them.

## Header

```md
# Agent Run: <title>

## meta

- schema_version: 1
- leaf_id: <string>
- run_kind: implementation | cleanup | post_absorb_truth | trace_only
- status: pending_b_review | absorbed | superseded
- model: gpt-5.4 | gpt-5.3-codex | gpt-5.4-mini
- branch: <branch>
- base_trunk_head: <40-char-sha>
- commit_sha: <40-char-sha | pending_B_review>
- absorbed_commit: <40-char-sha | none>
- supersedes: <path | none>
- superseded_by: <path | none>
- branch_override_id: <string | none>
```

## Required Sections

Each new record must include these sections exactly once:

- `## meta`
- `## goal`
- `## contract_subscription`
- `## allowed_write_scope`
- `## forbidden_scope`
- `## implementation_summary`
- `## eval_first_changes`
- `## blocker_review_and_fix_log`
- `## verification_commands`
- `## b_review_result`
- `## post_absorb_verification`
- `## runtime_notes`
- `## non_goals`
- `## next_leaf`

`## subagents_and_models` is required when subagents were used. It is optional only when the record explicitly says no subagents were used.

## Status Rules

- `pending_b_review`
  - `absorbed_commit` must be `none`.
  - `post_absorb_verification` must be `not_applicable_yet`.
  - `b_review_result` must be `pending_B_review`.
- `absorbed`
  - `absorbed_commit` must be a 40-character commit SHA.
  - `b_review_result` must not be `pending_B_review`.
  - `post_absorb_verification` must include the B review, ff-only absorb, push, and post-push verification summary.
- `superseded`
  - `superseded_by` must point to another record.
  - The replacement record must name this record in `supersedes`.

## Boundary Rules

`forbidden_scope` must include the standard boundary set:

- `secret`
- `real cloud`
- `upstream`
- `build/deploy/kubectl/live-test`

The record must not contain raw credentials, bearer tokens, kubeconfig, private keys, signed URLs, raw provider API keys, or raw cloud responses.

## Model Rules

The only allowed model values are:

- `gpt-5.4`
- `gpt-5.3-codex`
- `gpt-5.4-mini`

Every subagent entry must include both role and model. Subagents must use only the same allowed model set.
