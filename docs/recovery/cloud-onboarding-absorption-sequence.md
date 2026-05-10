# v22 Cloud Onboarding Absorption Sequence

program id: v22-cloud-onboarding

purpose: define the six-branch split and the B-window ff-only absorption order for the former mixed cloud onboarding branch.

model record: `gpt-5.3-codex`.

This document is an absorption guide only. It does not authorize reading secrets, real Tencent Cloud calls, dependency installation, build/push, kubectl, live-test, merge, or push by itself. B remains the only integration/review/absorption window for `recovery/platform-v22-trunk`.

## Contract Subscription

This branch subscribes to:

- `docs/contracts/README.md`
- `docs/contracts/v22-cloud-onboarding-workflow-boundary.md`
- `docs/contracts/v22-tencent-readonly-inventory-boundary.md`
- `docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md`
- `docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md`
- `docs/recovery/cloud-onboarding-execution-board.md`
- `docs/recovery/cloud-onboarding-status-table.md`
- `docs/recovery/cloud-onboarding-verification-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`

## Split Branches

The former mixed branch `feat/v22-cloud-onboarding-connect-cloud` must not be absorbed directly. Its material is split into six reviewable branches:

| order | branch | anchor commit | B absorption role | scope |
| --- | --- | --- | --- | --- |
| 1 | `feat/v22-portal-cloud-operation-test-bridge` | `9fabaa1` | first | Portal test-only fake-live cloud operation API bridge |
| 2 | `contract/v22-cloud-onboarding-runnable-path` | `352d00a` | after 1 | R-00..R-21 runnable path, CC gates, workflow task packet shape |
| 3 | `feat/v22-tencent-sdk-readonly-connection` | `2b6a631` | after 2 | Tencent official SDK / COS SDK dependency diff and readonly connection loader/client |
| 4 | `feat/v22-tencent-resource-lifecycle-gates` | `5eb3349` | after 3 | Package C TKE/COS lifecycle runner gates, dry-run and fake-live local proof |
| 5 | `feat/v22-tencent-deploy-execution-gates` | `846a381` | after 4 | Package D TCR/build-push/kubectl deploy/runtime smoke gates |
| 6 | `docs/v22-cloud-onboarding-absorption-sequence` | B verifies current branch head | after 5 | This absorption sequence, branch scope map, and B verification checklist |

Required ancestry before B absorbs:

- `recovery/platform-v22-trunk -> feat/v22-portal-cloud-operation-test-bridge` must be ff-only.
- `feat/v22-portal-cloud-operation-test-bridge -> contract/v22-cloud-onboarding-runnable-path` must be ff-only.
- `contract/v22-cloud-onboarding-runnable-path -> feat/v22-tencent-sdk-readonly-connection` must be ff-only.
- `feat/v22-tencent-sdk-readonly-connection -> feat/v22-tencent-resource-lifecycle-gates` must be ff-only.
- `feat/v22-tencent-resource-lifecycle-gates -> feat/v22-tencent-deploy-execution-gates` must be ff-only.
- `feat/v22-tencent-deploy-execution-gates -> docs/v22-cloud-onboarding-absorption-sequence` must be ff-only.

B must stop if any pair is not `0 1` by `git rev-list --left-right --count <previous>...<next>`, if any worktree is dirty, if any branch includes unrelated surface changes, or if any branch introduces secret material.

## Branch Scope Boundaries

Branch 1 can be absorbed only as a test-only Portal bridge. It must keep `testOnly=true`, `productionPortalConnected=false`, `runnerMode=fake-live`, and `realCloudCalls=false`. It does not prove production Portal, production queue, production PostgreSQL, or real cloud connectivity.

Branch 2 can be absorbed only as workflow and runnable path contract material. It defines R-00..R-21 and CC gate mapping; it does not run live cloud, install dependencies, create resources, deploy, or push images.

Branch 3 can be absorbed only as readonly SDK connection material. It may include reviewed package diff and readonly loader/client shape; it does not authorize mutation APIs, real secret reads, real cloud mutation, or production Portal integration.

Branch 4 can be absorbed only as Package C lifecycle gates. Package C covers TKE/COS resource lifecycle gate shape, dry-run, and fake-live local proof. It must not delete, close, or scale someone else's nodes or storage. Real resource mutation remains user-authorized, scoped, tagged, audited, and fail-closed.

Branch 5 can be absorbed only as Package D deploy gates. Package D covers TCR repository/tag preflight, unique test tag, digest verification, deploy dry-run, authorized rollout shape, runtime smoke, and rollback evidence. Package D does not authorize Package C lifecycle actions, does not create/delete/scale TKE node pools, does not create/delete/empty/expand COS bucket/prefix/object, and forbids `kubectl delete`.

Branch 6 can be absorbed only as this B sequence and smoke guard. It must not add cloud runners, Portal production APIs, queue/store implementation, real cloud calls, or deployment behavior.

## B Verification Commands

B should run these checks before each absorption step:

```bash
git status --short --branch
git rev-list --left-right --count <previous-branch>...<next-branch>
git diff --name-only <previous-branch>...<next-branch>
git diff --check <previous-branch>...<next-branch>
git diff <previous-branch>...<next-branch> | rg -n -f <secret-hygiene-patterns-file>
```

