# golden-path-productization-roadmap Eval Plan

## Required Commands

```bash
node tests/contract/contract-test-v22-change-package-lifecycle.mjs
node tests/contract/contract-test-v22-spec-eval-traceability.mjs
node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs specs changes tests scripts package.json
```

## Evidence Level

- local contract proof
- local smoke evidence for unchanged golden path suite

## Can Claim

- The post-local-RC productization sequence is repo-native and subscribable.
- Future branches have a canonical delivery order for Figma UI absorption, typed API, provider reuse, OPL entry real state, Go control-plane takeover and real-cloud authorization.
- Go is clarified as the canonical control-plane backend target, not current production backend.

## Cannot Claim

- Figma UI has been absorbed into repo source.
- Provider key reuse has been implemented.
- OPL entry renders real preflight / launch state.
- Go backend has replaced Node Portal backend.
- Real cloud, deploy, kubectl, build/push, live-test or production billing is authorized.
