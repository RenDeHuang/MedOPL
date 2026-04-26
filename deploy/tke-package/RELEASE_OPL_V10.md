# OPL v10 Release Summary

日期：2026-04-27

## 版本定位

`opl-v10` 用于 Portal + OPL 的资源订单商业化闭环版本。这个摘要文件只记录本次发布应该更新哪些镜像、哪些镜像沿用稳定版本，以及每个镜像对外承担的职责。

## 镜像摘要

| 镜像 | 推荐 tag | 摘要 |
| --- | --- | --- |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl` | `opl-v10` | Portal 商业控制台、资源订单 UI、冻结与结算状态展示。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl` | `opl-v10` | run 前订单准备、Portal 到 runtime 的订单上下文透传。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl` | `opl-v10` | OPL Gateway 与 Portal SSO 链路；本轮无新业务行为，仅保持 release set 一致。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl` | `opl-v10` | 腾讯云价格、真实账单归因、pending/exact/unattributed 输出。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl` | `opl-v10` | Resource Order 驱动的算力开通、扩容、资源 ID 回填。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl` | `opl-v10` | dynamic Job 模板注入 `resource_order_id`，不做扣费。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl` | `opl-v1` 或当前稳定 tag | 当前未修改源码时继续沿用稳定镜像。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl` | `opl-v1` 或当前稳定 tag | 当前未修改源码时继续沿用稳定镜像。 |

## 发布前检查

- `deploy/tke-package/rendered/*.yaml` 不应再包含 `opl-v7`、`opl-v8`、`opl-v9`。
- `imagePullPolicy` 必须保持 `Always`。
- `BUILD_SHA` 应更新为 `opl-v10`。
- 如 `opl-web-opl`、`med-autoscience-runner-opl` 未跟随本次源码变化，请在发布记录里明确“沿用稳定 tag，无源码变化”。

## 推送结果

| 镜像 | tag | digest | 发布摘要 |
| --- | --- | --- | --- |
| `portal-opl` | `opl-v10` | `sha256:13c2dc0fef39e243b8e56166c38adb651b0b9dcd3dd007370967cb59a207c0c3` | Resource Order、冻结账本、订单 API、商业化总览与服务器费用 UI。 |
| `portal-opl-adapter-opl` | `opl-v10` | `sha256:426467c0c0d31811064064e505b877f468cc73e93250f3671f243b3287df26cd` | run 前调用 Portal 内部订单准备接口，并透传 `resourceOrderId`。 |
| `opl-web-gateway-opl` | `opl-v10` | `sha256:bbad3775f456249b4b82941ee5ca90a50a6c63bd27d96d0249bc0b940487a168` | 延续 v9 模块化 Gateway 与 Portal SSO / 原生登录桥接；本轮无新增业务行为。 |
| `billing-aggregator-opl` | `opl-v10` | `sha256:eb4b5c3a24b6b100532a0b9a1d6b1e831cabd82d9857451fc079918639d40958` | exact-only 结算、pending/exact/unattributed 分层、真实账单归因入口。 |
| `resource-provisioner-opl` | `opl-v10` | `sha256:b9b7c3e6c933d6305561d4d371473471a0d8f06ddc749f7654de096c6adf486c` | 订单化资源开通边界，负责 ensure-capacity 和资源 ID 回填。 |
| `med-autoscience-runner-orchestrator-opl` | `opl-v10` | `sha256:b66bc2b9f19c0741c8fb2e596f7a53bc6155d20075470a99e567cabb736c4655` | 生成 Job 时加入 `resource_order_id` label/env；Runner 链路不做扣费。 |
| `med-autoscience-runner-opl` | `opl-v10` | `sha256:04032779eba68d9a1e8caff93e241c07d9384230d33142d069c268d5f1085810` | 无源码变化，仅补推 tag；TKE 当前仍使用稳定 `opl-v1`，digest 相同。 |

## 沿用镜像

| 镜像 | tag | digest | 说明 |
| --- | --- | --- | --- |
| `opl-web-opl` | `opl-v1` | `sha256:85703a854051bbb73df997f41e5ec9272a9eb4e8027c0791bca7b07aabc910e9` | 本轮未改 OPL Web 上游源码，继续使用稳定 tag。 |
| `med-autoscience-runner-opl` | `opl-v1` | `sha256:04032779eba68d9a1e8caff93e241c07d9384230d33142d069c268d5f1085810` | 本轮业务变更在 orchestrator，runner 镜像本身保持稳定。 |

## 边界原则

- Portal 负责用户、钱包、Resource Order 和冻结账本，不直连腾讯云 Secret。
- Billing Aggregator 负责腾讯云价格/账单归因和 exact/pending/unattributed 输出，不登录用户。
- Resource Provisioner 负责按订单开通或扩容资源，不管理钱包。
- Runner / Orchestrator 负责创建运行 Job 和透传 `resource_order_id`，不直接扣费。
- Gateway 负责 OPL 入口和身份桥接，不读取 Portal DB。

## 真实账单限制

`opl-v10` 已实现真实账单优先的代码路径，但生产 exact 结算仍依赖腾讯云 Secret、账单明细或 COS 账单文件，以及资源标签中的 `tenant_id`、`workspace_id`、`run_id`、`resource_order_id` 归因。缺少 Tencent exact bill 时系统只输出 pending，不会把估算成本当成 exact 扣费。
