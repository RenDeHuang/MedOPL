# local-portal-opl-delivery-rc Design

## Architecture

The package has two delivery modules and one frozen module. Portal delivery owns `services/portal/frontend` and `services/medopl-go-backend`; it must become a local SaaS control-plane RC with durable local state and repeatable startup. OPL delivery owns `services/opl-web-gateway` and `services/opl-runtime-bridge`; it keeps one-person-lab upstream external and clean, using only Gateway, Runtime Bridge and public/local integration boundaries. Cloud delivery is frozen behind `real-cloud-authorization-boundary` and remains fail-closed.

## Data Flow

Portal flow: frontend typed API -> Go backend -> local state store -> public projection. Provider key input enters only the backend secret boundary and public output is limited to `providerKeyRef`. OPL flow: Portal launch/preflight -> Gateway -> clean local OPL upstream -> Runtime Bridge -> session/message/file/run/artifact/trace/ledger projection -> Portal. Cloud flow: Portal -> cloud connector status/plan -> fail-closed local response.

## Failure Modes

- Missing local state profile fails closed rather than using fake success for delivery RC.
- Missing clean OPL URL fails closed with a stable Gateway/preflight reason.
- Missing Runtime Bridge capability fails closed and must not generate successful run/artifact claims.
- Raw provider key, launch token, runtime token, local private path or signed object URL must not appear in public payloads, logs, docs or git evidence.
- Real-cloud operation attempts remain forbidden in this package.

## Surface Impact

- source: `services/portal/frontend`, `services/medopl-go-backend`, `services/opl-web-gateway`, `services/opl-runtime-bridge`, `scripts/v22-local-services.mjs`.
- docs: `docs/active/README.md`, `docs/source/README.md`, `docs/runtime/README.md`, `docs/delivery/README.md`, `docs/history/README.md`.
- specs: `specs/product/spec.md`, `specs/runtime/spec.md`, `specs/operations/spec.md`.
- tests: new local delivery RC contract/regression gate and existing golden/current/contract/review/regression suites.
