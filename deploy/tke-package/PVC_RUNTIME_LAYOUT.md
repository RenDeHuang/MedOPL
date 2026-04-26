# 单 PVC 目录合同（TKE `portal-platform-runtime`）

## 目的

当前线上采用单个 CFS PVC 作为上线简化方案，只解决首版部署收敛，不把状态边界混在实现里。目录必须先分清，后续迁移到独立 PVC、对象存储或数据库时，按目录归属迁移即可，保持模块内高聚合、模块间低耦合。

## 当前合同

共享 PVC 名称：`portal-platform-runtime`

各模块目录约定如下：

| 模块 | 当前目录 | 用途 | 未来迁移目标 |
| --- | --- | --- | --- |
| Portal | `/app/.runtime/portal` | Portal 本地 JSON/事件文件、导出中间文件 | 迁移到 PostgreSQL/Redis 后，仅保留短期缓存目录；持久元数据脱离 PVC |
| Portal Adapter | `/app/.runtime/portal-opl-adapter` | launch token、workspace session、runtime session、artifact 索引 | 迁移到独立 adapter state store；artifact 索引迁移数据库 |
| OPL Web Gateway | 不占用 PVC | 网关无本地状态，只做代理与 launch cookie 协议 | 保持无状态 Deployment，不绑定 PVC |
| OPL Web Upstream | 不占用 PVC | OPL 原生前端/上游服务，不在平台 PVC 写入状态 | 保持无状态 Deployment；用户态数据走 runtime/workspace 面 |
| Billing Aggregator | `/app/.runtime/billing-aggregator` | 账单导入缓存、对账中间产物 | 迁移到独立账单缓存桶/数据库 |
| Runner Orchestrator | `/app/.runtime/med-autoscience` | workspace 目录、Job manifest、日志、运行索引 | workspace/artifact 分拆；控制面索引迁移数据库 |
| 动态 Runner Job | `/app/.runtime`（挂载同一 PVC） | 运行时需要访问统一 runtime 根，读取/写入 workspace、artifacts、logs | 后续按 workspace PVC / artifact bucket / scratch volume 拆分 |
| Workspace 数据 | `/app/.runtime/med-autoscience/workspaces/<customer>/<workspace>` | `inputs/`、`runtime/`、`logs/`、`outputs/`、`workspace.json` | `inputs/outputs` 迁移对象存储，`runtime/logs` 迁移到独立 workspace 卷 |
| Artifacts | `/app/.runtime/portal-opl-adapter/artifacts` 与 workspace `outputs/` | Portal 侧 artifact 索引与 Runner 输出 | 统一迁移到对象存储，Portal/Adapter 只保留元数据引用 |

## 目录边界要求

1. 模块只能写自己声明的目录，不跨目录直接读写别的模块状态文件。
2. 共享 PVC 只作为物理介质，不作为逻辑耦合理由。
3. Gateway/Upstream 维持无状态，不因为“PVC 已存在”就补本地状态。
4. 动态 Runner Job 固定挂载 `/app/.runtime`，但业务读写仍只通过 `med-autoscience` 目录约束完成。

## 迁移原则

从单 PVC 演进到正式多卷/多租户存储时，按下面顺序拆：

1. `Portal` 元数据先脱离 PVC，进入数据库。
2. `Adapter` 会话与 artifact 索引进入独立状态存储。
3. `Workspace inputs/outputs` 迁移对象存储，保留引用。
4. `runtime/logs` 迁移到独立 workspace 卷或按租户卷。
5. `Billing` 对账缓存从共享 PVC 拆到独立目录或账单桶。

这样可以保证任何一个模块迁移或故障时，不要求同步改动其它模块。
