# v22 Resource Plan Boundary Contract

本合同定义 MedOPL v22 的资源套餐边界。

## Product Shape

MedOPL 提供托管 runtime、计算和存储能力。用户选择套餐或扩展能力，不直接配置 CVM、COS、K8s。

用户不购买节点池；节点池是平台供给库存。套餐表达的是 compute allocation、任务并发、文件空间、隔离等级和计费/审计策略。普通用户界面不得把节点、节点池、TKE、COS bucket 或云控制台对象作为购买对象。

## Default Plans

| 套餐 ID | 计算 | 存储 | 默认并发 |
| --- | --- | --- |
| `starter_2c4g_10gb` | 2c4gb | 10GB | 1 |
| `pro_8c16g_100gb` | 8c16gb | 100GB | 2 |

`starter_2c4g_10gb` 与 `pro_8c16g_100gb` 是 v22 默认套餐的唯一标准命名。不得再使用“默认套餐 1/2”命名。

## Extensions

MVP active surface 仅开放两档标准套餐。以下扩展能力属于 future-authorized 产品边界，不能作为当前普通用户 active UI、API 或 smoke 正路径：

- 叠加计算资源。
- 叠加存储容量。
- 自定义套餐。

所有后续叠加和自定义资源都必须先进入 billing、quota、audit 合同边界，并经过单独产品审批；当前 active source 不保留 `custom` 套餐开通 route、action 或默认套餐项。

## Isolation Modes

资源套餐必须显式声明 `isolationMode`：

- `shared_quota`：默认套餐使用 `shared_quota`。多个用户可以共享同一个用户计算池，但每个 workspace 必须有独立 namespace、ResourceQuota、LimitRange、admission policy、resourceBinding 和审计标签。超过 allocation 的 workload 必须 fail-closed。
- `dedicated_node_pool`：高级套餐可以使用 `dedicated_node_pool`。平台为一个 resourceBindingId 或明确账号组创建或绑定专属计算池，并通过 taint、label、nodeSelector、toleration 防止平台服务和其他用户进入。
- `dedicated_node`：更细的高级隔离选项，只能在专属池或明确绑定的专属节点语义下使用。

标准套餐不得解释成“一用户一个节点池”。高级套餐可以购买“专属计算资源 / 高级隔离套餐”，但普通用户仍不直接管理节点池。

## Runtime Requirement

资源套餐不等同于默认 runtime。租户必须明确开通 runtime 后，才能使用平台托管 runtime 跑任务。未开通 runtime 的租户不能跑托管 runtime 任务。

## Binding Requirement

每个 active 套餐资源都必须绑定 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。后续叠加资源和自定义资源进入 future-authorized 边界前不得作为 active route、action 或默认 smoke 正路径。
