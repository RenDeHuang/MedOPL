# TCR 镜像推送状态

TCR 登录账号：

```text
100047070895
```

当前产品上 TKE 需要的应用镜像共 7 个，已拆分到 7 个独立私有仓库。本轮只更新了 Portal 和 OPL Web Gateway，其余镜像沿用 `opl-v1`。

```text
uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v4
uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v2
uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-orchestrator-opl:opl-v1
uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v1
```

远端 manifest digest：

```text
portal-opl:opl-v4                                    sha256:8e685e46ff609a2527a895dd98398366aeba4bad0390a8c8f59d90cb006165da
portal-opl-adapter-opl:opl-v1                        sha256:1334aa46d61ee779f49de4716e352c281a7f595f74273a52b9dd9331ecb6feed
opl-web-gateway-opl:opl-v2                           sha256:6d76f220640edc7ed940f537e6ab8a1b3bee75617c91cb91ba6d8df183315df8
opl-web-opl:opl-v1                                   sha256:85703a854051bbb73df997f41e5ec9272a9eb4e8027c0791bca7b07aabc910e9
billing-aggregator-opl:opl-v1                        sha256:5ef6d7df4e9ca7009c2821b4b5e32926ab8036cb26974da7dba0122cda35fde9
med-autoscience-runner-orchestrator-opl:opl-v1       sha256:694ceedcf198de827ebce3e4ada44dda620dcc9eff328e0b592d3326b582f715
med-autoscience-runner-opl:opl-v1                    sha256:04032779eba68d9a1e8caff93e241c07d9384230d33142d069c268d5f1085810
```

本轮状态：

- Portal 镜像：已构建并推送 `opl-v4`。
- OPL Web Gateway 镜像：已构建并推送 `opl-v2`。
- 推送方式：Docker daemon 获取 TCR token 时 TLS 超时，已改用主机侧 `crane` 从本地 `docker save` tar 推送，并用 `crane digest` 验证远端 digest。
- 包内 `env/tke.env.tcr-gaofenglab.example`：已切到 `portal-opl:opl-v4` 和 `opl-web-gateway-opl:opl-v2`。
- 包内 `rendered/05-platform-workloads.yaml`：已切到 `portal-opl:opl-v4` 和 `opl-web-gateway-opl:opl-v2`。
- 包内密码：未写入。

离线镜像包仍保留：

```text
images/opl-tke-images-opl-v1.tar
images/portal-opl_opl-v4.tar
images/opl-web-gateway-opl_opl-v2.tar
```

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
- 正式营业前仍需要完成真实域名证书、真实 DB/Redis、对象存储、OpenCost 对账、Langfuse trace 和正式 OIDC/SSO 验证。
