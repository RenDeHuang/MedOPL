# OPL v21 Phase 2-9 本地验收报告

日期：2026-05-06

## 文档状态

这是历史本地验收记录 / 非当前推进主线。它证明 Phase 2-9 的本地合同和本地 smoke 在当时通过，不能等同于真实 cloud full-loop、生产完成、live-test 通过或真实云资源已闭环。

## 结论

v21 Phase 2 到 Phase 9 的本地产品主线闭环已完成并通过本地合同测试：

- 平台代开通的客户专属计算 / 存储 / workspace binding 模型已落地。
- Lite 模式不要求 runtime 与存储，可通过 gflabtoken/API-only 问答。
- Full Runtime 模式要求 active `WorkspaceResourceBinding` 和 weekly protection freeze。
- Full Runtime 消息、文件上传、文件任务、输出下载、session raw ledger、本地账单投影已通过端到端 smoke。
- one-person-lab upstream 保持 clean，当前 HEAD 为 `00de17e529047a31f0658be384d09f4f3e5fd9c7`。
- `scripts/update-one-person-lab-upstream.mjs --check-only` 已验证 upstream clean、ACP contract、OPL Web Gateway smoke、v21 boundary check 和 build/push dry-run。
- Sentrux 防退化 gate 通过：`Quality 6589 -> 6597`，无 cycles，无 god files，无退化。

## 本地已验证

核心命令：

```bash
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/update-one-person-lab-upstream.mjs --check-only
node scripts/smoke-test-opl-acp-runtime-adapter.mjs
node scripts/smoke-test-opl-web-gateway-launch.mjs
node scripts/check-v21-user-owned-runtime-boundaries.mjs
node scripts/smoke-test-v21-end-to-end-user-owned-closure.mjs
```

全量 v21 smoke：

```bash
set -euo pipefail
for f in $(rg --files scripts -g 'smoke-test-v21-*.mjs' | sort); do
  node "$f"
done
```

服务检查：

```bash
npm --prefix services/portal run check
npm --prefix services/portal/frontend run typecheck
npm --prefix services/opl-runtime-bridge run check
npm --prefix adapters/billing-aggregator run check
node --check services/opl-web-gateway/src/server.mjs
git diff --check
```

结构检查：

```bash
sentrux gate .
sentrux check .
```

`sentrux gate .` 通过。`sentrux check .` 仍有存量绝对阈值债务：

```text
min_quality: 0.66 < 0.69
min_modularity: 0.6140 < 0.8000
min_redundancy: 0.6266 < 0.6500
```

这些不属于本轮退化，仍应作为后续结构治理目标保留。

## Phase 覆盖

### Phase 2

已完成平台托管的客户专属资源模型；下列历史实体名仅为兼容命名，不代表用户自带资源：

- `UserComputeInstance`
- `UserStorageBucket`
- `WorkspaceResourceBinding`
- 兼容资源 API
- Portal 资源开通页
- Lite 模式不要求 binding

验证：

```bash
node scripts/smoke-test-v21-user-owned-resource-binding.mjs
node scripts/smoke-test-v21-user-owned-resource-postgres-contract.mjs
node scripts/smoke-test-v21-user-owned-resource-ui-contract.mjs
```

### Phase 3

已完成周预冻结和本地账单归因：

- `WeeklyProtectionFreeze`
- active binding 下的冻结、消耗、释放
- 120min 核对状态投影
- T+1 审计状态投影
- Lite provider usage 不触发专属计算/存储保护金

验证：

```bash
node scripts/smoke-test-v21-weekly-protection-freeze.mjs
node scripts/smoke-test-v21-billing-user-owned-runtime-contract.mjs
```

### Phase 4

已完成 Runtime Agent relay 合同：

- Full Runtime 签发短期 runtime token。
- API-only 不签发 runtime token。
- Full Runtime message/run 发送到用户绑定 Runtime Agent。
- 默认路径不调用 K8s runner。

验证：

```bash
node scripts/smoke-test-v21-runtime-agent-contract.mjs
node scripts/smoke-test-v21-opl-adapter-lite-full-contract.mjs
```

