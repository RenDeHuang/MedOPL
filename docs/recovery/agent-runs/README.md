# Agent Runs

`docs/recovery/agent-runs/` is evidence, not product truth. Product and architecture truth live in `docs/product.md`, `docs/architecture.md`, `docs/status.md`, `docs/recovery/v22-goal-current.json`, and `docs/recovery/v22-agent-verify-manifest.json`.

Each new A-window leaf must write one agent-run record before it is handed to B. B absorption must be recorded either by updating that same record in a post-absorb truth leaf, or by a later record that explicitly links to it through `supersedes` / `superseded_by`.

## Authority Order

1. `docs/recovery/v22-goal-current.json`: current cursor, last absorbed commit, current blockers.
2. `docs/recovery/v22-agent-verify-manifest.json`: verification bundles, branch overrides, allowed files, forbidden files and forbidden ops.
3. `docs/recovery/agent-runs/*.md`: execution evidence, model record, verification evidence, B review result, non-goals.

Agent-run records must not advance cursor, grant cloud authorization, replace contracts, or become the only current truth.

## Naming

Use:

```text
YYYY-MM-DD-<leaf-or-cleanup-id>.md
```

The `<leaf-or-cleanup-id>` portion should match `meta.leaf_id` after normalizing `/` to `-` only when the actual branch name is used as the leaf id.

## New Record Requirement

New records created after `cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization` must follow [schema.md](./schema.md). Older records are retained as legacy evidence until a dedicated schema migration leaf updates them with explicit `supersedes` / `superseded_by` links.

## State Machine

- `pending_b_review`: A committed the leaf and handed it to B; no ff-only absorb has been recorded.
- `absorbed`: B reviewed, ff-only absorbed, pushed, and post-push verification was recorded.
- `superseded`: a later evidence record replaced this record's machine-readable status; the replacement must be named in `superseded_by`.

Post-absorb truth leaves must not claim product implementation. They only record B review, absorbed commit, post-push verification, and the next recommended leaf.

## Non-Negotiable Boundaries

Every record must explicitly state:

- no secret read
- no real cloud call
- no upstream modification
- no build/deploy/kubectl/live-test
- no unapproved UI visual/layout/information-architecture change

If any of those boundaries were authorized for a leaf, the record must point to the step-local authorization record and evidence path. Authorization records containing secrets stay in `.runtime` and must not enter git.
