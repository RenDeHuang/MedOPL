# No Redis Cloud Topology Contract Proposal

Status: authoring
Branch: fix/v22-no-redis-cloud-topology-contract
Base trunk: origin/recovery/platform-v22-trunk
Owner: `MedOPL`
Affected plane: Product / Operations / Runtime
Purpose: `change_proposal`
State: `active`
Machine boundary: 本文件是 change lifecycle 文档，不是机器接口。验收以 `docs/specs/README.md`、`docs/runtime/README.md`、`compose.product.yaml`、tests 和 package scripts 为准。

## Problem

当前生产拓扑合同仍把 Redis 作为必需资源，并且本地 product compose 仍启动 Redis。用户确认短期接云稳定 baseline 不需要 Redis；当前目标应改成 PostgreSQL-only required data plane，并按照 Kubernetes 官方多租户模型固定共享集群、分层隔离和高级套餐专属池。

## Proposed Change

- 将 production topology 必需资源收敛为 `CLB / TKE / COS / CBS / NAT / PostgreSQL`。
- 将 Redis 从必需资源降为 future optional volatile accelerator，不作为上线前置。
- 明确 COS 是 workspace file space object storage，CBS 只做 TKE 节点盘或必要 PV。
- 将 TKE 隔离合同写成 Kubernetes 多租户控制：Namespace、RBAC、ResourceQuota、LimitRange、NetworkPolicy、Pod Security、admission policy；高级套餐用 taint、label、nodeSelector、toleration 和 resource binding 约束专属池。
- 将本地 `compose.product.yaml` 改成 Postgres-only required data plane。

## Golden Path Impact

- narrows: removes Redis as a required local/product dependency before cloud authorization.
- improves: makes the cloud topology contract match the target shared-cluster multi-tenant SaaS shape.
- affected steps: real-cloud readiness and precloud deployable topology contracts.
- unaffected steps: Portal local golden path, OPL Gateway, Runtime Bridge local fake probe and frontend typed API flow.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Non-Goals

- 不读取 secret。
- 不调用真实云。
- 不 build/push/kubectl/deploy/live-test。
- 不创建、修改或删除真实 CLB、TKE、COS、CBS、NAT、PostgreSQL。
- 不修改 upstream OPL。

## Authorization Boundary

- 本 change 只授权 repo-local docs、contract、fixture、compose 和 eval 变更。
- 不授权 secret 读取、真实云调用、kubectl、deploy、build/push、live-test、provider mutation 或 readonly live inventory。
- 后续接云仍必须由当前会话显式授权 operation class、target environment、secret/API allowlist、budget、evidence sink 和 rollback owner。
