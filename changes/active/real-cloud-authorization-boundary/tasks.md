# real-cloud-authorization-boundary Tasks

- [x] Step 0: baseline audit current authorization cursor.
- [x] Step 1: create active change package for the cursor.
- [x] Step 1a: record Package D deploy readiness planning for stable上线 without deploy execution.
- [x] Step 1b: add Package D local shape gate for default-disabled deploy env, Portal runtime PostgreSQL endpoint, manifest scheduling target and rollback plan shape.
- [x] Step 1c: add Package D reviewable release plan shape with `releasePlanReady=true` and `realExecutionReady=false`.
- [x] Step 1d: add Package D execution boundary preflight gate for split deploy/runtime env allowlists, redaction and fixed target checks while keeping `realExecutionReady=false`.
- [x] Step 1e: add Package D production-deploy-apply/live runner contract and local/future-authorized gate without executing deploy.
- [x] Step 1f: fix Package D portal/runtime bridge writable path contract after authorized production deploy rollout diagnostics.
- [x] Step 1g: record Package D production-deploy-apply success and next ClusterIP reachability / external access strategy gap.
- [ ] Step 2: receive explicit authorization for any sensitive operation class.
- [ ] Step 3: update spec delta after authorization scope is known.
- [x] Step 4: run local future-authorized evals.
- [ ] Step 5: run approved live evidence collection only if separately authorized.
- [ ] Step 6: review, close out, archive and sync durable specs.
