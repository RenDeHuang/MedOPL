# TKE 控制台新建工作负载照填表

目标机器是 2 核 CPU、2GB 内存，所以这里是试运行规格：先跑通 Portal 登录、OPL Web 打开、launch/session bind、runtime 调度和 smoke，不承诺真实并发或重任务。

应用镜像共 7 个，但只创建 6 个常驻 Deployment。`med-autoscience-runner-opl` 是 runtime Job 镜像，由 `med-autoscience-runner` 调度器按需创建，不要在控制台里建常驻工作负载。

## 公共字段

| 控制台字段 | 填写值 |
| --- | --- |
| 命名空间 | `portal-staging` |
| 实例数量 | `1` |
| 镜像访问凭证 | `tcr-pull-secret` |
| 镜像拉取策略 | `IfNotPresent` |
| labels | `app=<工作负载名称>` |
| annotations | 留空 |
| 容忍调度 | 留空 |
| Service | 创建 Service |
| 服务访问方式 | `集群内访问 / ClusterIP` |
| 端口映射协议 | `TCP` |
| 端口映射名称 | `http` |

如果控制台只让填“CPU 限制 / 内存限制”，填下面的 limit 值；如果同时有 request 和 limit，按表里 request/limit 都填。

## 6 个常驻工作负载

| 工作负载名称 | 描述 | labels | 容器名称 | 镜像 | 镜像版本 | 环境变量 | CPU request | CPU limit | 内存 request | 内存 limit | 容器端口名称/协议/端口 | Service name | 服务访问方式 | Service 端口映射 |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `portal` | SaaS Portal 控制面 | `app=portal` | `portal` | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl` | `opl-v1` | `PORT=17080`；并引用 `portal-platform-config`、`portal-platform-secrets` | `100m` | `400m` | `192Mi` | `384Mi` | `http / TCP / 17080` | `portal` | `ClusterIP` | `TCP / 容器端口 17080 / 服务端口 17080 / http` |
| `portal-opl-adapter` | Portal 与 OPL 适配层 | `app=portal-opl-adapter` | `portal-opl-adapter` | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl` | `opl-v1` | `PORT=8788`；`PORTAL_OPL_ADAPTER_STATE_ROOT=/app/.runtime/portal-opl-adapter`；并引用 `portal-platform-config`、`portal-platform-secrets` | `100m` | `400m` | `192Mi` | `384Mi` | `http / TCP / 8788` | `portal-opl-adapter` | `ClusterIP` | `TCP / 容器端口 8788 / 服务端口 8788 / http` |
| `opl-web-upstream` | OPL 原生 Web 工作台 | `app=opl-web-upstream` | `opl-web-upstream` | `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl` | `opl-v1` | `PORT=3000`；并引用 `portal-platform-config`、`portal-platform-secrets` | `200m` | `600m` | `256Mi` | `512Mi` | `http / TCP / 3000` | `opl-web-upstream` | `ClusterIP` | `TCP / 容器端口 3000 / 服务端口 3000 / http` |
| `opl-web-gateway` | OPL Web 网关 | `app=opl-web-gateway` | `opl-web-gateway` | `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl` | `opl-v1` | `PORT=13031`；`PORTAL_OPL_ADAPTER_URL=http://portal-opl-adapter:8788`；并引用 `portal-platform-config`、`portal-platform-secrets` | `50m` | `200m` | `64Mi` | `128Mi` | `http / TCP / 13031` | `opl-web-gateway` | `ClusterIP` | `TCP / 容器端口 13031 / 服务端口 13031 / http` |
| `billing-aggregator` | 计费聚合服务 | `app=billing-aggregator` | `billing-aggregator` | `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl` | `opl-v1` | `PORT=3001`；并引用 `portal-platform-config`、`portal-platform-secrets` | `50m` | `150m` | `64Mi` | `128Mi` | `http / TCP / 3001` | `billing-aggregator` | `ClusterIP` | `TCP / 容器端口 3001 / 服务端口 3001 / http` |
| `med-autoscience-runner` | Runtime Job 调度器 | `app=med-autoscience-runner` | `med-autoscience-runner` | `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl` | `opl-v1` | `MED_AUTOSCIENCE_RUNNER_PORT=18890`；并引用 `portal-platform-config`、`portal-platform-secrets` | `100m` | `250m` | `128Mi` | `256Mi` | `http / TCP / 18890` | `med-autoscience-runner` | `ClusterIP` | `TCP / 容器端口 18890 / 服务端口 18890 / http` |

## 第 7 个镜像怎么处理

