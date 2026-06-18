# managed-user-loop-smoke-rename Proposal

Owner: MedOPL Product / Framework
Affected plane: smoke lane registry, product spec, product docs and managed user loop smoke test.
Purpose: retire the active `mvp-user-loop` naming from the managed OPL user loop smoke surface.
State: active_cleanup
Machine boundary: test lane registry and smoke test behavior are machine surfaces; product docs are human owner surfaces and prose is not a machine API.

## Authorization Boundary

This cleanup is local-only. It does not authorize build/push, deploy, kubectl, live-test, Tencent mutation, secret reads or cloud calls.

## Golden Path Impact

Impact: improves naming alignment for the local smoke-golden managed user loop. The behavior is preserved and the golden path eval remains `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk` through `npm run verify`.

## Non-Goals

- Do not rename archived historical packages or old closeout evidence.
- Do not rename the broader `mvp-contract-suite` in this package.
- Do not change runtime, billing, cloud or UI behavior.

## Intent

The active smoke file described the current platform-managed user loop but still used `mvp-user-loop` identifiers. The active owner surface should say managed user loop, while historical MVP provenance remains in archive/history.
