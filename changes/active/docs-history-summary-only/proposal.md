# docs-history-summary-only Proposal

Status: authoring
Branch: cleanup/v22-docs-history-summary-only
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

`docs/history/README.md` had become an 8k-line landed-run database, and several tests plus `scripts/v22-landing-closeout.mjs` parsed its Markdown headings and prose as machine truth. That violates the OPL-style rule that narrative docs are human lifecycle surfaces, while source, tests, fixtures, manifests and runner behavior own machine truth.

## Goals

- Compress `docs/history/README.md` into a short archive index with tombstone and provenance pointers.
- Move latest landed closeout machine truth into `tests/fixtures/v22/goal-current.json`.
- Update `scripts/v22-landing-closeout.mjs` to read/write machine closeout state from the cursor fixture instead of parsing history prose.
- Update contract tests to verify summary boundary, archive pointers and machine owner behavior instead of Markdown run sections.

## Non-Goals

- No runtime behavior, cloud, deploy, kubectl, build/push or live-test change.
- No compaction of `agent-verify-manifest.json`.
- No compaction of docs/specs.
- No Go handler split.
- No claim that production runtime, billing, public access or commercial readiness is complete.

## Golden Path Impact

- no-impact: this package changes governance/doc lifecycle and local contract tests only.
- affected steps: history closeout, current-state index loop, cleanup lifecycle, change package lifecycle, local-contract verification.
- required golden path eval: no runtime golden path behavior changes; local proof uses `npm run test:contract` and `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- docs/active/README.md
- docs/history/README.md
- docs/policies/README.md
- specs/framework/spec.md
- tests/fixtures/v22/goal-current.json
- tests/fixtures/v22/agent-verify-manifest.json
