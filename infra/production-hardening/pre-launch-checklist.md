# 上线前执行 Checklist

适用目标：
- 本地验证版准备迁移到云上。
- 上线前做一轮值守复验。

## 1. 服务健康

- `node scripts/check-commercial-blockers.mjs`
- Portal 管理员页检查：
  - OPL Runtime Bridge
  - Langfuse
  - Rancher
  - OpenCost
  - Harbor
  - MinIO

## 2. 用户链路

- `node scripts/smoke-test-portal-opl-hard-loop.mjs`
- 抽样检查 Portal 开户、登录、余额、任务空间、账单、轨迹。
- 抽样检查 AionUI/OPL 工作台 launch 与 bootstrap。
- 抽样检查 runtime run、artifact、trace、cost 回流。

## 3. 任务空间链路

- 抽样上传一个输入文件。
- 抽样下载一个输出文件。
- 抽样下载输入整包。
- 抽样下载输出整包。
- 确认最近运行列表与输出文件一致。

## 4. 账单链路

- 打开 Portal 账单页。
- 检查 `pricingSource`。
- 导出 run 级 CSV。
- 导出任务级汇总 CSV。
- 检查最近一笔扣费。
- 抽样核对一条 run 的时间、状态、成本来源。

## 5. Secrets

- `powershell -ExecutionPolicy Bypass -File scripts/verify-openbao-eso-local.ps1`
- ClusterSecretStore Ready。
- ExternalSecret Ready。
- probe Secret 值为 `ready`。

## 6. 运维材料

- `infra/production-hardening/openbao-eso-production-package.md`
- `infra/production-hardening/monitoring-backup-recovery-runbook.md`
- `infra/production-hardening/pre-launch-checklist.md`

## 7. 风险确认

- 当前是否仍允许开放注册。
- 当前余额阻断是否开启。
- 当前生产定价是否已经替换掉 demo/估算值。
- 当前备份是否真实存在。
- 当前恢复流程是否至少演练过一次。
