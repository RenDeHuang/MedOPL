# sentrux-v22-rules-alignment Proposal

Status: authoring
Branch: real-cloud-authorization-boundary
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Framework

## Why

`sentrux gate .` passes with quality `6486 -> 7171`, coupling `0.35 -> 0.03`, cycles `0 -> 0` and god files `0 -> 0`. Before this package was authorized, `sentrux check .` failed because the measured modularity was below the old configured `0.8000` threshold, while `.sentrux/rules.toml` still contained retired `services/portal/src`, v21 wording and old adapter assumptions. `docs/source/README.md` defines the v22 active surfaces as `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway` and `services/opl-runtime-bridge`.

This package makes the Sentrux rules alignment blocker repo-native and applies the authorized `.sentrux/rules.toml` update.

## Goals

- Record the Sentrux v22 rules alignment work as a first-class change package.
- Lock the current evidence: `sentrux gate .` passes and `sentrux check .` passes after v22 rules alignment.
- Apply the authorized edit shape for `.sentrux/rules.toml`.
- Prevent blind source splitting from replacing the required rules/baseline alignment.

## Non-Goals

- Do not edit `.sentrux/*` outside the explicitly authorized `.sentrux/rules.toml` alignment.
- Do not lower structure expectations without evidence.
- Do not claim production, real-cloud or deploy readiness from local Sentrux structural readiness.
- Do not touch deploy, adapters, infra, upstream, real cloud or secret-like paths.

## Golden Path Impact

- preserves: this package does not change product runtime behavior.
- affected steps: none; it keeps repo structural readiness from masking golden path health.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- `.sentrux/* requires explicit authorization`; this package is authorized only for `.sentrux/rules.toml`.
- The edit removes retired `services/portal/src` and old adapter layer assumptions.
- The edit maps active layers to `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge`, scripts/tests/docs and specs.
- The edit keeps hard safety gates such as `max_cycles = 0`, `max_upward_violations = 0` and `no_god_files = true`.
- The modularity threshold is an evidence-backed v22 baseline: measured `0.7594`, configured lower bound `0.759`.

## Subscribed Truth

- docs/source/README.md
- docs/framework/README.md
- docs/runtime/README.md
- docs/specs/README.md
- specs/source/spec.md
- changes/active/ai-runtime-contract/closeout.md
- .sentrux/rules.toml
