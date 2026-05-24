# local-control-plane-hardening Tasks

- [ ] Step 0: create change package, record subscribed truth, authorization boundary and baseline eval results.
- [ ] Step 1: add local service readiness gate for current-repo service identity and port hygiene.
- [ ] Step 2: remove active runtime dependency on `scripts/sync-workspace-file-to-minio.ps1` and gate the retirement.
- [ ] Step 3: reduce `portal-runtime.mjs` fan-out with focused runtime assembly extraction and structure regression.
- [ ] Step 4: tighten Go control-plane takeover readiness gates without production replacement claim.
- [ ] Step 5: run full local eval bundle, review, archive package and write compact history closeout.
- [ ] Step 6: ff-only absorb into `recovery/platform-v22-trunk`, run post-merge evals, push only after evals pass.
