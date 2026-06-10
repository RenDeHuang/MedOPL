Owner: `MedOPL`
Purpose: `tasks`
State: `archived_change`
Machine boundary: Task completion is verified by eval commands and git diff.

# TKE Bootstrap Preflight Tasks

- [x] Step 0: audit Package C dry-run and current TKE blocker.
- [x] Step 1: add failing TKE bootstrap preflight local gate.
- [x] Step 2: implement local dry-run preflight runner.
- [x] Step 3: register the gate in test classification and verify manifest.
- [x] Step 4: sync durable specs and docs truth.
- [x] Step 5: run TKE preflight local gate, `cloud-future-authorized`, review gate and whitespace check.
- [x] Step 6: self-review.
- [x] Step 7: commit, push, land to trunk and run post-merge closeout.
