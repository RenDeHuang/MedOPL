# local-golden-path-release-candidate Design

## Architecture

The local RC keeps the existing MedOPL boundaries:

```text
Portal local control plane
-> OPL Web Gateway
-> local clean OPL WebUI
-> Runtime Bridge
-> Portal trace/artifact projection
```

The gflabtoken provider key enters only at the local RC test process boundary and is sent to Portal as a user-owned provider key payload. Portal writes a backend provider secret reference and passes only `providerKeyRef` into the launch/runtime projection.

## Data Flow

1. Local test reads the user-authorized local provider credential from process environment.
2. Test logs in to local Portal with the local dev account.
3. Test creates or switches to a local workspace.
4. Test calls `/portal/api/opl/launch` with `providerKeyPayload`.
5. Portal returns `providerBound=true`, non-empty `providerKeyRef`, `openUrl=http://127.0.0.1:18789/` and an `opl_portal_launch` cookie.
6. Gateway serves local OPL WebUI with `portal-launch.js` injected.
7. Test sends a message through `/portal/api/opl/messages?launchId=<id>`.
8. Runtime Bridge returns a message reply, artifact and trace projection.

## Failure Modes

- Missing authorized provider credential: skip/fail the local RC live-provider eval with `GFLABTOKEN_REQUIRED`, not a production claim.
- Missing workspace: return `workspace_id_required`.
- Missing provider config: return `provider_config_required`.
- OPL WebUI unavailable: return `opl_upstream_url_required` or Gateway failure.
- Raw key leakage: fail the eval immediately.

## Surface Impact

- source: no production source change expected unless the eval exposes a bug.
- docs: change package and history closeout only.
- specs: accepted delta is recorded in this package; durable spec sync occurs only if review accepts it.
- tests: add `tests/local-rc/local-rc-test-v22-provider-bound-message-backflow.mjs`.
