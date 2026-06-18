# current-leaf-owner-compaction-closeout-sync Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:cleanup-closeout-non-self-reference` Cleanup landed commits are allowed to be followed by closeout-only commits; the closeout gate continues to block non-closeout commits after the latest landed commit.

## MODIFIED

- None.

## REMOVED

- None.

## CANNOT-CLAIM

- This closeout sync cannot claim additional cleanup, runtime behavior, deploy, live cloud behavior, billing or production readiness.

## EVALS

- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-landing-closeout.mjs check --trunk-ref HEAD --json`
- `node tests/contract/contract-test-v22-current-state-index-loop.mjs`
- `node tests/contract/contract-test-v22-landing-closeout-automation.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run verify`
