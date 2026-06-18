# opl-style-development-discipline-convergence Proposal

Status: authoring
Branch: feat/opl-style-development-discipline-convergence
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

MedOPL v22 already has repo-native lifecycle concepts, but the agent-facing rules and closeout tooling did not make cleanup, docs foldback, and Plan Completion Audit explicit enough for every formal change. This package hardens the OPL-style development discipline before the larger cleanup packages begin.

## Goals

- Make `AGENTS.md` state that ideal-state topology, code retirement, docs lifecycle foldback, and software engineering closure are required for maintenance development.
- Make closeout generation require structured Plan Completion Audit and Cleanup Result fields.
- Make review gate block modified closeouts that do not carry the structured audit and cleanup result.
- Keep enforcement on machine behavior and structured fields, not on Markdown prose wording.

## Non-Goals

- No product runtime behavior changes.
- No real cloud, deploy, kubectl, build/push or live-test.
- No broad cleanup of historical large files in this package.
- No claim that existing historical packages already satisfy the new structured closeout shape.

## Golden Path Impact

- no-impact: this package changes governance and local gates only.
- affected steps: authoring branch, landing gate, closeout generation, cleanup planning.
- required golden path eval: no golden path runtime eval is required; local governance validation uses `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/evidence/README.md
- docs/policies/README.md
