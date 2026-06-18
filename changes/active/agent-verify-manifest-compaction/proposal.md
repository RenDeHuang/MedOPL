# agent-verify-manifest-compaction Proposal

Status: authoring
Branch: cleanup/v22-agent-verify-manifest-compaction
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Ideal State

`tests/fixtures/v22/agent-verify-manifest.json` is a compact current verification manifest. It records current runner entrypoints, suites, package bundles, branch overrides and the single active current leaf. Closed historical leaves are provenance and belong to git history, archived change packages and docs/history summary, not the active machine manifest.

## Current Gap

The manifest still stores 13 closed historical leaves plus the current leaf. Those historical leaves duplicate command arrays, allowed files, forbidden files, forbidden ops and writeback metadata that the runner no longer needs for current execution.

## Goals

- Keep only the current cursor leaf in `agent-verify-manifest.json`.
- Add a contract that prevents historical leaves from returning to the active manifest.
- Preserve current runner behavior for `current`, `suite`, `package`, `review` and `list` modes.
- Avoid adding a compatibility archive fixture.

## Non-Goals

- No docs/specs or docs/history foldback in this package.
- No suite/package command catalog rewrite in this package.
- No Go handler split.
- No workflow gate split.
- No runtime, cloud, deploy, kubectl, build/push or live-test change.

## Golden Path Impact

- no-impact: this package changes local verification manifest hygiene only.
- affected steps: `node scripts/v22-verify.mjs list --json`, current dry-run planning and current-state fixture contract.
- golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json` remains the product health check; this package does not replace or weaken it.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- docs/active/README.md
- docs/policies/README.md
- specs/framework/spec.md
- tests/fixtures/v22/goal-current.json
- tests/fixtures/v22/agent-verify-manifest.json