### Phase 5

已完成用户存储隔离合同：

- user/workspace/session scoped storage key
- transfer token
- Full Runtime upload/download owner scope 校验
- Portal workspace 文件索引

验证：

```bash
node scripts/smoke-test-v21-user-storage-isolation.mjs
node scripts/smoke-test-workspace-storage-routes-contract.mjs
```

### Phase 6

已完成 OPL launch token、message、ledger 合同：

- Portal entry 与 direct OPL login 的统一 launch token scope。
- API-only 与 Full Runtime message idempotency scope 分离。
- `SessionRawLedger`。
- message stream / cancel。
- run cancel 仅限 Full Runtime。

验证：

```bash
node scripts/smoke-test-v21-opl-entry-unified-contract.mjs
node scripts/smoke-test-v21-opl-launch-token-scope.mjs
node scripts/smoke-test-v21-session-raw-ledger.mjs
node scripts/smoke-test-v21-opl-stream-cancel-ledger-contract.mjs
```

### Phase 7

已完成 OPL 登录页 gflabtoken 输入合同：

- Gateway 注入登录增强脚本。
- 密码下方新增 `gflabtoken API Key` 输入。
- 文案写明模型服务来源。
- Adapter 写 provider secret，不写 upstream。

验证：

```bash
node scripts/smoke-test-v21-gflabtoken-login-contract.mjs
```

### Phase 8

已完成 one-person-lab 一键更新检查合同：

- upstream clean check。
- `--check-only`。
- ACP contract gate。
- OPL Web Gateway smoke。
- platform-provisioned runtime boundary check。
- build/push dry-run。
- upstream 保持不修改。

验证：

```bash
node scripts/check-one-person-lab-upstream-clean.mjs
node scripts/update-one-person-lab-upstream.mjs --check-only
node scripts/smoke-test-v21-one-person-lab-current-upstream-package-contract.mjs
node scripts/smoke-test-v21-one-person-lab-upstream-update-contract.mjs
```

### Phase 9

已完成本地端到端闭环 smoke：

- 创建用户。
- 用户充值。
- Portal launch OPL。
- Direct OPL login。
- API-only 问答。
- Portal 账单投影。
- 平台代开客户专属计算和存储。
- workspace binding。
- weekly protection freeze。
- Full Runtime launch。
- 上传输入文件。
- Runtime Agent message。
- Runtime Agent file run。
- 记录输出文件。
- 下载输出文件。
- session raw ledger。
- 删除存储并释放保护金、停止计费。

验证：

```bash
node scripts/smoke-test-v21-end-to-end-user-owned-closure.mjs
```

## 本轮结构修正

为通过 Sentrux 防退化 gate，已做函数级拆分：

- `services/portal/src/routes/workspace-storage.routes.mjs` 改为薄入口。
- 新增 `services/portal/src/routes/workspace-storage-route-handlers.mjs`，聚合 workspace storage route handlers。
- `services/portal/src/services/opl-launch.service.mjs` 拆出 launch 状态机和 orchestration helper，factory 只做依赖注入。
- `services/opl-runtime-bridge/src/state-store.mjs` 拆出 session ledger scope、sequence、payload hash builder。
- 修正两个 v21 边界测试 fixture，使它们与当前 `check-v21-user-owned-runtime-boundaries.mjs` 的输出结构一致。

## 云侧 live gate

以下未在本地完成，必须在云侧环境验收：

- 真实 `portal.medopl.cn` / `opl.medopl.cn` 双入口登录。
- 平台代开通的客户专属计算资源上 Runtime Agent 安装、注册、断连恢复和版本升级。
- 真实用户存储的 COS/S3 scoped credential、桶策略、上传、下载和审计。
- 真实 120min 账单核对执行器。
- 真实 T+1 审计执行器。
- 真实镜像 build/push、云侧 rollout、健康检查和回滚。

本地交付边界：代码和合同层面已完成 v21 主线闭环；云侧交付必须另跑 live gate，不应把本地 smoke 等同于生产上线完成。
