# gateway-launch-bridge-split Design

## Architecture

`services/opl-web-gateway/src/launch-client-script.mjs` remains the only public source entrypoint and only exports `portalLaunchClientScript()`. The implementation becomes a thin composer that joins owner-scoped browser-script sections from `services/opl-web-gateway/src/launch-client-script/**`.

Carrier split:

- `bootstrap.mjs`: template join helpers.
- `constants.mjs`: bootstrap constants and telemetry bootstrap section.
- `storage.mjs`: launch state/bootstrap sessionStorage helpers.
- `direct-entry-shell.mjs`: direct entry shell and route watcher section.
- `portal-api-client.mjs`: fetchJson, polling and stable browser API section.
- `provider-key-panel.mjs`: gflabtoken key panel and bind flow section.
- `native-message-run-bridge.mjs`: native message/run bridge section.
- `launch-flow.mjs`: complete launch and initialize flow section.

## Data Flow

The generated script is still returned as a single string. No runtime data path changes: sessionStorage keys, window globals, runtime-bridge URLs, public payload filtering and telemetry markers remain in the generated output.

## Failure Modes

- If the public entrypoint grows back into a monolith, the regression gate fails on main-file line count.
- If split modules disappear, the gateway static boundary regression fails.
- If string composition changes browser behavior, the launch regression fails.
- If the main file returns below the default line budget but the baseline is still pinned, the line-budget gate fails until retired.

## Surface Impact

- source: `services/opl-web-gateway/src/launch-client-script.mjs`, `services/opl-web-gateway/src/launch-client-script/**`
- docs: `docs/source/README.md`
- specs: `specs/source/spec.md`
- tests: gateway launch regressions, line-budget health gate, line-budget baseline fixture
