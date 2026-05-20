# Runtime Truth

Owner: `MedOPL`
Purpose: `runtime_truth`
State: `taxonomy_skeleton`
Machine boundary: 本文是人读 runtime 边界摘要。Runtime Bridge / Gateway 行为由 source、contracts、local eval 和授权 canary evidence 裁定。

## Canonical Chain

```text
Portal -> OPL Web Gateway -> clean One Person Lab upstream
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

## Boundaries

- One Person Lab upstream 必须保持 clean。
- 不修改 upstream 源码，不 import upstream 内部模块。
- Portal 不依赖 upstream DOM、store、database schema 或 internal session model。
- Gateway / Runtime Bridge 只通过公开边界、bridge、API/CLI 或反向代理适配。
- Runtime Bridge 负责 session/message/run/file/artifact/providerKeyRef/trace projection，不是 cloud inventory truth，也不是 billing ledger truth。

## Canary Reading

Real OPL canary 是验证链路，不是 production completion claim。Provider message、file/run/artifact、Runtime Agent relay、Langfuse attachment、真实云 runtime、COS 账单核对必须分开裁定。

## Current Source Files

- `docs/architecture.md`
- `docs/contracts/v22-upstream-opl-boundary.md`
- `docs/contracts/v22-portal-opl-connection-boundary.md`
- `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`
- `docs/contracts/v22-real-opl-capability-canary-boundary.md`
- `docs/contracts/v22-real-opl-provider-message-canary-boundary.md`
- `docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md`

## Migration Status

本 README 是 runtime taxonomy skeleton。旧 `docs/architecture.md`、runtime contracts 和 validation path 本轮不删除；后续迁移必须保留 no-fake-success、clean upstream 和 secret hygiene gate。

