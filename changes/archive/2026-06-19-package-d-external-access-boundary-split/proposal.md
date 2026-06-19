# package-d-external-access-boundary-split Proposal

Owner: MedOPL Operations / Framework
Affected plane: Package D external access runner support module and local/future-authorized gates.
Purpose: split mode, argv, env and run-gate boundary helpers out of the Package D external access runner.
State: active_cleanup
Machine boundary: runner source and local gates are machine surfaces; Markdown prose is not a machine interface.

## Authorization Boundary

This cleanup is local-only. It does not authorize build/push, deploy, kubectl, live-test, Tencent mutation, DNS mutation, secret reads or cloud calls.

## Golden Path Impact

Impact: no-impact for the golden path. Public runner command strings and exported plan/run functions remain unchanged; this only narrows a long runner owner. Golden path eval remains `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` through `npm run verify`.

## Non-Goals

- Do not change external access behavior, command syntax or manifest shapes.
- Do not add compatibility wrappers or aliases.
- Do not run kubectl, build/push, deploy, live cloud checks or DNS mutation.

## Intent

The Package D external access runner mixed execution flow with argv, mode, env allowlist and run-gate validation. This package moves boundary validation into a dedicated support module so the runner remains a thinner plan/run/evidence entrypoint.
