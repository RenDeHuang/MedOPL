# v22 Resource Plan Boundary Contract

本合同定义 MedOPL v22 的资源套餐边界。

## Product Shape

MedOPL 提供托管 runtime、计算和存储能力。用户选择套餐或扩展能力，不直接配置 CVM、COS、K8s。

## Default Plans

| 套餐 | 计算 | 存储 |
| --- | --- | --- |
| 默认套餐 1 | 2c4gb | 10GB |
| 默认套餐 2 | 8c16gb | 100GB |

## Extensions

v22 支持：

- 叠加计算资源。
- 叠加存储容量。
- 自定义套餐。

所有叠加和自定义资源都必须进入 billing、quota、audit 边界。

## Runtime Requirement

资源套餐不等同于默认 runtime。租户必须明确开通 runtime 后，才能使用平台托管 runtime 跑任务。未开通 runtime 的租户不能跑托管 runtime 任务。

## Binding Requirement

每个套餐资源、叠加资源和自定义资源都必须绑定 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。
