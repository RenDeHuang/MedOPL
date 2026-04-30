# OPL v19 Update Log

Date: 2026-04-30
Branch: `codex/opl-v19`

## Summary

v19 moves OPL from an integration demo toward commercial operations readiness. The default path now centers on:

- OPL login with user-supplied provider key, without persisting or returning the plaintext key.
- Real OPL message closure through Gateway -> Adapter -> Runner fixture, producing `runId`, `resourceOrderId`, trace rows, pending cost records, and artifacts.
- Tencent Cloud SKU catalog contract with CPU/memory filters and four-card pagination in Portal.
- Commercial ledger contract for preauth, pending usage, exact charge, refund, makeup charge, and unattributed bills.
- Storage entitlement and artifact gates: free quota is 0, minimum purchase is 10GB, upload/output are blocked until storage is active.
- Product Docker compose contract with Portal, OPL Gateway, OPL Web, Adapter, Billing, Provisioner, Runner, PostgreSQL, and Redis.

## Service Changes

### OPL Gateway

- Native login accepts `apiKey`, `providerApiKey`, `experimentalBearerToken`, or `gflabtoken`.
- Login page injection adds a gflabtoken API key field under password.
- Missing provider key blocks OPL entry.
- Provider key is redacted from returned payloads and normal logs.
- WebSocket business-session smoke verifies `101 Switching Protocols`.

### Portal OPL Adapter

- Launch/bootstrap flow now returns redacted provider metadata only.
- Runtime session records provider status and secret reference, not plaintext token.
- Real message smoke verifies run creation, resource order preparation, trace record, pending cost, and artifact return.

### Portal

- Server selection supports real SKU catalog shape, CPU filter, memory filter, and four items per page.
- User scope/RBAC smoke verifies user-owned resource access and admin visibility separation.
- Storage entitlement APIs enforce disabled -> active -> deleting transitions.
- Workspace COS upload/download smoke uses tenant/workspace prefix contract.

### Billing

- SKU endpoint returns Tencent Cloud catalog fields including `instanceType`, CPU, memory, zone, availability, price, currency, and `canOrder`.
- Ledger idempotency and T+1 settlement smoke cover refund and makeup-charge paths.
- Unattributed bill queue smoke verifies bills without complete tags are not silently charged.

### Docker Product Appliance

- `compose.product.yaml` now defines product services and dev services separately.
- Product mode defaults Portal to `postgres_redis`.
- Dev mode may mount source; product mode uses images.
- Local product compose is explicitly fixture/mock cloud only, not a live TKE substitute.

## Verification Completed

- `node --check` for Portal, OPL Gateway, OPL Adapter, Billing, Provisioner, Runner.
- `npm --prefix services/portal/frontend run typecheck`.
- `npm --prefix services/portal/frontend run build`.
- OPL provider login smoke.
- OPL runtime provider redaction smoke.
- OPL real message smoke.
- OPL launch adapter smoke.
- OPL WebSocket business-session smoke.
- Product compose appliance smoke.
- SKU catalog and Portal pagination/filter smoke.
- Storage entitlement and COS upload/download smoke.
- Runtime output storage gate smoke.
- Tenant RBAC matrix smoke.
- Preauth ledger idempotency smoke.
- T+1 refund and makeup settlement smoke.
- Unattributed bill queue smoke.
- Production entry health and performance script.
- Sentrux scan: `quality_signal=6901`, `check_rules=pass`, DSM clean.
- `one-person-lab` upstream status clean.

## Not Completed

- v19 has not been rolled to cloud from this branch.
- Live Tencent Cloud SKU discovery skipped locally because credentials were not configured in this worktree.
- Live TKE create/delete cleanup was not run in this pass.
- Live COS daily exact bill reconcile was not run in this pass.
- Full live user E2E was not completed in this pass.
- Sentrux quality is below the plan target `6988`; current integrated branch passes `.sentrux/rules.toml` but does not satisfy the stricter v19 plan gate.

## Operational Notes

- Do not roll cloud until live SKU, TKE cleanup, COS exact reconcile, and full user E2E evidence are captured.
- Do not modify `.runtime/one-person-lab-upstream` or Langfuse source.
- Keep provider keys and cloud secrets in runtime Secret storage only.