| 镜像 | 控制台动作 | 命名空间 | CPU | 内存 | 端口 | Service |
| --- | --- | --- | --- | --- | --- | --- |
| `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v1` | 不创建常驻工作负载；只作为 Job 镜像 | `portal-runtime-staging` | `100m / 500m` | `256Mi / 512Mi` | 不填 | 不创建 |

它的资源来自 `portal-platform-config` 里的这 4 个变量：

```text
MED_AUTOSCIENCE_RUNNER_CPU_REQUEST=100m
MED_AUTOSCIENCE_RUNNER_CPU_LIMIT=500m
MED_AUTOSCIENCE_RUNNER_MEMORY_REQUEST=256Mi
MED_AUTOSCIENCE_RUNNER_MEMORY_LIMIT=512Mi
```

如果只是为了在 TKE 控制台手动创建一次 smoke Job，按下面填：

| 控制台字段 | 填写值 |
| --- | --- |
| 工作负载类型 | `Job` |
| 名称 | `med-autoscience-smoke-001` |
| 描述 | `med-autoscience runner smoke job` |
| 命名空间 | `portal-runtime-staging` |
| labels | `app=med-autoscience`, `run_id=smoke-001`, `tool_name=med-autoscience`, `billing_scope=smoke` |
| annotations | 留空 |
| 重复次数 / completions | `1` |
| 并行度 / parallelism | `1` |
| 失败重启策略 | `Never` |
| 失败重试次数 / backoff limit | `0`，如果控制台必须大于 0 就填 `1` |
| 可抢占 | 关闭 |
| 容器名称 | `runner` |
| 镜像 | `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl` |
| 镜像版本 | `opl-v1` |
| 镜像拉取策略 | `IfNotPresent` |
| 镜像访问凭证 | `tcr-pull-secret` |
| CPU request / limit | `100m / 500m` |
| 内存 request / limit | `256Mi / 512Mi` |
| 容器端口 | 不填 |
| Service | 不创建 |
| 命令 | `sh` |
| 参数 | `-lc`, `medautosci show-agent-entry-modes` |

smoke Job 环境变量：

| 变量名 | 试运行填写值 |
| --- | --- |
| `PORTAL_USER_ID` | `smoke-user` |
| `CUSTOMER_ID` | `smoke-user` |
| `USER_ID` | `smoke-user` |
| `WORKSPACE_ID` | `smoke-workspace` |
| `RUNTIME_SESSION_ID` | `smoke-runtime-session` |
| `RUN_ID` | `smoke-001` |
| `WORKSPACE_SESSION_ID` | `smoke-workspace-session` |
| `AGENT_ID` | `mas` |
| `TOOL_NAME` | `med-autoscience` |
| `BILLING_SCOPE` | `smoke` |
| `COST_CENTER` | `trial` |
| `GROUP_ID` | `trial` |
| `POLICY_VERSION` | `trial-v1` |
| `RUNNER_IMAGE_TAG` | `opl-v1` |

正式运行时不要手填这些 smoke 值。正式值由 `med-autoscience-runner` 调度器根据 Portal 用户、workspace、session、run id、分组策略和计费范围自动注入。

## 前置对象

手动建工作负载前，先确认这些对象存在：

```powershell
kubectl apply -f .\rendered\00-namespaces.yaml
kubectl apply -f .\rendered\01-platform-config.yaml
kubectl apply -f .\rendered\02-platform-secrets.example.yaml
kubectl apply -f .\rendered\03-runtime-storage.yaml
kubectl apply -f .\rendered\04-runner-rbac.yaml
```

还需要创建镜像拉取凭证：

```powershell
kubectl -n portal-staging create secret docker-registry tcr-pull-secret `
  --docker-server=uswccr.ccs.tencentyun.com `
  --docker-username=100047070895 `
  --docker-password="<TCR 访问密码>"

kubectl -n portal-runtime-staging create secret docker-registry tcr-pull-secret `
  --docker-server=uswccr.ccs.tencentyun.com `
  --docker-username=100047070895 `
  --docker-password="<TCR 访问密码>"
```

## 为什么这样压资源

- 6 个常驻服务合计 request 约 `600m CPU / 896Mi`，给系统组件和镜像运行时留下余量。
- 6 个常驻服务合计 limit 约 `2000m CPU / 1792Mi`，贴近 2 核 2GB 上限，适合试运行但不适合并发。
- `opl-web-upstream` 内存最高，因为它承载 OPL 原生 Web UI。
- `med-autoscience-runner-opl` 不常驻，避免 2GB 机器被空转 Job 镜像占住。
