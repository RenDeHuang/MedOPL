# OpenBao + ESO 生产化任务包

目标：
- 把当前本地验证态的 `OpenBao + External Secrets` 推进成云上可执行的生产化任务包

适用边界：
- 不改任何上游源码
- 只提供平台层安装、接线、值守和校验步骤

## 当前状态

当前仓库已经有：
- `configs/ops/openbao-values.yaml`
- `configs/ops/external-secrets-values.yaml`
- 本地验证通过的安装脚本

当前不足：
- OpenBao 仍是 dev 形态，不可直接商用
- 还缺正式 values、SecretStore、ExternalSecret 示例
- 还缺上线执行顺序与验证步骤

## 目录与用途

- `configs/ops/openbao-production-values.example.yaml`
  - OpenBao 正式 HA/raft 参考配置
- `configs/ops/eso-secretstore-openbao.example.yaml`
  - ESO 连接 OpenBao 的 ClusterSecretStore 示例
- `configs/ops/eso-portal-platform-secrets.example.yaml`
  - Portal / Billing 等平台级密钥同步示例
- `configs/ops/eso-workspace-runtime-secrets.example.yaml`
  - workspace runtime / Harbor / MinIO 拉密钥示例
- `configs/ops/eso-local-dev-secretstore.yaml`
  - 本地验证用 ClusterSecretStore 与 token secret
- `configs/ops/eso-local-dev-probe.yaml`
  - 本地验证用 ExternalSecret 探针
- `scripts/install-openbao-eso-local.ps1`
  - 本地一键安装 + 写入探针数据
- `scripts/verify-openbao-eso-local.ps1`
  - 本地一键验证脚本

## 云上执行顺序

1. 在云上 K8s 安装 OpenBao
2. 初始化 / unseal / 备份 root token
3. 开启 `kv-v2`
4. 写入平台级 secrets
5. 安装 External Secrets
6. 应用 `ClusterSecretStore`
7. 应用各业务 `ExternalSecret`
8. 验证目标 Secret 是否生成
9. 用 Deployment / Job / CronJob 消费 Secret

## OpenBao 初始化示例

```bash
kubectl -n openbao-system exec -it statefulset/openbao -- bao operator init
kubectl -n openbao-system exec -it statefulset/openbao -- bao operator unseal <key1>
kubectl -n openbao-system exec -it statefulset/openbao -- bao operator unseal <key2>
kubectl -n openbao-system exec -it statefulset/openbao -- bao operator unseal <key3>
kubectl -n openbao-system exec -it statefulset/openbao -- bao login <root-token>
kubectl -n openbao-system exec -it statefulset/openbao -- bao secrets enable -path=kv kv-v2
```

## 本地验证步骤

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-openbao-eso-local.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify-openbao-eso-local.ps1
```

预期结果：
- `openbao-local-dev-store` Ready
- `openbao-local-probe` ExternalSecret Ready
- `openbao-local-probe` Secret 已生成
- 解码值应为 `ready`

## 建议的密钥分层

平台级：
- Portal OIDC client secret
- Billing signing key
- Langfuse keys
- OpenCost / Cloud billing credentials
- Harbor pull robot
- MinIO root / service keys

用户级：
- 用户自己的 API key
- 用户 workspace 运行时临时注入 token

运行时级：
- Harbor 镜像拉取凭据
- MinIO 上传凭据
- Codex / model gateway 调用凭据

## 商用注意事项

- 不要把当前 `openbao-values.yaml` 直接拿去生产
- root token 绝不能继续保存在明文文件中
- unseal key 必须分人保管
- 用户级 API key 不应直接回写到前端本地存储
- 业务 Secret 应按 namespace 和职责拆分，不要一个大 Secret 全部混放
