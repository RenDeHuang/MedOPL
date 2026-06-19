# package-c-postgres-ledger-env-split Proposal

Owner: MedOPL Operations / Framework
Affected plane: Package C PostgreSQL ledger sink support module and local future-authorized gate.
Purpose: split env parsing, validation and redaction helpers out of the Package C PostgreSQL ledger sink.
State: active_cleanup
Machine boundary: sink source and local/future-authorized tests are machine surfaces; Markdown prose is not a machine interface.

## Authorization Boundary

This cleanup is local-only. It does not authorize real PostgreSQL execution, Tencent mutation, build/push, deploy, kubectl, live-test, secret reads or cloud calls.

## Golden Path Impact

Impact: no-impact for the golden path. Public sink exports and CLI entrypoint remain unchanged; this only narrows a long helper-heavy sink. Golden path eval remains `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` through `npm run verify`.

## Non-Goals

- Do not change PostgreSQL sink SQL behavior, CLI syntax or exported API.
- Do not add compatibility wrappers or aliases.
- Do not run real PostgreSQL, kubectl, build/push, deploy, live cloud checks or Tencent mutation.

## Intent

The Package C PostgreSQL ledger sink mixed sink behavior with env parsing, allowlist validation and redaction helpers. This package moves those helpers into a dedicated support module while keeping the sink as the active owner for prepare-only and canary sink behavior.
