# owner-consumer-lifecycle-closeout-sync Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:retired-landed-branch-ref-closeout` Landing closeout generation may validate the latest landed branch from the machine cursor when the corresponding Git branch ref has already been retired after landing.

## MODIFIED

- Closeout-only commits now recognize the current `tests/governance/` taxonomy instead of the retired `tests/contract/` governance path.

## REMOVED

- None.

## CANNOT-CLAIM

- This sync cannot claim runtime behavior, live cloud behavior, billing, deployment, production readiness or real-cloud authorization completion.

## EVALS

- `node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk --json`
- `node tests/governance/governance-test-v22-landing-closeout-automation.mjs`
- `node tests/governance/governance-test-v22-current-state-index-loop.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `npm run verify`
