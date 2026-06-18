# go-handler-split Spec Delta

Target specs:

- specs/framework/spec.md

## ADDED

- `framework:go-handler-split` Go backend handler files must follow owner boundaries once a handler source approaches the long-file split signal. Tests must inspect the handler package surface, not force a single monolithic source file.

## MODIFIED

- `framework:repo-health-contraction` is extended by this package's concrete Go handler source split. The long-file signal now has an accepted handler package example under `services/medopl-go-backend/internal/server/handlers/**`.

## REMOVED

- Monolithic handler ownership in `controlplane.go` and `portal_projection.go`.
- Service-surface test coupling that required control-plane route markers to live in `internal/server/handlers/controlplane.go`.

## CANNOT-CLAIM

- This package does not change runtime behavior, public API behavior, billing behavior, production readiness, real cloud readiness, deploy authorization, kubectl authorization, build/push authorization or live-test authorization.

## EVALS

- `cd services/medopl-go-backend && go test ./internal/server ./internal/server/handlers -count=1`
- `node tests/contract/contract-test-v22-go-backend-service-surface.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
