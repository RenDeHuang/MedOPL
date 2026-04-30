# OPL v19 云上只读状态盘点

- 日期：2026-05-01
- 查询时间：2026-05-01T01:09:04+08:00
- 分支：`codex/opl-v19`
- 执行模型：`gpt-5.4`
- 范围：只读盘点；仅执行 `kubectl get`、`kubectl describe`、`kubectl logs`
- 显式 kube-apiserver：`https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`
- 说明：本文不记录 kubeconfig、token、Secret 值、密码，仅记录资源名、状态、镜像 tag、Secret 名称与是否存在

## 1. 集群与命名空间概况

当前命名空间：

- `default`
- `kube-system`
- `prom-ozau9bgo`

资源总数：

| Kind | Count |
| --- | ---: |
| CronJob | 1 |
| Deployment | 19 |
| Ingress | 1 |
| Job | 4 |
| Pod | 42 |
| Service | 25 |
| StatefulSet | 2 |

Pod 按命名空间统计：

| Namespace | Total | Running | Pending | Failed |
| --- | ---: | ---: | ---: | ---: |
| `default` | 21 | 15 | 0 | 6 |
| `kube-system` | 19 | 17 | 2 | 0 |
| `prom-ozau9bgo` | 2 | 2 | 0 | 0 |

重点异常：

- `default` 命名空间内最近 3 个 `billing-reconcile` Job 共保留 6 个失败 Pod。
- `kube-system/cls-provisioner` Deployment `0/1`，对应 Pod 处于 `CrashLoopBackOff`。
- `kube-system/coredns` Deployment `1/2`，其中 1 个 Pod `Pending`。
- `kube-system/tke-eni-ipamd` Deployment `1/2`，其中 1 个 Pod `Pending`。

## 2. Deployments 概况

| Namespace | Deployment | Ready | Image |
| --- | --- | ---: | --- |
| `default` | `billing-aggregator-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v18` |
| `default` | `kubernetes-proxy` | `2/2` | `uswccr.ccs.tencentyun.com/tkeimages/apiserver-proxy:v1.4.6` |
| `default` | `langfuse-clickhouse` | `1/1` | `clickhouse/clickhouse-server:24.8` |
| `default` | `langfuse-postgres` | `1/1` | `postgres:15-alpine` |
| `default` | `langfuse-redis` | `1/1` | `redis:7-alpine` |
| `default` | `langfuse-web` | `1/1` | `langfuse/langfuse:3` |
| `default` | `langfuse-worker` | `1/1` | `langfuse/langfuse-worker:3` |
| `default` | `med-autoscience-runner-orchestrator-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl:opl-v18` |
| `default` | `opl-web-gateway-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v18` |
| `default` | `opl-web-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v1` |
| `default` | `portal-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v18` |
| `default` | `portal-opl-adapter-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v18` |
| `default` | `resource-provisioner-opl` | `1/1` | `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl:opl-v18` |
| `kube-system` | `cls-provisioner` | `0/1` | `uswccr.ccs.tencentyun.com/tkeimages/cls-provisioner:v1.1.25` |
| `kube-system` | `com.tencent.cloud.csi.tcfs.cfs-rwx` | `1/1` | `uswccr.ccs.tencentyun.com/tkeimages/cfsclient:v0.1.2` |
| `kube-system` | `coredns` | `1/2` | `uswccr.ccs.tencentyun.com/tkeimages/coredns:v1.11.1-tke.1` |
| `kube-system` | `csi-cbs-controller` | `2/2` | `uswccr.ccs.tencentyun.com/tkeimages/csi-provisioner:v2.0.8-tke.3` 等 6 容器 |
| `kube-system` | `tke-eni-ipamd` | `1/2` | `uswccr.ccs.tencentyun.com/tkeimages/tke-eni-ipamd:v3.10.0` |
| `prom-ozau9bgo` | `proxy-agent` | `2/2` | `uswccr.ccs.tencentyun.com/cloudmonitor/multi-proxy:v1.0.14` |

## 3. StatefulSets 概况

当前无业务 StatefulSet；仅 `kube-system` 有 2 个：

