# repo-native-change-lifecycle Proposal

Status: archived
Branch: cleanup/repo-native-change-lifecycle
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Framework

## Why

The repo already had one-person-lab-style truth taxonomy: active current truth, durable docs, evidence model, policies, history and local evals. The missing layer was a repo-native change package that records why a change exists, which specs it changes, which evals prove it and how it closes.

## Goals

- Add `changes/` as the repo-native change lifecycle surface.
- Add root `specs/` as durable behavior specs with requirement-to-eval traceability.
- Keep `docs/active/README.md` narrow and out of open-change details.
- Add local gates for change package lifecycle and spec/eval traceability.
- Wire registry, manifest and workflow review into the new lifecycle.

## Non-Goals

- Do not use OpenSpec CLI as a runtime dependency.
- Do not modify Portal, Gateway, Runtime Bridge or production service behavior.
- Do not read secrets, call real cloud, deploy, kubectl, build/push or live-test.
- Do not restore retired `docs/contracts/**`, `docs/recovery/**`, root stage docs or `scripts/smoke-test-*`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- No upstream, deploy, `.sentrux`, `adapters`, `infra` or one-person-lab upstream edits.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- specs/framework/spec.md
- docs/framework/README.md
- docs/evidence/README.md
- docs/policies/README.md
- docs/delivery/README.md
- docs/history/README.md
- tests/fixtures/v22/agent-verify-manifest.json