B should run these smoke commands at the end of the stacked absorption, or on the branch that first introduces each smoke:

```bash
node scripts/smoke-test-v22-portal-cloud-operation-test-api-fake-live.mjs
node scripts/smoke-test-v22-cloud-connection-runnable-path.mjs
node scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs
node scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs
node scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs
node scripts/smoke-test-v22-tencent-authorized-resource-lifecycle-live-gate.mjs
node scripts/smoke-test-v22-authorized-tencent-deploy-execution-contract.mjs
node scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs
node scripts/smoke-test-v22-tencent-authorized-deploy-execution-live-gate.mjs
node scripts/smoke-test-v22-cloud-onboarding-absorption-sequence.mjs
```

`node scripts/smoke-test-v22-mvp-contract-suite.mjs` remains the suite-level gate, but it requires the local Portal dependencies needed by the Portal runtime loop. If `services/portal/node_modules` is absent, B must either explicitly authorize dependency installation for that verification worktree or record the suite as blocked by missing local dependencies; B must not treat that blocked run as a product failure or as a pass.

## Not Yet Production Complete

After all six branches are absorbed, the cloud onboarding module is better structured and locally gated, but these production claims remain false:

- Production Portal is not yet connected to a real queue and PostgreSQL canonical store for cloud operations.
- Real Package C resource lifecycle operations are not authorized by this absorption guide.
- Real Package D build/push/kubectl operations are not authorized by this absorption guide.
- TKE node creation/deletion, COS storage creation/deletion, TCR push, runtime deployment, COS billing reconciliation, and final cleanup are not complete unless separately proven by user-authorized live evidence outside git.
- The test-only Portal API is not a production cloud operation API.

## Machine Data

<!-- v22-cloud-onboarding-absorption-sequence:start -->
```json
{
  "programId": "v22-cloud-onboarding",
  "modelRecord": "gpt-5.3-codex",
  "sourceMixedBranch": "feat/v22-cloud-onboarding-connect-cloud",
  "directMixedBranchAbsorptionAllowed": false,
  "targetTrunk": "recovery/platform-v22-trunk",
  "bWindowOnly": true,
  "requiresFfOnlyChain": true,
  "readsSecretNow": false,
  "callsRealCloudNow": false,
  "runsBuildPushKubectlNow": false,
  "runsDependencyInstallNow": false,
  "authorizesRealMutationNow": false,
  "branches": [
    {
      "order": 1,
      "branch": "feat/v22-portal-cloud-operation-test-bridge",
      "anchorCommit": "9fabaa1",
      "scope": "portal_test_only_fake_live_bridge",
      "productionPortalConnected": false,
      "realCloudCalls": false
    },
    {
      "order": 2,
      "branch": "contract/v22-cloud-onboarding-runnable-path",
      "anchorCommit": "352d00a",
      "scope": "runnable_path_and_cc_gates",
      "runnableSteps": "R-00..R-21"
    },
    {
      "order": 3,
      "branch": "feat/v22-tencent-sdk-readonly-connection",
      "anchorCommit": "2b6a631",
      "scope": "official_sdk_readonly_connection",
      "mutationAllowed": false
    },
    {
      "order": 4,
      "branch": "feat/v22-tencent-resource-lifecycle-gates",
      "anchorCommit": "5eb3349",
      "scope": "package_c_resource_lifecycle_gates",
      "forbidsUnownedNodeOrStorageMutation": true
    },
    {
      "order": 5,
      "branch": "feat/v22-tencent-deploy-execution-gates",
      "anchorCommit": "846a381",
      "scope": "package_d_deploy_execution_gates",
      "modifiesTkeNodePool": false,
      "modifiesCosStorage": false,
      "forbidsKubectlDelete": true
    },
    {
      "order": 6,
      "branch": "docs/v22-cloud-onboarding-absorption-sequence",
      "anchorCommit": "B verifies current branch head",
      "scope": "b_absorption_sequence_only",
      "addsRunner": false
    }
  ],
  "ffOnlyPairs": [
    ["recovery/platform-v22-trunk", "feat/v22-portal-cloud-operation-test-bridge"],
    ["feat/v22-portal-cloud-operation-test-bridge", "contract/v22-cloud-onboarding-runnable-path"],
    ["contract/v22-cloud-onboarding-runnable-path", "feat/v22-tencent-sdk-readonly-connection"],
    ["feat/v22-tencent-sdk-readonly-connection", "feat/v22-tencent-resource-lifecycle-gates"],
    ["feat/v22-tencent-resource-lifecycle-gates", "feat/v22-tencent-deploy-execution-gates"],
    ["feat/v22-tencent-deploy-execution-gates", "docs/v22-cloud-onboarding-absorption-sequence"]
  ],
  "productionGaps": [
    "production_portal_queue_postgresql_canonical_store",
    "user_authorized_real_package_c_lifecycle_execution",
    "user_authorized_real_package_d_build_push_kubectl",
    "cos_billing_reconciliation_live_evidence",
    "final_b_review_cleanup_evidence"
  ]
}
```
<!-- v22-cloud-onboarding-absorption-sequence:end -->
