# No Redis Cloud Topology Contract Design

Owner: `MedOPL`
Purpose: `change_design`
State: `active`
Machine boundary: 本文件是人读设计记录。代码和合同验收由 docs/tests/compose 持有。

## Architecture

MedOPL v22 的稳定接云前置拓扑固定为共享 TKE 集群 + 分层隔离 + 高级套餐专属池。平台服务和用户 workload 分开调度；标准套餐使用 shared user compute pool 并通过 Kubernetes 多租户控制硬隔离；高级套餐映射 dedicated user compute pool 或 dedicated node。

## Data Plane

PostgreSQL 是唯一必需 control-plane canonical store。短状态、队列、锁、session 和 job state 优先由 PostgreSQL-backed 表、状态机、事务锁和 runtime memory boundary 承接。Redis 只有在后续 evidence 证明需要更高吞吐 volatile accelerator 时才能另开 leaf 评估。

## Storage Plane

COS 承载 workspace file space、输入文件、输出文件和 artifact 正文。CBS 只用于 TKE 节点盘或必要 persistent volume，不作为普通用户文件空间主叙事。

## Evaluation Shape

Topology eval 同时检查：

- Redis 不再出现在必需 topology。
- COS/CBS/PostgreSQL 角色分离。
- Kubernetes 多租户控制关键字存在。
- 本地 compose 不要求 Redis。
