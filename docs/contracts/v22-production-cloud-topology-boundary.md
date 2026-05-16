# v22 Production Cloud Topology Boundary

本合同定义 MedOPL v22 production cloud topology contract。当前只是合同，不代表已部署，不代表已接入，不代表已验证。

本合同只描述生产云拓扑中已购买或准备使用的资源角色，以及这些资源后续进入 readonly inventory 和 deploy plan 时必须携带的边界信息。它不读取 secret，不调用真实云，不创建、删除或修改任何资源。

## Scope

production cloud topology contract 只回答：

- MedOPL v22 生产环境计划使用哪些云资源类别。
- 这些云资源在平台架构中的职责是什么。
- 哪些拓扑维度必须进入后续 readonly inventory 和 deploy plan。
- 哪些云控制台语言不得进入普通用户产品语言。

当前只是合同：

- 不代表已部署。
- 不代表已接入。
- 不代表已验证。
- 不代表 Portal / Gateway / Runtime Bridge / worker 已在这些资源上运行。
- 不代表真实 CLB、TKE、CBS、NAT、Redis、PostgreSQL 已通过 MedOPL 自动化管理。

## Resource Roles

生产云资源角色如下：

| Resource | Contract Role | Boundary |
| --- | --- | --- |
| CLB | portal/opl/gateway 入口 | 承担 `portal.medopl.cn`、`opl.medopl.cn`、Gateway 等入口流量分发边界；当前合同不创建监听器、不配置证书、不验证域名。 |
| TKE | Portal/Gateway/Runtime/worker 承载层 | 承载 Portal、OPL Gateway、Runtime Bridge、worker 和后续后台任务；当前合同不 kubectl，不创建 namespace，不部署 workload。 |
| CBS | TKE 节点盘/必要持久卷 | 用于 TKE 节点盘或必要持久卷；CBS 不作为普通用户文件空间主叙事，普通用户仍只看到文件空间、容量、保护期、批量下载和批量删除。 |
| NAT | TKE 私网出公网、拉镜像、访问模型/API/云 API | 为私网内 TKE workload 出公网提供边界，用于拉镜像、访问模型/API 或后续授权云 API；当前合同不配置路由表、不验证出网。 |
| Redis | session/queue/lock/cache | 承担 session、queue、lock、cache 等短状态能力；Redis 不是账本、审计或文件索引 canonical store。 |
| PostgreSQL | Portal canonical store、账本、资源绑定、审计、文件索引 | 承担 Portal canonical store、钱包/账本、资源绑定、审计事件、文件索引和合同态业务数据；PostgreSQL 不是普通用户可见云数据库。 |

这些资源属于生产基础设施拓扑，不等于用户购买的“文件空间主叙事”或“云控制台清单”。普通用户产品语言不展示 CLB/TKE/CBS/NAT/Redis/PostgreSQL。

TKE 内部节点池必须区分资源角色：

- platform service node pool：承载 Portal、OPL Gateway、Runtime Bridge、trace、billing、system 等平台服务。
- shared user compute pool：承载标准套餐 workspace workload，通过 namespace quota、limit 和 admission policy 隔离。
- dedicated user compute pool：承载高级隔离套餐绑定的 workspace runtime 或账号组 runtime。

平台服务不得调度到 dedicated user compute pool。用户 workload 不得调度到 platform service node pool。shared user compute pool 可以承载多个用户的 workload，但必须通过 ResourceQuota / LimitRange / admission policy 和 Portal resource binding 硬隔离。

## User Product Language Boundary

普通用户页面只表达：

- 工作台资源。
- 托管运行环境。
- 文件空间。
- 输入文件和输出文件。
- 预计费用。
- 释放策略。
- 审计状态。
- 保护期。
- 批量下载和批量删除。

普通用户产品语言不展示：

- CLB/TKE/CBS/NAT/Redis/PostgreSQL。
- Kubernetes、node pool、节点池、云资源清单、服务器编号。
- VPC、subnet、security group、route table、load balancer listener。
- objectKey、storageKey、localPath、signedUrl、cosPrefix、storageBackend。
- SecretId、SecretKey、token、raw API Key、kubeconfig。

管理员 / 运维页面可以在受控审计和对账区域展示必要的后台拓扑摘要，但不得把 raw cloud response、secret、kubeconfig、signed URL 或可直接定位用户文件的内部存储字段写入 Portal payload、日志、evidence 或 git。

## Future Readonly Inventory And Deploy Plan Dimensions

