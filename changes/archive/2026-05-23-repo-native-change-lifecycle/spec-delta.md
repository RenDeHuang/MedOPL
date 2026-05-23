# repo-native-change-lifecycle Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:repo-native-change-lifecycle`: Formal engineering changes must use a repo-native change package with proposal, spec delta, design, tasks, eval plan, review, closeout and archive.

## MODIFIED

- `framework:change-package-required`: Change package lifecycle is now enforced by local gate, registry, manifest and workflow review.

## REMOVED

- None.

## CANNOT-CLAIM

- This does not mean OpenSpec CLI is installed or required.
- This does not authorize real cloud, deploy, kubectl, build/push or live-test.
- This does not make archived change packages current truth.

## EVALS

- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`
- `node tests/contract/contract-test-v22-test-lane-registry.mjs`
- `node tests/contract/contract-test-v22-agent-verify-entrypoint.mjs`
- `node tests/health/health-check-v22-workflow-gate.mjs`