| Namespace | StatefulSet | Ready | Images |
| --- | --- | ---: | --- |
| `kube-system` | `csi-provisioner-cfsplugin` | `1/1` | `uswccr.ccs.tencentyun.com/tkeimages/csi-provisioner:v2.0.8-tke.1`、`uswccr.ccs.tencentyun.com/tkeimages/tcfs:v0.1.9`、`uswccr.ccs.tencentyun.com/tkeimages/csi-tencentcloud-cfs:v2.0.13` |
| `kube-system` | `tke-kube-state-metrics` | `1/1` | `uswccr.ccs.tencentyun.com/cloudmonitor/tmp-kube-state-metrics:v2.18.0` |

## 4. CronJobs 概况

| Namespace | CronJob | Schedule | Image | Last Schedule |
| --- | --- | --- | --- | --- |
| `default` | `billing-reconcile` | `*/30 * * * *` | `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v14` | `2026-05-01 01:00:00 +08:00` |

## 5. Jobs 概况

| Namespace | Job | Created At (+08:00) | 状态摘要 |
| --- | --- | --- | --- |
| `default` | `billing-reconcile-29626080` | `2026-05-01 00:00:00` | `failed=2`，`BackoffLimitExceeded` |
| `default` | `billing-reconcile-29626110` | `2026-05-01 00:30:00` | `failed=2`，`BackoffLimitExceeded` |
| `default` | `billing-reconcile-29626140` | `2026-05-01 01:00:00` | `failed=2`，`BackoffLimitExceeded` |
| `default` | `med-autoscience-runner-opl` | `2026-04-26 01:22:12` | `active=1`，当前 Job 仍在运行 |

## 6. Pods 概况

业务侧当前运行正常的核心 Pod：

- `portal-opl-77547886df-j9k2z`
- `portal-opl-adapter-opl-7cddf6b46b-mhs96`
- `opl-web-gateway-opl-7d7fc9bbb5-69nbk`
- `billing-aggregator-opl-fd89c94c7-548pw`
- `resource-provisioner-opl-84765c658b-b454c`
- `med-autoscience-runner-orchestrator-opl-6b96c4495f-5gmgn`
- `med-autoscience-runner-opl-2cpkf`
- `opl-web-opl-f8f65bd6f-6cjnm`
- `langfuse-clickhouse-57df6c764-99t4j`
- `langfuse-postgres-b9877d87b-4vd75`
- `langfuse-redis-59cb8b7664-vbbr2`
- `langfuse-web-6bc5c85df4-lfpft`
- `langfuse-worker-6cb68f48dd-ml8qx`

异常 Pod：

| Namespace | Pod | Phase | Ready | Note |
| --- | --- | --- | ---: | --- |
| `default` | `billing-reconcile-29626080-jxcfs` | `Failed` | `0/1` | `Error` |
| `default` | `billing-reconcile-29626080-wnnns` | `Failed` | `0/1` | `Error` |
| `default` | `billing-reconcile-29626110-kgp24` | `Failed` | `0/1` | `Error` |
| `default` | `billing-reconcile-29626110-w9xzv` | `Failed` | `0/1` | `Error` |
| `default` | `billing-reconcile-29626140-4wgql` | `Failed` | `0/1` | `Error` |
| `default` | `billing-reconcile-29626140-tx6tq` | `Failed` | `0/1` | `Error` |
| `kube-system` | `cls-provisioner-784888488f-lckh2` | `Running` | `0/1` | `CrashLoopBackOff` |
| `kube-system` | `coredns-5899494b74-gp6w9` | `Pending` | `0/0` | 未进入运行态 |
| `kube-system` | `tke-eni-ipamd-88cfd64bc-4xpzh` | `Pending` | `0/0` | 未进入运行态 |

## 7. Services 概况

