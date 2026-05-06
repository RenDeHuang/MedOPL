# v22 Billing Freeze Boundary Contract

本合同定义 MedOPL v22 的资源计费、冻结金额和释放边界。

## Billing Start

租户开通 runtime、compute 或 storage 后，资源进入 billing、quota、audit 边界，并开始预扣费或冻结金额。

## Insufficient Balance

当余额不足时，Portal 必须提示用户将消耗冻结金额。该提示属于产品主 loop，不能被隐藏在后台资源逻辑中。

## Freeze Protection

冻结保护期是 7 天。

- 保护期内，Portal 可以展示资源、余额、冻结金额和释放状态。
- 保护期结束后，平台清理对应数据和资源。
- 清理和释放必须保留 audit tag / cost allocation tag 可追踪性。

## Billing Stop

用户删除或释放 runtime、compute、storage 后，扣费停止。释放后的资源不得继续产生租户费用。

## Non-goals

- 不把冻结保护描述成云资源控制台欠费流程。
- 不让用户直接操作 CVM、COS、K8s 来停止扣费。
