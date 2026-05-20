# Runtime Truth

Owner: `MedOPL`
Purpose: `runtime_truth_view`
State: `hard_compacted_view`
Machine boundary: 本文是 runtime 视角入口，不是第二份 current truth。当前唯一人读 current truth 是 `docs/active/README.md`；Runtime Bridge / Gateway 行为由 source、contracts、local eval 和授权 canary evidence 裁定。

## Runtime View

Runtime 主链路是：

```text
Portal -> OPL Web Gateway -> clean One Person Lab upstream
  -> Runtime Bridge / Runtime Agent
  -> platform-managed TKE/storage resource pools
  -> Billing/Quota/Audit/Admin
```

One Person Lab upstream 必须保持 clean。Portal/Gateway/Runtime Bridge 不修改 upstream、不 import upstream 内部模块、不依赖 upstream DOM/store/database schema/internal session model。

Runtime Bridge 负责 session/message/run/file/artifact/providerKeyRef/trace projection，不是 cloud inventory truth，也不是 billing ledger truth。Real OPL canary 是验证链路，不是 production completion claim。

## Runtime Contract Groups

- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`
- `docs/specs/README.md`

## Current Truth Pointer

Runtime 当前事实、Portal canonical data truth、PostgreSQL/Redis 方向、object/blob plane、clean upstream 和 no-fake-success 边界统一见 `docs/active/README.md`。旧分散 architecture truth 不得恢复为当前架构真相入口。
