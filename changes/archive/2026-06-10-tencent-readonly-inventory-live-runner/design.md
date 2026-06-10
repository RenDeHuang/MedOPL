Owner: `MedOPL`
Purpose: `design`
State: `active_change`
Machine boundary: The runner and local gate test are the executable design boundary.

# Design

`tests/support/cloud-prework/tencent-readonly-inventory-support.js` is a repo-local executable boundary for Package B readonly inventory.

Inputs:

- `--secret-file <path>` points to a git-outside readonly env file.
- `--live-readonly` and `--confirm-current-session-authorization` are both required.
- `--sdk-mode fake-readonly` runs the local gate without cloud calls.
- `--sdk-mode tencent-official-sdk-readonly` requires `--enable-official-sdk-loader` before it loads official SDK packages or calls cloud.

Secret model:

- allowed keys are only `RUN_TENCENT_READONLY_INVENTORY`, `TENCENT_READONLY_SECRET_ID`, `TENCENT_READONLY_SECRET_KEY`, `TENCENT_READONLY_ACCOUNT_ID`, `TENCENT_READONLY_REGIONS`, `TENCENT_READONLY_ALLOWED_APIS` and optional `TENCENT_READONLY_COS_METADATA_PROBES`.
- any mutation, deploy, kubeconfig, database, GitHub or Langfuse secret key fails closed before report generation.

Output:

- stdout is a redacted summary.
- `.runtime/v22-tencent-readonly-inventory/<run-id>.json` is a redacted report.
- raw SecretId, SecretKey, headers, raw provider responses, COS probe bucket names, object keys, storage keys and signed URLs are never emitted.

SDK ownership:

- `tencentcloud-sdk-nodejs` and `cos-nodejs-sdk-v5` are root cloud tooling dependencies.
- Portal packages must not own Tencent/COS SDK dependencies.
- `tests/support/cloud-prework/lib/tencent-readonly-inventory-official-sdk-support.js` owns the dependency-injected wrapper.

Current implementation note:

The official SDK mode is intentionally conservative. Without `--enable-official-sdk-loader`, it fails before loading SDK packages. If `tencentcloud-sdk-nodejs` or `cos-nodejs-sdk-v5` is absent, it writes a blocker report instead of calling cloud. With explicit loader enablement, the wrapper only exposes readonly inventory methods: account identity, TKE cluster/node pool summaries, billing summary, tag resource summary, COS bucket list and optional COS object metadata HEAD. COS object body reads remain forbidden. COS object metadata proof requires explicit metadata probes; absent probes produce a sanitized blocker instead of a fake success.
