# v22 Tenant Resource Binding Boundary Contract

本合同定义 MedOPL v22 的租户资源绑定边界。

## Required Binding

开通 runtime、compute、storage 后，所有资源必须绑定到：

- tenant
- user
- workspace
- resource binding
- billing account
- audit tag / cost allocation tag

## Binding Scope

绑定用于确认：

- 资源属于哪个租户。
- 哪个用户触发或使用该资源。
- 资源服务哪个 workspace。
- 资源如何进入 billing、quota、audit。
- 成本如何通过 audit tag / cost allocation tag 归因。

## Lifecycle

资源生命周期必须保持绑定：

1. 开通前校验 tenant、user、workspace、billing account。
2. 开通时创建 resource binding。
3. 使用中记录 audit tag / cost allocation tag。
4. 余额不足时关联冻结金额。
5. 7 天冻结保护期结束后，按绑定清理数据和资源。
6. 用户删除或释放资源后，停止扣费并保留审计证据。

## Prohibited State

v22 不允许：

- 无 tenant 的 runtime、compute、storage。
- 无 billing account 的资源。
- 无 audit tag / cost allocation tag 的资源。
- 让用户直接通过 CVM、COS、K8s 配置绕过 Portal 资源绑定。