| Namespace | Service | Type | Ports | External |
| --- | --- | --- | --- | --- |
| `default` | `billing-aggregator` | `ClusterIP` | `3001` |  |
| `default` | `kubernetes` | `ClusterIP` | `443` |  |
| `default` | `kubernetes-extranet` | `LoadBalancer` | `443:30461` | `lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com` |
| `default` | `langfuse-clickhouse` | `ClusterIP` | `8123,9000` |  |
| `default` | `langfuse-postgres` | `ClusterIP` | `5432` |  |
| `default` | `langfuse-redis` | `ClusterIP` | `6379` |  |
| `default` | `langfuse-web` | `NodePort` | `3000:32113` |  |
| `default` | `med-autoscience-runner` | `ClusterIP` | `18890` |  |
| `default` | `med-autoscience-runner-orchestrator-opl` | `ClusterIP` | `18890` |  |
| `default` | `opl-web-gateway` | `NodePort` | `13031:32740` |  |
| `default` | `opl-web-upstream` | `NodePort` | `3000:31238` |  |
| `default` | `portal-opl` | `NodePort` | `17080:32276` |  |
| `default` | `portal-opl-adapter` | `ClusterIP` | `8788` |  |
| `default` | `resource-provisioner` | `ClusterIP` | `18893` |  |
| `kube-system` | `csi-provisioner-cfsplugin` | `ClusterIP` | `12345` |  |
| `kube-system` | `hpa-metrics-service` | `ClusterIP` | `443` |  |
| `kube-system` | `kube-dns` | `ClusterIP` | `53,53` |  |
| `kube-system` | `kubejarvis` | `ExternalName` | `8443` |  |
| `kube-system` | `machine-apiserver` | `ExternalName` | `443` |  |
| `kube-system` | `master-metrics-service` | `ClusterIP` | `19090` |  |
| `kube-system` | `metrics-service` | `ClusterIP` | `443` |  |
| `kube-system` | `nvidia-gpu-exporter` | `ClusterIP` | `5678` |  |
| `kube-system` | `tke-eni-ipamd` | `ClusterIP` | `8080` |  |
| `kube-system` | `tke-kube-state-metrics` | `ClusterIP` | `8180,8181` |  |
| `kube-system` | `tke-node-exporter` | `ClusterIP` | `9100` |  |

## 8. Ingress 概况

| Namespace | Ingress | Hosts | Address |
| --- | --- | --- | --- |
| `default` | `gaofenglab` | `portal.medopl.cn`、`opl.medopl.cn`、`trace.medopl.cn` | `lb-7osxdayi-vodne4arkfxy067j.clb.usw-tencentclb.com` |

## 9. 关键镜像 tag

重点业务工作负载当前镜像 tag：

