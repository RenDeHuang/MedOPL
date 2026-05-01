# 2026-05-01 Portal Postgres/Redis Restart Recovery Evidence

## 状态

- status: `PASSED`
- branch: `codex/opl-v19`
- step: `Step 6`
- model: `gpt-5.4`

## 结论

Step 6 已在 live `portal-opl` v19 单服务上云后通过。

本轮只滚动 `portal-opl` 单个 Deployment，用于关闭 Portal PostgreSQL/Redis restart recovery gate；没有滚整套 v19。当前 live Portal 为：

- image: `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v19-portal-recovery-20260501-79051d7`
- digest: `sha256:3e073ce1e950e263b099bbebb5bbeb68ab3bdb6a944b83e79cc6eb671f54abb9`
- build.sha: `79051d7+v19-portal-recovery`
- build.time: `2026-05-01T06:26:52Z`
- storageMode: `postgres_redis`
- identitySyncMode: `local`

重启前后真实 fixture 状态一致，`comparison.matched=true`，`differences=[]`。

## 为什么可以算 Step 6 通过

本次不是只看 `/healthz`，而是用正式 Portal/admin 与 Portal/api 接口自举真实 `test-*` fixture，然后重启 live `portal-opl`，再复查关键状态。

已验证对象：

- 用户：`test-test-v19-momjzcpx-abbc19@example.test`
- workspace: `test-v19-momjzcpx-abbc19`
- resource order: `4ceda008-f4df-48cd-bb60-21397a3aa5c9`
- workspace file: `fixtures/test-v19-momjzcpx-abbc19/input.txt`
- trace session: `ed99242d-5c79-484d-810c-2f7d3a2959d5`
- workspace session: `77abfd87-25bc-4fc9-bcf5-6a37c1a464cc`

重启前后保持一致的状态：

- user id/email/name/role/status
- wallet balance、active freeze、trial remaining
- frozen resource order、server plan、quote/freeze amount
- workspace file metadata、storage key、size、checksum
- trace/session identity 和 business status
- portal session 仍可用
- workspace session 仍 active

## 本轮云上动作

1. 构建并推送 Portal v19 recovery 镜像。
2. 将 `deployment/portal-opl` 镜像从 `opl-v18` 切到 `opl-v19-portal-recovery-20260501-79051d7`。
3. 更新非敏感 env：`BUILD_SHA=79051d7+v19-portal-recovery`、`BUILD_TIME=2026-05-01T06:26:52Z`。
4. 用正式接口创建 test fixture。
5. 由 recovery gate 发起一次 `portal-opl` rollout restart。
6. 等待新 Pod ready 后复查状态一致性。

rollback 镜像：`uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v18`。

## 关键云上结果

重启前：

- deployment generation: `43`
- pod: `portal-opl-58f546895b-nsqwp`
- image: `portal-opl:opl-v19-portal-recovery-20260501-79051d7`
- ready: `1/1`

重启后：

- deployment generation: `44`
- pod: `portal-opl-5ffc9849bd-nghmh`
- ready: `1/1`
- restartCount: `0`

Secret 引用只记录名称，不记录值：

- `portal-postgres-redis`
- `secret-portal`
- `secret-opl`
- `secret-trace`
- `langfuse-client-keys`

## 本轮修复

- `scripts/live-test-v19-postgres-redis-restart-recovery.mjs`
  - 支持 `PORTAL_RECOVERY_FIXTURE_FILE` 读取 fixture 和 password file。
  - 支持无 `kubectl` 时走 Kubernetes HTTPS API fallback。
  - 支持 `PORTAL_RECOVERY_KUBECONFIG` 和 `PORTAL_RECOVERY_KUBE_SERVER_OVERRIDE`。
  - 输出 `/healthz` build/storage/identity 摘要。

- `scripts/live-prepare-v19-portal-recovery-fixture.mjs`
  - storage order 创建后立即断言 entitlement enabled。
  - 额外读取 `/portal/api/storage/entitlement`，避免订单未生效时继续伪造文件上传。

- `.dockerignore`
  - 排除 `.runtime`、`.git`、`node_modules`、`dist` 等本地构建产物。
  - 修复 Portal Docker build context 包含本地 `node_modules` 后出现 `invalid file request` 的问题。

- `scripts/smoke-test-root-dockerignore.mjs`
  - 锁定根目录 `.dockerignore` 必须排除 `node_modules`、`.runtime`、`.git`。

## 验证命令

```bash
npm --prefix services/portal run check
npm --prefix services/portal/frontend run build
node --check scripts/live-prepare-v19-portal-recovery-fixture.mjs
node --check scripts/live-test-v19-postgres-redis-restart-recovery.mjs
node scripts/smoke-test-v19-portal-recovery-fixture-prepare.mjs
node scripts/smoke-test-root-dockerignore.mjs
```

镜像验证：

```bash
docker run --rm uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v19-portal-recovery-20260501-79051d7 node --check src/server.mjs
docker run --rm uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v19-portal-recovery-20260501-79051d7 node -e "require('pg'); require('redis'); console.log('portal deps ok')"
```

live gate：

```bash
RUN_PORTAL_RECOVERY_LIVE=1 \
PORTAL_RECOVERY_FIXTURE_FILE=.runtime/portal/live-recovery-fixtures/test-v19-momjzcpx-abbc19.json \
PORTAL_RECOVERY_EXPECT_POST_RESTART=1 \
PORTAL_RECOVERY_ALLOW_KUBECTL_RESTART=1 \
PORTAL_RECOVERY_KUBECTL_BIN=/mnt/c/DockerDesktopBin/kubectl.exe \
PORTAL_RECOVERY_KUBECONFIG='C:\Users\Administrator\Downloads\cls-ngiq693i-config (1)' \
PORTAL_RECOVERY_KUBE_SERVER_OVERRIDE='https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443' \
node scripts/live-test-v19-postgres-redis-restart-recovery.mjs
```

结果摘要：

```json
{
  "ok": true,
  "gate": "portal_postgres_redis_restart_recovery",
  "portalHealth": {
    "build": {
      "sha": "79051d7+v19-portal-recovery",
      "time": "2026-05-01T06:26:52Z"
    },
    "storage": {
      "storageMode": "postgres_redis"
    }
  },
  "comparison": {
    "matched": true,
    "differences": []
  }
}
```

## 仍然不是整套 v19 完成

Step 6 已通过，但 v19 仍不能宣称正式完成，因为 Step 5 和 Step 7 还没有关闭：

- Step 5 仍在等待带完整 v19 标签的腾讯云账单 zip。
- Step 7 full user E2E 还缺资源创建、OPL 消息、artifact/trace/download/delete、T+1 exact bill 的同一用户闭环。
