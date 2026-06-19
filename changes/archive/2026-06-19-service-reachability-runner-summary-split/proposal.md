# service-reachability-runner-summary-split Proposal

Owner: MedOPL Operations / Framework
Affected plane: Package D service reachability runner support module and local future-authorized gate.
Purpose: split redaction, curl and Kubernetes summary helpers out of the Package D service reachability runner.
State: active_cleanup
Machine boundary: runner source and local/future-authorized tests are machine surfaces; Markdown prose is not a machine interface.

## Authorization Boundary

This cleanup is local-only. It does not authorize build/push, deploy, kubectl, live-test, Tencent mutation, secret reads or cloud calls.

## Golden Path Impact

Impact: no-impact for the golden path. The runner public command and exported functions remain unchanged; this only narrows a long helper-heavy runner. Golden path eval remains `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` through `npm run verify`.

## Non-Goals

- Do not change service reachability behavior or command syntax.
- Do not add compatibility wrappers or aliases.
- Do not run kubectl, build/push, deploy or live cloud checks.

## Intent

The Package D service reachability runner mixed execution flow with redaction, curl parsing and Kubernetes summary helpers. This package moves summary helpers into a dedicated support module so the runner remains a thinner owner entrypoint.
