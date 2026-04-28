# Langfuse Deployment Notes

Langfuse is an independent observability stack for OPL session traces. It is not part of Portal, Billing, Resource Provisioner, Runner, Gateway, or the One Person Lab upstream.

## Module Boundary

- Portal reads trace summaries through the Langfuse public API and Portal-owned adapter records.
- Runtime Bridge publishes trace events to Langfuse.
- Langfuse owns its own Postgres, ClickHouse, Redis, and blob storage.
- Billing does not read Langfuse.
- Resource Provisioner does not read Langfuse.
- One Person Lab upstream is not modified.

## Image Policy

The TKE workload can pull official images directly:

- `langfuse/langfuse:3`
- `langfuse/langfuse-worker:3`
- `postgres:15-alpine`
- `clickhouse/clickhouse-server:24.8`
- `redis:7-alpine`

Mirroring these images into TCR is not required for correctness. Mirror to TCR only when the cluster cannot reliably pull public images, or when production supply-chain control requires private registry pinning.

## Storage

The production target is:

- Postgres metadata on CBS.
- ClickHouse traces/events on CBS.
- Redis queue/cache on CBS.
- Langfuse blob storage in COS prefix `langfuse/`.

The COS prefix is intentionally separate from:

- Tencent daily billing files: `daily/`
- Customer workspaces: `workspaces/{tenant_id}/{workspace_id}/`

## Ingress

`trace.medopl.cn` is the administrator Langfuse console. Customer-facing trace browsing stays in Portal as `会话轨迹`.

If `trace.medopl.cn` points to the same CLB as `portal.medopl.cn` and `opl.medopl.cn`, deploy Langfuse in the same Kubernetes namespace as that Ingress or update DNS to the separate Langfuse Ingress CLB.