| Workload | Kind | Image | Tag |
| --- | --- | --- | --- |
| `portal-opl` | Deployment | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v18` | `opl-v18` |
| `opl-web-gateway-opl` | Deployment | `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v18` | `opl-v18` |
| `portal-opl-adapter-opl` | Deployment | `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v18` | `opl-v18` |
| `billing-aggregator-opl` | Deployment | `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v18` | `opl-v18` |
| `resource-provisioner-opl` | Deployment | `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl:opl-v18` | `opl-v18` |
| `billing-reconcile` | CronJob | `uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v14` | `opl-v14` |

结论：

- 五个重点 Deployment 已全部运行在 `opl-v18`。
- `billing-reconcile` CronJob 仍停留在 `opl-v14`，与当前主业务 Deployment 版本不一致。

## 10. billing-reconcile 明细

### 10.1 规格

- Namespace：`default`
- Schedule：`*/30 * * * *`
- Suspend：`false`
- ConcurrencyPolicy：`Forbid`
- BackoffLimit：`1`
- Image：`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v14`
- Command：`node src/server.mjs`
- Args：无

### 10.2 env 引用

容器显式声明的 env 名称：

- `PORT`
- `BILLING_RECONCILE_ONCE`
- `BUILD_SHA`
- `BUILD_TIME`
- `TENCENT_BILLING_ENABLED`
- `TENCENT_BILLING_REQUIRED`
- `TENCENT_PRICE_ENABLED`
- `TENCENT_CLOUD_REGION`
- `TENCENT_COS_BILL_BUCKET`
- `TENCENT_COS_BILL_REGION`
- `TENCENT_COS_BILL_PREFIX`
- `TENCENT_PRICE_IMAGE_ID`
- `TENCENT_COS_BILL_ENDPOINT`

`envFrom` 引用：

- `SecretRef: tencent-billing-secret`

### 10.3 最近 Job 状态

最近 3 次调度均失败：

| Job | 调度时间 (+08:00) | 失败 Pod 数 | 失败原因 |
| --- | --- | ---: | --- |
| `billing-reconcile-29626080` | `2026-05-01 00:00:00` | 2 | `BackoffLimitExceeded` |
| `billing-reconcile-29626110` | `2026-05-01 00:30:00` | 2 | `BackoffLimitExceeded` |
| `billing-reconcile-29626140` | `2026-05-01 01:00:00` | 2 | `BackoffLimitExceeded` |

最新一次 Job 的 2 个失败 Pod：

- `billing-reconcile-29626140-4wgql`：`exitCode=1`
- `billing-reconcile-29626140-tx6tq`：`exitCode=1`

### 10.4 失败日志摘要

对最新一次 Job 的两个失败 Pod 执行 `kubectl logs`，两者输出一致：

- 仅打印一行启动日志，表明进程监听到 `:0`
- 随后容器立刻以 `exitCode=1` 退出
- `kubectl logs` 未看到进一步错误栈
- `kubectl describe pod` 事件显示镜像拉取、容器创建与启动均成功，失败发生在应用进程启动后

因此，当前可确认的是：`billing-reconcile` 并非调度、拉镜像或卷挂载失败，而是容器内应用进程在启动后立即异常退出。

## 11. Secrets 名称与存在性

### 11.1 `default`

以下 Secret 当前均存在：

- `gaofeng-tcr`
- `gaofeng-tcr-key`
- `gaofenglab`
- `langfuse-client-keys`
- `langfuse-secrets`
- `portal-postgres-redis`
- `secret-opl`
- `secret-opl-qcloud`
- `secret-portal`
- `secret-portal-qcloud`
- `secret-trace`
- `secret-trace-qcloud`
- `tencent-billing-secret`
- `tencent-cos-secret`
- `tencent-provisioner-secret`

### 11.2 `kube-system`

以下 Secret 当前均存在：

- `eni-ip-webhook-certs`
- `kubejarvis-executor`
- `service-controller-readiness-gate`
- `sh.helm.release.v1.cbs.v1`
- `sh.helm.release.v1.cbs.v2`
- `sh.helm.release.v1.cbs.v3`
- `sh.helm.release.v1.cfs.v1`
- `sh.helm.release.v1.cfs.v2`
- `sh.helm.release.v1.cfs.v3`
- `sh.helm.release.v1.coredns.v46`
- `sh.helm.release.v1.coredns.v47`
- `sh.helm.release.v1.coredns.v48`
- `sh.helm.release.v1.coredns.v49`
- `sh.helm.release.v1.coredns.v50`
- `sh.helm.release.v1.coredns.v51`
- `sh.helm.release.v1.coredns.v52`
- `sh.helm.release.v1.coredns.v53`
- `sh.helm.release.v1.coredns.v54`
- `sh.helm.release.v1.coredns.v55`
- `sh.helm.release.v1.eniipamd.v1`
- `sh.helm.release.v1.eniipamd.v2`
- `sh.helm.release.v1.eniipamd.v3`
- `sh.helm.release.v1.gatekeeper.v1`
- `sh.helm.release.v1.gatekeeper.v2`
- `sh.helm.release.v1.gatekeeper.v3`
- `sh.helm.release.v1.gatekeeper.v4`
- `sh.helm.release.v1.ip-masq-agent.v1`
- `sh.helm.release.v1.ip-masq-agent.v2`
- `sh.helm.release.v1.ip-masq-agent.v3`
- `sh.helm.release.v1.kubejarvisservice.v1`
- `sh.helm.release.v1.kubejarvisservice.v2`
- `sh.helm.release.v1.kubejarvisservice.v3`
- `sh.helm.release.v1.kubeproxy.v1`
- `sh.helm.release.v1.kubeproxy.v2`
- `sh.helm.release.v1.kubeproxy.v3`
- `sh.helm.release.v1.monitoragent.v1`
- `sh.helm.release.v1.monitoragent.v2`
- `sh.helm.release.v1.monitoragent.v3`
- `sh.helm.release.v1.nvidia-gpu.v1`
- `sh.helm.release.v1.nvidia-gpu.v2`
- `sh.helm.release.v1.nvidia-gpu.v3`
- `sh.helm.release.v1.tke-log-agent.v1`
- `sh.helm.release.v1.tke-log-agent.v2`
- `sh.helm.release.v1.tmp-scrape-component.v1`

### 11.3 `prom-ozau9bgo`

以下 Secret 当前均存在：

- `prom-ozau9bgo-token`
- `prometheus-config`

## 12. 直接结论

- 业务主链核心 Deployment 当前均为 `opl-v18` 且 `1/1` 就绪。
- `billing-reconcile` CronJob 仍为 `opl-v14`，最近 3 次调度在 `2026-05-01 00:00:00`、`00:30:00`、`01:00:00`（+08:00）全部失败。
- `billing-reconcile` 最新失败日志只显示进程启动后立即退出，未暴露更多应用栈信息。
- 集群系统层同时存在 `cls-provisioner`、`coredns`、`tke-eni-ipamd` 未完全就绪的状态，虽不直接阻断本次盘点，但需要在后续运维核查中并行关注。
