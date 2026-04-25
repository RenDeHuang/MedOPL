# 监控 / 备份 / 恢复可执行清单

目标：把当前本地可跑环境推进成“云上可值守”的操作手册。

## 监控

必须监控的对象：
- Portal
- Portal OPL Adapter
- med-autoscience runner/orchestrator
- OpenCost
- Harbor
- MinIO
- OpenBao
- Rancher
- Langfuse 或后续 trace indexer

必须监控的指标：
- 可达性 / healthz
- 5xx 错误率
- 请求时延
- OPL launch 创建失败次数
- runtime run 失败次数
- med-autoscience run 失败次数
- OpenCost 拉取失败次数
- 余额阻断次数
- MinIO 同步失败次数

执行建议：
1. Prometheus 拉取所有服务 `/healthz`。
2. Grafana 做四块面板：服务健康、OPL launch 成功率、workspace run 成功率、资源成本趋势。

## 日志

建议统一字段：
- `occurredAt`
- `type`
- `userId`
- `workspaceId`
- `workspaceSessionId`
- `runtimeSessionId`
- `runId`
- `requestId`
- `status`
- `error`

重点排查顺序：
1. Portal 页面是否能进入。
2. workspace session 是否创建。
3. Portal OPL Adapter 是否创建 launch context。
4. OPL Web 是否通过 `/api/opl-launch/bootstrap` 拿到当前 session。
5. med-autoscience runner 是否真正执行。
6. artifact、trace、cost 是否回流。

## 备份

需要备份的内容：
- `.runtime/portal/portal-db.json`
- `.runtime/portal-opl-adapter/*`
- MinIO buckets
- OpenBao data / raft storage
- Harbor metadata
- `configs/ops/*`
- `infra/production-hardening/*`

建议频率：
- Portal DB：每日。
- Portal OPL Adapter records：每日。
- MinIO：每日 + 每周整备份。
- OpenBao：每日快照。
- 配置文件：每次变更后立即备份。

备份验收：
- 至少保留最近 7 天。
- 至少保留最近 4 周周备份。
- 至少每月做一次抽样恢复。

## 恢复

Portal 恢复：
1. 停止 Portal 写入。
2. 恢复 `portal-db.json` 或对应数据库快照。
3. 重启 Portal。
4. 验证登录、账单、任务空间。

Portal OPL Adapter 恢复：
1. 恢复 launch/session/run/artifact/trace/cost records。
2. 重启 Portal OPL Adapter。
3. 验证 `/healthz`。
4. 跑 `node scripts/smoke-test-portal-opl-adapter.mjs`。

MinIO 恢复：
1. 恢复 bucket。
2. 检查 `inputs/outputs` 路径完整性。
3. 从任务空间页抽样下载验证。

OpenBao 恢复：
1. 恢复 OpenBao 存储。
2. unseal。
3. 验证 ClusterSecretStore Ready。
4. 验证 ExternalSecret 重新下发。

## 上线前执行 checklist

### A. 服务健康

- `node scripts/check-commercial-blockers.mjs`
- 管理员页检查：
  - Portal OPL Adapter
  - Langfuse
  - Rancher
  - OpenCost
  - Harbor
  - MinIO

### B. 业务链路

- `node scripts/smoke-test-portal-opl-hard-loop.mjs`
- 抽样检查任务空间上传 / 输出下载。
- 抽样检查 Portal session、OPL runtime session、run、artifact、trace、cost ID 是否一致。

### C. 账单链路

- 打开 Portal 账单页。
- 检查 `pricingSource`。
- 下载 run 级 CSV。
- 下载任务级汇总 CSV。
- 核对最近一笔扣费与 ledger。

### D. Secrets

- `powershell -ExecutionPolicy Bypass -File scripts/verify-openbao-eso-local.ps1`
- 检查 ClusterSecretStore / ExternalSecret Ready。
- 检查 probe Secret 解码值。

### E. 备份

- 确认 Portal DB 备份存在。
- 确认 Portal OPL Adapter records 备份存在。
- 确认 MinIO 备份存在。
- 确认 OpenBao 快照存在。
- 抽样执行一次恢复演练。

## 故障时的第一响应

用户反馈“工作台打不开”：
- 查 Portal `/portal/opl` 与 `/portal/api/opl/launch`。
- 查 Portal OPL Adapter `/healthz`。
- 查 launch token 是否创建。
- 查 OPL Web 是否调用 `/api/opl-launch/bootstrap` 并返回当前 session。

用户反馈“跑了没结果”：
- 查 runtime run 状态。
- 查 med-autoscience runner 日志。
- 查任务空间输出区。
- 查 artifact records。

用户反馈“账单不透明”：
- 查账单页 `pricingSource`。
- 查 OpenCost 是否已采集。
- 查最近 ledger entry 与 cost record。
