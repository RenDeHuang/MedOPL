# TKE 工作负载端口与资源配置

这份配置面向当前 Portal + OPL 2 核 2GB 试运行。应用侧共 7 个镜像，但只需要创建 6 个常驻 Deployment；`med-autoscience-runner-opl` 是 runtime Job 镜像，由 `med-autoscience-runner-orchestrator-opl` 按需创建，不要单独建常驻工作负载。

## 控制台照填表

| 镜像 | 工作负载类型 | 容器端口 | CPU request | CPU limit | 内存 request | 内存 limit |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v4` | Deployment | `17080` | `100m` | `400m` | `192Mi` | `384Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v1` | Deployment | `8788` | `100m` | `400m` | `192Mi` | `384Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v2` | Deployment | `13031` | `50m` | `200m` | `64Mi` | `128Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v1` | Deployment | `3000` | `200m` | `600m` | `256Mi` | `512Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v1` | Deployment | `3001` | `50m` | `150m` | `64Mi` | `128Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl:opl-v1` | Deployment | `18890` | `100m` | `250m` | `128Mi` | `256Mi` |
| `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v1` | Job, 按需创建 | 不填 | `100m` | `500m` | `256Mi` | `512Mi` |

## 为什么这么填

- 2 核 2GB 只能做试运行，所以常驻服务合计 request 控制在 `600m CPU / 896Mi` 左右，给 kube-system、网络插件和镜像运行时留空间。
- 常驻服务合计 limit 控制在 `2000m CPU / 1792Mi`，刚好贴住节点容量；试运行可以起服务和跑 smoke，但不能承载并发。
- `opl-web-opl` 是 OPL 原生 Web UI，内存峰值最高，所以在试运行里也保留 `512Mi` limit。
- `portal-opl` 和 `portal-opl-adapter-opl` 是主链路服务，各给 `384Mi` limit，够登录、launch、session bind 试跑。
- `opl-web-gateway-opl` 和 `billing-aggregator-opl` 是轻服务，压到 `128Mi` limit。
- `med-autoscience-runner-orchestrator-opl` 只负责创建 Job，不跑计算，给 `256Mi` limit。
- `med-autoscience-runner-opl` 是实际 runtime Job，不暴露 HTTP 服务，也不应该创建 Service。2GB 试运行只给 `512Mi` limit，能跑轻量 smoke；真实 MAS/MAG/RCA 任务需要扩到至少 `2Gi-4Gi`。

## 服务暴露边界

- 对公网 Ingress 暴露：`portal-opl`、`opl-web-gateway-opl`。
- 集群内 ClusterIP：`portal-opl-adapter-opl`、`opl-web-opl`、`billing-aggregator-opl`、`med-autoscience-runner-orchestrator-opl`。
- 不创建常驻工作负载：`med-autoscience-runner-opl`，它只作为 runtime Job 镜像被拉起。

## 后续调参规则

- 如果 Pod 经常 OOMKilled：先把内存 limit 翻倍，再观察 30 分钟。
- 如果 Pod Pending：看 namespace 剩余 request，不要只看 limit。
- 如果接口慢但没有 OOM：优先加 CPU limit；如果 HPA 后续接入，再按 CPU request 做扩容基线。
- 如果 runtime Job 开始跑真实 MAS/MAG/RCA 长任务，把 `MED_AUTOSCIENCE_RUNNER_MEMORY_LIMIT` 从 `512Mi` 提到 `2Gi-4Gi`，并把节点扩到至少 4 核 8GB。
