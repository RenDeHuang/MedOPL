# 生产化基础骨架

这组文件不是第三方源码修改，而是平台上线时要落到云上 K8s 的外层配置与运维文档。

目标：
- Ingress / 域名 / TLS
- 监控 / 日志 / 告警
- Secrets 管理
- 商用上线前检查

推荐阅读顺序：
1. `configs/ops/ingress-nginx-values.yaml`
2. `configs/ops/openbao-values.yaml`
3. `configs/ops/openbao-production-values.example.yaml`
4. `configs/ops/external-secrets-values.yaml`
5. `configs/ops/eso-secretstore-openbao.example.yaml`
6. `configs/ops/eso-portal-platform-secrets.example.yaml`
7. `configs/ops/eso-workspace-runtime-secrets.example.yaml`
8. `configs/ops/kube-prometheus-stack-values.yaml`
9. `infra/production-hardening/openbao-eso-production-package.md`
10. `infra/production-hardening/monitoring-backup-recovery-runbook.md`
11. `scripts/check-commercial-blockers.mjs`

注意：
- 这些文件是我们平台自己的生产化外层配置，不代表已经替代了云上正式安装步骤
- 当前仓库里的 `openbao-values.yaml` 仍然偏本地验证参考，生产请以 `openbao-production-values.example.yaml` 为起点
- 上线前仍需要把域名、存储类、节点池、告警通道替换成真实云环境值
