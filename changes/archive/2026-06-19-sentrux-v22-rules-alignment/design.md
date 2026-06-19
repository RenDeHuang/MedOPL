# sentrux-v22-rules-alignment Design

## Architecture

This package is a local governance boundary. It updates `.sentrux/rules.toml` under explicit user authorization, keeps the v22 source model visible in current verification and does not change product runtime behavior.

## Data Flow

1. `sentrux check .` is the CI-style structural rule check.
2. `sentrux gate .` is the non-regression structural gate.
3. `docs/source/README.md` owns v22 active source truth.
4. `changes/active/sentrux-v22-rules-alignment` owns the rules alignment cursor.
5. `tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs` verifies the v22 rules model and authorization boundary.

## Authorized Edit Shape

The authorized `.sentrux/rules.toml` edit:

- remove retired `services/portal/src` layer and boundary paths.
- remove old adapter layer assumptions such as `adapters/resource-provisioner` and `adapters/med-autoscience-runner`.
- add active v22 source layers for `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge`, scripts/tests/docs and specs.
- keep `max_cycles = 0`.
- keep `max_upward_violations = 0`.
- keep `no_god_files = true`.
- set modularity threshold to an evidence-backed v22 baseline after comparing `sentrux check .`, `sentrux gate .`, source truth and local experiments: measured `0.7594`, configured lower bound `0.759`.

## Failure Modes

- `.sentrux/*` edits outside `.sentrux/rules.toml` remain unauthorized.
- Source splitting that does not improve Sentrux evidence should be stopped and recorded.
- Lowering `min_modularity` without v22 evidence fails review.
- Claiming repository structure satisfies `.sentrux/rules.toml` while `sentrux check .` fails is forbidden.

## Surface Impact

- source: none
- docs: change package only
- specs: `specs/source/spec.md`
- tests: contract boundary test
