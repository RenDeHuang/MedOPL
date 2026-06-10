Owner: `MedOPL Platform`
Purpose: `design`
State: `active_change`
Machine boundary: This design is human-readable. Enforcement is in tests, specs, scripts and repo paths.

# repo-governance-closeout Design

## Architecture

`scripts/` remains the repo-native v22 control-plane surface: verify, workflow gate, test classification, closeout, repo hygiene, bloat, line budget and local services.

`tests/support/cloud-prework/` owns bounded pre-cloud support modules that may be run only through explicit test or authorization contexts. This keeps cloud prework available without treating it as a default agent control plane.

## Data Flow

Tests in `tests/future-authorized/cloud/` call the cloud-prework tools with local fake or dry-run inputs. Reports are written only to temporary directories during tests or `.runtime` during explicitly authorized live readonly runs.

## Failure Modes

- Missing authorization flags fail closed.
- Secret-file or mutation/deploy/kubectl/build/push args fail closed where the tool is local-only.
- Readonly inventory live mode remains current-session authorization only and redacts stdout/report output.
- Sentrux or repo bloat failure blocks claiming the governance closeout.

## Surface Impact

- source: move cloud-prework support from `scripts/` to `tests/support/cloud-prework/`.
- docs: active truth wording and specs references stay aligned to the authorization boundary.
- specs: framework, operations and runtime owner surfaces updated.
- tests: future-authorized cloud gates keep proving the moved tools.
