# sentrux-v22-rules-alignment Spec Delta

Target specs:

- specs/source/spec.md

## ADDED

- `source:sentrux-v22-rules-alignment`: `.sentrux/rules.toml` must describe the v22 active source model, not the retired Node Portal backend / old adapter model. It must keep hard safety gates for cycles, upward violations and god files.

## MODIFIED

- The v22 source-surface structural gate is aligned to the active source truth before claiming local Sentrux readiness. Active surfaces are `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway` and `services/opl-runtime-bridge`; retired `services/portal/src`, old resource-provisioner adapter and old med-autoscience-runner assumptions must not remain the active rules model.

## REMOVED

- No requirement is removed by this package.

## CANNOT-CLAIM

- This package does not authorize `.sentrux/*` edits beyond `.sentrux/rules.toml`.
- This package does not prove production, real-cloud, deploy, kubectl, build/push or live-test readiness.
- This package does not prove future source changes will continue to satisfy `.sentrux/rules.toml` without rerunning Sentrux.

## EVALS

- `node tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs`
- `sentrux gate .`
- `sentrux check .`
