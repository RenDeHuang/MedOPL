# docs-specs-index-only Proposal

Status: authoring
Branch: cleanup/v22-docs-specs-index-only
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Framework

## Why

`docs/specs/README.md` had become an 11k-line mixed prose, JSON contract and history surface. That violates the repo rule that narrative docs are not stable machine interfaces.

## Goals

- Make `docs/specs/README.md` a compact human index.
- Move durable assertions to root `specs/<domain>/spec.md`, source, fixtures and tests.
- Remove tests that parse `docs/specs/README.md` prose or fenced JSON as machine truth.

## Non-Goals

- No runtime behavior change.
- No real cloud, deploy, kubectl, build/push or live-test.
- No broad product spec redesign.

## Golden Path Impact

- preserves: default MVP and golden smoke behavior.
- affected steps: contract lookup, runtime bridge contract checks, product smoke checks.
- required golden path eval: `node tests/contract/contract-test-v22-mvp-contract-suite.mjs`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- docs/active/README.md
- docs/specs/README.md
- specs/product/spec.md
- specs/runtime/spec.md
- specs/framework/spec.md
- specs/source/spec.md
- docs/evidence/README.md
- docs/policies/README.md
