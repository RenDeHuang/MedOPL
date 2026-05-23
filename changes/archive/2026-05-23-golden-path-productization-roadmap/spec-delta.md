# golden-path-productization-roadmap Spec Delta

Target specs:

- specs/product/spec.md
- specs/framework/spec.md
- specs/source/spec.md

## ADDED

- `product:golden-path-productization-roadmap` defines the six-package productization order after local RC: Figma UI absorption, typed Portal API contract, provider key reuse, OPL entry real state, Go control-plane takeover, real-cloud authorization.
- `framework:productization-roadmap-required` requires future implementation change packages that affect Portal UX, OPL entry, provider key, backend control plane or cloud authorization to declare which roadmap package they execute.
- `source:figma-ui-repo-native-absorption` records Figma Make as an external prototype input that must be absorbed into repo-native frontend source, typed API boundaries and local evals before being treated as implementation truth.
- `source:go-control-plane-takeover-order` records that Go should own MedOPL control-plane business truth, while Gateway and Runtime Bridge can remain thin Node anti-corruption / relay boundaries until explicit migration packages move them.

## MODIFIED

- `product:golden-path-default-spine` adds productization order as the default post-local-RC delivery spine.
- `framework:repo-native-change-lifecycle` clarifies that roadmap packages are not chat memory; they are repo-tracked change packages with eval plans and archive closeout.
- `source:active-services` clarifies that modern frontend/backend separation is a target state, not a claim that the current Node Portal backend has been replaced.

## REMOVED

- No durable requirement is removed in this package.

## CANNOT-CLAIM

- Cannot claim Figma Make prototype is production frontend truth before repo absorption, typed data wiring and local checks.
- Cannot claim all backend is Go or current production backend is Go.
- Cannot claim provider key reuse is implemented until a provider reuse package lands with evals.
- Cannot claim OPL entry is product-ready if it displays mock preflight or mock launch state.
- Cannot claim real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.

## EVALS

- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs specs changes tests scripts package.json`
