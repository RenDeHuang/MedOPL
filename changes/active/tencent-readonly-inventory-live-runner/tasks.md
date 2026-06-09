Owner: `MedOPL`
Purpose: `tasks`
State: `active_change`
Machine boundary: Task completion is verified by repo-native commands.

# Tasks

- [x] Add readonly live runner local gate test.
- [x] Implement fail-closed readonly inventory runner.
- [x] Add root cloud tooling Tencent/COS SDK dependency diff.
- [x] Add official SDK shape gate.
- [x] Add dependency-injected official SDK readonly wrapper local gate.
- [x] Register the local gate in `real-cloud-readiness`.
- [x] Run `npm run test:real-cloud-readiness`.
- [x] Attempt authorized official SDK mode with the provided readonly env and record sanitized report/blocker output.
- [x] Run `npm run gate:review` after change package is complete.
- [x] Commit and push the runner branch after verification.
