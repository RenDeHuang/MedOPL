# golden-path-first-class Proposal

Status: authoring
Branch: cleanup/golden-path-first-class
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product, Framework

## Why

MedOPL already has a durable framework, repo-native change packages and local gates, but the default working surface still reads like governance is the center. The product golden path exists in product docs and smoke tests, yet it is not the explicit first-class health surface that every agent sees before guardrail checks.

This change makes the golden path the first default proof: user readiness, credit, provider key, managed environment, OPL launch, file/run/artifact flow, billing/trace/audit and release closure must appear before governance gates in default verification and new change planning.

## Goals

- Define the MedOPL golden path as the default product spine.
- Make `node scripts/v22-verify.mjs current` show golden path health before governance guardrails.
- Require every new change package to declare Golden Path Impact.
- Keep governance gates as guardrails, not the default product narrative.
- Start reducing `services/portal/src/app/portal-runtime.mjs` fan-out through a narrow adjacent-module extraction.

## Non-Goals

- No real cloud execution, deploy, kubectl, build/push or live-test.
- No secret, `.env`, kubeconfig, token, SecretId/SecretKey or SSH private key read.
- No modification to `deploy/*`, `.sentrux/*`, `adapters/*`, `infra/*` or upstream One Person Lab.
- No claim that local smoke, proof or canary evidence proves production readiness.
- No broad Portal redesign or product-surface rewrite.

## Golden Path Impact

- Default product spine becomes: login / credit / provider key -> open managed environment -> launch OPL -> upload file / task -> run / artifact -> billing / trace / audit -> release / stop billing.
- Changes that touch product, runtime, framework, source, tests or delivery must declare whether they preserve, improve, narrow, defer or intentionally do not affect this spine.
- Governance gates remain required, but they follow golden path health in default verification.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- No provider, Langfuse, COS or production API calls.

## Subscribed Truth

- `AGENTS.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/framework/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/source/README.md`
- `changes/README.md`
- `specs/product/spec.md`
- `specs/framework/spec.md`
- `tests/fixtures/v22/goal-current.json`
- `tests/fixtures/v22/agent-verify-manifest.json`
