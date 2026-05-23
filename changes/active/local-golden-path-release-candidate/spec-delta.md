# local-golden-path-release-candidate Spec Delta

Target specs:

- `specs/runtime/spec.md`
- `specs/evidence/spec.md`

## ADDED

- `runtime:local-rc-provider-key-message-backflow`: A local RC may verify Portal launch, Gateway OPL entry, Runtime Bridge message reply and artifact/trace projection only when a user-owned gflabtoken provider key is provided through the backend secret boundary and public output contains only `providerKeyRef`.
- `evidence:local-provider-key-bound-message-proof`: Local provider-key-bound message evidence can claim bounded local message backflow and artifact/trace projection shape, but cannot claim production provider readiness or cloud deployment.

## MODIFIED

- None.

## REMOVED

- None.

## CANNOT-CLAIM

- Local provider-key-bound message proof is not production provider evidence.
- Local OPL WebUI HTTP 200 is not production OPL readiness.
- Runtime Bridge artifact projection is not production billing, cloud inventory or deploy evidence.
- Raw provider key must not appear in response payloads, logs, docs, evidence, git or final report.

## EVALS

- `node tests/local-rc/local-rc-test-v22-provider-key-message-backflow.mjs`
- `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`
- `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk`
