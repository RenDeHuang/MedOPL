# OPL v10 Release Summary

日期：2026-04-27

## 版本定位

`opl-v10` 用于 Portal + OPL 的资源订单商业化闭环版本。这个摘要文件只记录本次发布应该更新哪些镜像、哪些镜像沿用稳定版本，以及每个镜像对外承担的职责。

## 镜像摘要

| 镜像 | 推荐 tag | 摘要 |
| --- | --- | --- |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl` | `opl-v10` | Portal 商业控制台、资源订单 UI、冻结与结算状态展示。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl` | `opl-v10` | run 前订单准备、Portal 到 runtime 的订单上下文透传。 |
| `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl` | `opl-v10` | OPL Gateway 与 Portal SSO 链路，按需透传订单上下文。 |
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

## 待填写

- `portal-opl:opl-v10` digest：
- `portal-opl-adapter-opl:opl-v10` digest：
- `opl-web-gateway-opl:opl-v10` digest：
- `billing-aggregator-opl:opl-v10` digest：
- `resource-provisioner-opl:opl-v10` digest：
- `med-autoscience-runner-orchestrator-opl:opl-v10` digest：
- `opl-web-opl` 稳定 digest：
- `med-autoscience-runner-opl` 稳定 digest：
