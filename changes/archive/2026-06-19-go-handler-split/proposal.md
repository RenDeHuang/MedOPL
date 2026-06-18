# go-handler-split Proposal

Status: authoring
Branch: cleanup/v22-go-handler-split
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework / Source

## Why

`services/medopl-go-backend/internal/server/handlers/controlplane.go` and `portal_projection.go` had grown to near-1000-line owner surfaces. That violates the OPL-style long-file split signal and makes route ownership harder to review.

## Goals

- Split control-plane handlers by provider, production contracts, OPL workflow, and shared helpers.
- Split portal projection handlers by state, public routes, admin routes, payload builders, mutations, and helpers.
- Keep package `handlers`, route registration, JSON payloads and public API behavior unchanged.
- Update contract tests so they inspect the handler package surface rather than pinning `controlplane.go` as a monolith.

## Non-Goals

- No new route, API behavior, runtime behavior, billing behavior or portal UX change.
- No compatibility facade.
- No deploy, kubectl, build/push, live-test or real cloud operation.
- No docs/specs or history compaction.

## Golden Path Impact

- no-impact: this package is source-structure cleanup only.
- affected steps: Go handler ownership, reviewability and handler package tests.
- required golden path eval: no golden-path runtime behavior changes; local proof uses Go handler package tests, go-backend service-surface contract and review gate.

## Authorization Boundary

- No secret read.
- No real cloud, deploy, kubectl, build/push or live-test.
- No changes under `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or upstream one-person-lab.

## Subscribed Truth

- AGENTS.md
- TASTE.md
- specs/framework/spec.md
- specs/source/spec.md
- services/medopl-go-backend/internal/server/handlers/**
- tests/contract/contract-test-v22-go-backend-service-surface.mjs
