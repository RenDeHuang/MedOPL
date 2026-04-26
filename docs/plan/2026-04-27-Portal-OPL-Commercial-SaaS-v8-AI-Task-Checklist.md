# Portal + OPL 商业化 SaaS v8 AI 开发任务清单

日期：2026-04-27

## 顶层原则

模块内高聚合，模块间低耦合。每个模块只处理自己的状态、规则和错误，不直接侵入其他模块的数据表或云密钥。

- Portal：用户、任务空间、钱包、资源选择、商业化总览。
- OPL Gateway：Portal 身份到 OPL Web 的会话接入。
- OPL Runtime Bridge：launch token、workspace/session/runtime/run 映射。
- Runner Orchestrator：动态 Job、资源请求、运行状态。
- Billing Aggregator：腾讯云询价、真实账单、对账事实。
- Resource Provisioner：腾讯云/TKE 资源开通、扩容、资源 ID 回填。

一个模块挂了，不应该让其它模块失去自身基本能力：Billing 不可用时 Portal 还能登录和进入工作台；Provisioner 不可用时已有节点池规格仍可调度；Gateway 不可用不影响 Portal 后台；Runner 不可用不影响账单查询。

## P0 任务清单

| 任务 | 目的 | 商业化逻辑 | 实现方式 | 测试 | 交付标准 | v8 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 服务器与费用商品化 | 客户能透明选择 CPU/GPU/地域/价格 | 客户先看到价格和冻结金额，再决定是否运行 | Portal 展示 Billing Aggregator 的 `/server-plans`，选择后保存到任务空间 | 浏览器检查 `/portal/app/servers`；smoke 检查 server plan 到 Job manifest | 页面无乱码，显示真实报价状态，选择会写入 workspace | 已完成 UI 修复；本地因未配置腾讯云密钥所以不伪造价格 |
| 真实账单边界 | 最终扣费只能来自腾讯云账单 | Pending 只是运行中预估，exact 只能是云账单 | Billing Aggregator 使用腾讯云 `DescribeBillDetail`，未归因账单不扣用户 | smoke + 手工检查 `/billing/status`、`/server-plans` | 账单来源字段明确，未接入时显示未接入 | 已有后端边界；本地未接真实密钥 |
| 资源开通边界 | 客户选择规格后平台能按规格开通/确保集群容量 | 服务器选择不是静态偏好，而是 run 前的资源能力合同 | 新增 Resource Provisioner，独立调用腾讯云 TKE `CreateClusterNodePool`/`ModifyClusterNodePool` | `scripts/smoke-test-resource-provisioner-contract.mjs` | Runner 对需要开通的规格会调用 provisioner；云密钥不进 Portal | 已新增模块和 Runner 调用；真实云开通需腾讯云密钥、TKE payload 和新 TCR 仓库 |
| 总览商业化 | 首页像客户控制台，不像说明书 | 用户一眼看到能不能进、能不能跑、余额、费用、入口 | 重写 Overview：主入口、余额、费用、任务空间、最近运行 | 浏览器检查总览截图和文案 | 无“商业化准入/下一步”说明书感 | 已完成 UI 修复 |
| OPL 原生登录接 Portal | 直接打开 OPL 登录框也能用 Portal 本地账号 | 减少客户误操作和客服成本 | Gateway 拦截 OpenWebUI 登录接口，调用 Portal 内部密码校验 | `scripts/smoke-test-opl-web-gateway-native-login.mjs` | 本地 Portal passwordHash 账号可登录 OPL 原生框 | 已完成；OIDC 无本地密码账号仍需统一登录/launch |
| workspace/session/trace/storage 打通 | Portal 注册用户进入 OPL 后，任务空间、session、trace、文件归属一致 | 用户看到的是一个产品，不是两个系统 | Portal launch 带 workspace/session；Runtime Bridge 记录 runtimeSession；Runner Job 带 tenant/workspace/run 标签 | `scripts/smoke-test-server-plan-runtime-chain.mjs` | Job manifest 和运行记录包含 tenant/workspace/session/run/server_plan | 已完成基础链路 |
| v7 本地/云不一致核查 | 避免同 tag 不同内容造成上线误判 | 商业化版本必须可追溯 | v8 使用新 tag，不复用 v7；healthz 返回 build sha/time；rendered manifest 固定 v8 | 检查 rendered image tag 和本地健康状态 | 不再用同一个 tag 覆盖不同代码 | v8 本地已改；本轮不推云 |

## 资源开通逻辑

1. 客户在 Portal 选择服务器规格。
2. Portal 只保存选择，不直接创建云资源。
3. 用户启动 run 时，Runtime Bridge 把 server plan 传给 Runner。
4. Runner 判断 `provisioningMode`：
   - `schedule_to_node_pool`：调度到已有节点池，不调用腾讯云。
   - `tke_node_pool`：调用 Resource Provisioner 创建 TKE 节点池。
   - `tke_node_pool_scale`：调用 Resource Provisioner 扩容/修改节点池。
5. Resource Provisioner 用腾讯云 Secret 调 TKE API，并把 `tenant_id`、`workspace_id`、`run_id`、`server_plan_id` 写入 tag/label。
6. Billing Aggregator 之后用腾讯云账单明细按 tag/label 归因。

## 真实开通所需配置

要在云上真正开通服务器，还需要运营侧提供：

- 腾讯云 `SecretId`、`SecretKey`、可选临时 token。
- `TENCENT_TKE_CLUSTER_ID`。
- 每个可售 server plan 的 `nodePoolCreatePayload` 或 `nodePoolScalePayload`。
- 新镜像仓库：`gaofenglab/resource-provisioner-opl`，或指定一个现有仓库承载该镜像。
- 将 `RESOURCE_PROVISIONING_ENABLED=1` 后再允许自动创建/扩容资源。

没有这些配置时，系统不会伪造“已开通”，也不会把本地估算当真实账单。

## v8 本地交付状态

已达到：

- 前端总览、服务器与费用、帮助栏中文恢复正常。
- 服务器与费用页面更简洁，明确展示报价状态、冻结金额、开通方式。
- OPL 原生登录对 Portal 本地账号可用。
- server plan 选择能进入 workspace/session/runtime/Job manifest。
- 新增 Resource Provisioner 模块和 Runner 调用边界。

未达到：

- 本地没有腾讯云密钥，所以不能验证真实报价和真实账单。
- 本地没有 TKE `nodePoolCreatePayload`，所以不能实际创建节点池。
- 腾讯云镜像仓库还没有 `resource-provisioner-opl`，本轮也按要求不推云。
