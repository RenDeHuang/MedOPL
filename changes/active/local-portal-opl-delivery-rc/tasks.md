# local-portal-opl-delivery-rc Tasks

- [x] Step 0: sync post-push truth closeout for `feat/v22-local-saas-backend-closure`.
- [x] Step 1: open this change package and register the non-cloud Portal/OPL delivery boundary.
- [x] Step 2: add local release orchestration commands for plan/check/start/stop/status/logs.
- [x] Step 3: add local persistent state profile for Portal delivery without adding a second control plane.
- [x] Step 4: move Portal local delivery projection from static `local-rc` toward service-backed local state where required by the golden path.
- [x] Step 5: add OPL local delivery RC verification through Gateway and Runtime Bridge without changing upstream.
- [x] Step 6: add `verify:local-release-candidate` and manifest/current wiring.
- [x] Step 7: run evals and prepare review closeout for landing.
- [ ] Step 8: archive and history handoff after landing to trunk.
