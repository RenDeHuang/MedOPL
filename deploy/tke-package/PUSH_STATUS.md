# TCR 镜像推送状态

TCR 登录账号：

```text
100047070895
```

本轮产品上 TKE 需要的应用镜像共 7 个，已从原单仓库 tag 拆分到 7 个独立私有仓库。Portal 已升级到 v2，拆分后的远端镜像如下：

```text
uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v2
uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v1
```

远端 manifest digest：

```text
portal-opl:opl-v2                                    sha256:405af32ee34c2d2e382706e98657414088fffe8bcd353f67dd8477f73e6a4980
portal-opl-adapter-opl:opl-v1                        sha256:1334aa46d61ee779f49de4716e352c281a7f595f74273a52b9dd9331ecb6feed
opl-web-gateway-opl:opl-v1                           sha256:79e34ec0cc9e655d398fe2f7aef430fa0d44f6ec2801e5b0254142d299eefa1a
opl-web-opl:opl-v1                                   sha256:85703a854051bbb73df997f41e5ec9272a9eb4e8027c0791bca7b07aabc910e9
billing-aggregator-opl:opl-v1                        sha256:5ef6d7df4e9ca7009c2821b4b5e32926ab8036cb26974da7dba0122cda35fde9
med-autoscience-runner-orchestrator-opl:opl-v1       sha256:694ceedcf198de827ebce3e4ada44dda620dcc9eff328e0b592d3326b582f715
med-autoscience-runner-opl:opl-v1                    sha256:04032779eba68d9a1e8caff93e241c07d9384230d33142d069c268d5f1085810
```

状态：

- 本地源镜像：7/7 存在
- 分仓 retag：7/7 完成
- 分仓并行 push：7/7 完成
- 远端 manifest HEAD 检查：7/7 通过
- 包内 `env/tke.env`：已切到 7 个独立仓库地址
- 包内 `WORKLOAD_SIZING.md`：已写入 7 个镜像的工作负载类型、端口和 CPU/内存建议
- Portal v2：关闭 OIDC/Harbor 时不再强制校验对应 secret；试运行默认 `PORTAL_STORAGE_MODE=json`
- 包内密码：未写入

离线镜像包仍保留：

```text
images/opl-tke-images-opl-v1.tar
```

这个 tar 用于断网或 TCR 不稳定时的离线恢复。它内部仍是原单仓库 tag，使用前需要 retag 到分仓地址；当前 TCR 远端已经完成分仓推送，正常 TKE 部署不需要再加载这个 tar。

TKE 部署前需要在 `portal-staging` 和 `portal-runtime-staging` 两个 namespace 创建同名镜像拉取 Secret：

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

注意：

- 这 7 个是 Portal + OPL 接入闭环的应用镜像，不包括 Postgres、Redis、Ingress、TLS、OpenCost、Langfuse、MinIO/COS 等外部基础设施。
- 正式营业前仍需要完成真实域名证书、真实 DB/Redis、对象存储、OpenCost 对账、Langfuse trace 和 OIDC/SSO 正式化验证。
