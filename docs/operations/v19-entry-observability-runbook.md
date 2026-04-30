# OPL v19 Entry Observability Runbook

## Purpose

This runbook keeps the three production entrypoints observable without mixing infrastructure concerns into Portal, Gateway, or Langfuse source code.

## Checks

- DNS: every hostname must resolve.
- TCP: ports 80 and 443 must accept connections.
- TLS: HTTPS hosts must complete handshake and report certificate subject and validity dates.
- HTTP: `/healthz` is expected for Portal and OPL; `/api/public/health` is expected for Langfuse.
- WebSocket: OPL Gateway upgrade must return `101` separately from the business auth session check.
- Business session: `/api/auth/user` must return `401` without launch and `200` with a valid launch cookie.

## Alerts

- Portal 5xx: check Portal pod logs, PostgreSQL/Redis connectivity, and `/healthz` storage mode.
- OPL policy violation or white screen: run the business session smoke first, then the WebSocket smoke.
- TKE orphan: run provisioner orphan scan before creating replacement node pools.
- COS bill missing: keep orders in pending state; do not mark exact settlement complete.
- Reconcile failed: inspect idempotency keys and unattributed bill queue before retrying.

## Commands

```powershell
node scripts/check-production-entry-health.mjs --k8s --namespace=default --ingress=gaofenglab
node scripts/check-production-entry-performance.mjs --json
node scripts/smoke-test-v19-entry-health.mjs
node scripts/smoke-test-v19-opl-websocket-business-session.mjs
```
