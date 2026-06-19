# sentrux-health-signal-downgrade Spec Delta

Target specs:

- specs/source/spec.md

## ADDED

- `source:sentrux-health-signal`: Sentrux is optional repo health context and authorization-protected local diagnostic input, not current active truth, product truth, runtime truth or release readiness.

## MODIFIED

- `source:sentrux-v22-rules-alignment`: downgrade from active current gate to archived rules alignment provenance and optional repo health context.

## REMOVED

- The current verify bundle no longer requires `tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs`.

## CANNOT-CLAIM

- Local Sentrux signals do not prove production, real-cloud, deploy, kubectl, build/push, live-test, billing, runtime or OPL capability readiness.
- Archived Sentrux alignment does not authorize future `.sentrux/*` edits.

## EVALS

- `node tests/contract/contract-test-v22-validate-active-platform.mjs`
- `node tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs`
- `node tests/health/health-check-v22-workflow-gate.mjs`
