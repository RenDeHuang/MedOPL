Owner: `MedOPL`
Purpose: `design`
State: `active_change`
Machine boundary: The runner and local gate test are the executable design boundary.

# Design

`scripts/v22-tencent-readonly-inventory-runner.mjs` is a repo-local executable boundary for Package B readonly inventory.

Inputs:

- `--secret-file <path>` points to a git-outside readonly env file.
- `--live-readonly` and `--confirm-current-session-authorization` are both required.
- `--sdk-mode fake-readonly` runs the local gate without cloud calls.
- `--sdk-mode tencent-official-sdk-readonly` attempts to load official SDK packages and fail closed if absent.

Secret model:

- allowed keys are only `RUN_TENCENT_READONLY_INVENTORY`, `TENCENT_READONLY_SECRET_ID`, `TENCENT_READONLY_SECRET_KEY`, `TENCENT_READONLY_ACCOUNT_ID`, `TENCENT_READONLY_REGIONS` and `TENCENT_READONLY_ALLOWED_APIS`.
- any mutation, deploy, kubeconfig, database, GitHub or Langfuse secret key fails closed before report generation.

Output:

- stdout is a redacted summary.
- `.runtime/v22-tencent-readonly-inventory/<run-id>.json` is a redacted report.
- raw SecretId, SecretKey, headers, raw provider responses, object keys, storage keys and signed URLs are never emitted.

Current implementation note:

The official SDK mode is intentionally conservative. If `tencentcloud-sdk-nodejs` or `cos-nodejs-sdk-v5` is absent, it writes a blocker report instead of calling cloud. Real provider calls require a follow-up SDK wrapper package.