后续 readonly inventory 和 deploy plan 必须显式记录并校验以下拓扑维度：

- region。
- VPC。
- subnet。
- security group。
- route table / NAT route summary。
- CLB listener / domain / certificate binding summary。
- TKE cluster / namespace / workload class summary。
- CBS disk / persistent volume summary。
- Redis instance summary。
- PostgreSQL instance summary。
- resource tag。
- cost allocation。

这些维度只能作为后续只读盘点、部署计划、成本归因和审计输入。它们不能被启发式推断为账号或工作空间归属；归属仍必须以 Portal ledger + resource tag / cost allocation 双重校验为准。

缺失 region、VPC、subnet、security group、resource tag 或 cost allocation 时，后续 readonly inventory 和 deploy plan 必须 fail-closed，进入 admin 审计队列，而不是默认补齐或按名称/创建时间/IP/规格推断。

## Relationship To Existing Tencent Contracts

本合同位于 Tencent Provider 合同包之前置拓扑层。它不替代以下合同：

- `v22-tencent-readonly-inventory-boundary.md`
- `v22-authorized-tencent-create-release-boundary.md`
- `v22-authorized-tencent-create-release-implementation-boundary.md`
- `v22-authorized-tencent-create-release-execution-boundary.md`

production cloud topology 只定义“资源类别与职责”。readonly inventory 定义“如何只读盘点并脱敏输出”。authorized create/release 定义“何时允许真实创建或释放”。三者必须分离。

## Non-Goals

本合同明确非目标：

- 不改 deploy。
- 不 kubectl。
- 不 build/push。
- 不调用真实云。
- 不读取 secret。
- 不创建/删除资源。
- 不创建、修改或删除 CLB、TKE、CBS、NAT、Redis、PostgreSQL。
- 不配置 VPC、subnet、security group、route table、listener、certificate 或 resource tag。
- 不运行 live-test。
- 不改 `.sentrux`、`adapters`、`upstream`。
- 不实现 provider adapter。
- 不改变普通用户 Portal UI 文案或业务语义。

真实云 inventory、deploy plan、资源创建/释放、kubectl、build/push、secret 读取和 live-test 必须另开 feat/* 并由用户在当前会话单独授权。

## Contract Data

<!-- v22-production-cloud-topology-contract:start -->
```json
{
  "contract": "v22_production_cloud_topology_boundary",
  "version": 1,
  "contractOnly": true,
  "deployed": false,
  "connected": false,
  "verified": false,
  "callsRealCloud": false,
  "readsSecret": false,
  "createsOrDeletesResources": false,
  "changesDeploy": false,
  "usesKubectl": false,
  "runsBuildPush": false,
  "resourceRoles": {
    "CLB": "portal/opl/gateway 入口",
    "TKE": "Portal/Gateway/Runtime/worker 承载层",
    "CBS": "TKE 节点盘/必要持久卷，不作为普通用户文件空间主叙事",
    "NAT": "TKE 私网出公网、拉镜像、访问模型/API/云 API",
    "Redis": "session/queue/lock/cache",
    "PostgreSQL": "Portal canonical store、账本、资源绑定、审计、文件索引",
    "platform service node pool": "Portal/OPL Gateway/Runtime Bridge/trace/billing/system 平台服务池",
    "shared user compute pool": "标准套餐 workspace workload 共享池，必须由 quota/limit/admission 隔离",
    "dedicated user compute pool": "高级隔离套餐专属池，只能由绑定 resourceBindingId 或账号组调度"
  },
  "schedulingIsolation": {
    "platformServicesMustNotScheduleToDedicatedUserComputePool": true,
    "userWorkloadMustNotScheduleToPlatformServiceNodePool": true,
    "sharedUserComputePoolRequiresQuotaLimitAdmission": true
  },
  "ordinaryUserProductLanguageHides": [
    "CLB",
    "TKE",
    "CBS",
    "NAT",
    "Redis",
    "PostgreSQL"
  ],
  "ordinaryUserProductLanguageAllows": [
    "工作台资源",
    "托管运行环境",
    "文件空间",
    "预计费用",
    "释放策略",
    "审计状态"
  ],
  "futureReadonlyInventoryAndDeployPlanDimensions": [
    "region",
    "VPC",
    "subnet",
    "security group",
    "resource tag",
    "cost allocation"
  ],
  "mustFailClosedOnMissingTopologyOrAllocationTags": true
}
```
<!-- v22-production-cloud-topology-contract:end -->
