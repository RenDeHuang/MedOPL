# go-handler-split Closeout

Status: ready_for_landing_review

## Verification

- `cd services/medopl-go-backend && go test ./internal/server ./internal/server/handlers -count=1`: pass
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`: pass
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`: pass
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`: pass
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`: pass
- `git diff --check -- services tests changes specs`: pass

## Can Claim

- `controlplane.go` is split into owner-scoped handler files.
- `portal_projection.go` is split into owner-scoped projection files.
- The service-surface contract no longer pins route checks to the old monolithic `controlplane.go`.

## Cannot Claim

- Runtime behavior, public API behavior, deploy, billing, real cloud, kubectl, build/push or live-test changed.
- docs/specs, docs/history, agent verify manifest, machine cursor or workflow gate source is compacted.

## Plan Completion Audit

- functional: done
- code_cleanup: done
- docs_foldback: done
- verification: done
- retired_entrypoints: done
- cannot_claim: done

## Cleanup Result

- deleted: monolithic handler ownership inside `controlplane.go` and `portal_projection.go`.
- folded: handler functions into owner-scoped files under the same `handlers` package.
- retained: public routes, JSON payloads, package name, service interfaces and existing tests.
- reason: retained surfaces are current source/API owners with active consumers.
- next: continue with `v22-workflow-gate.mjs` split after script file budget is addressed.

## Archive Target

- changes/archive/2026-06-18-go-handler-split
