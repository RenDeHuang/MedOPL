# Portal -> OPL Gateway Launch Identity 开发文档 v1

## 背景

One Person Lab 不能用 Portal 账号直接登录。Portal 和 OPL Web 当前不是同一个身份系统：Portal 有自己的用户表、登录态和密码 hash；OPL 原生 Web 不读取 Portal 用户表，也不知道 Portal 密码 hash。当前正确链路是：

```text
Portal 登录
  -> Portal 生成短期 launch token
  -> 浏览器打开 OPL Web Gateway
  -> Gateway 校验 launch token 并绑定 Portal 用户、workspace、workspace session、runtime session
  -> OPL Web 只消费 Gateway 注入的 Portal launch 上下文
```

不允许的链路是：

```text
Portal 邮箱/密码 -> OPL 原生登录页 -> OPL 原生身份系统
```

顶层原则：

- 高聚合在模块内：Portal 负责 Portal 身份、策略、workspace 和 launch 签发；Gateway 负责浏览器接入、同源代理和 OPL Web 身份投影；adapter 负责 launch token 验签、bootstrap、session bind、run/artifact 回调；OPL Web 负责工作台体验。
- 低耦合在模块间：模块之间只通过短期 launch token、bootstrap JSON、session bind JSON 和 run/artifact API 通信；不共享密码 hash，不共享数据库表，不让 OPL Web 反查 Portal 用户表。

## 需要做什么

1. Portal 保持唯一登录入口。
   - 用户先登录 Portal。
   - Portal 在 `/portal/opl` 或 `/portal/api/opl/launch` 上根据用户策略、余额、workspace 状态生成 launch。
   - Portal 只把用户身份投影到 launch payload，不把密码或 password hash 传给 OPL。

2. adapter 保持 launch token 的后端权威。
   - `/api/opl-launch/tokens` 创建 workspace、workspace session、runtime session，并签发 15 分钟有效的 launch token。
   - `/api/opl-launch/bootstrap` 只接受有效 launch token。
   - `/api/opl-launch/sessions/bind` 由 OPL Web Gateway 在浏览器启动后绑定 OPL session。
   - `/api/opl-launch/runs`、status、artifacts 都必须通过 launch 上下文找到 runtime session。

3. OPL Web Gateway 保持浏览器接入层。
   - Ingress 的 OPL 域名只指向 `opl-web-gateway`，不能直接暴露 `opl-web-upstream`。
   - Gateway 拦截 `/api/auth/user`：无 launch cookie 返回 401；有 launch cookie 时从 adapter bootstrap 映射 Portal 用户。
   - Gateway 注入 `/portal-launch.js`，把 `/portal-adapter` 作为同源 adapter 代理暴露给 OPL Web。
   - Gateway 初始化成功后清除浏览器 URL 中的 `launch_token`，只保留 HttpOnly launch cookie 和 sessionStorage 中的运行期上下文。

4. OPL Web 保持非身份源。
   - `OPL_WEBUI_AUTH_MODE=none`。
   - OPL Web 不能校验 Portal 邮箱密码。
   - OPL Web 不能依赖 Portal DB、Portal Redis 或 Portal password hash。
   - OPL Web 只能通过 Gateway 注入的 `window.__OPL_PORTAL__` 和同源 `/portal-adapter` 回调进入 Portal 控制面。

5. 腾讯云 TKE/TCR 交付保持拆分镜像。
   - `portal`
   - `portal-opl-adapter`
   - `opl-web-gateway`
   - `opl-web-upstream`
   - `billing-aggregator`
   - `med-autoscience-runner-orchestrator`
   - `med-autoscience-runner`

## 怎么做

### 并行 worktree 推进

推荐按三个互不冲突的 worktree lane 推进，再汇总到 `codex/opl-v1`：

1. `opl-gateway-sso`：只改 Gateway 和 Gateway smoke。
   - 文件：`services/opl-web-gateway/src/server.mjs`
   - 文件：`scripts/smoke-test-opl-web-gateway-launch.mjs`
   - 文件：`scripts/smoke-test-opl-web-gateway-direct-entry.mjs`

2. `portal-identity-access`：只改 Portal 登录、权限、OPL launch 入口。
   - 文件：`services/portal/src/server.mjs`
   - 文件：`services/portal/src/routes/opl.routes.mjs`
   - 文件：`services/portal/src/services/opl-launch.service.mjs`
   - 文件：`services/portal/frontend/src/**`
   - 文件：`scripts/smoke-test-portal-*.mjs`

3. `opl-web-deploy`：只改 TKE/TCR 配置和部署验证。
   - 文件：`deploy/tke-package/**`
   - 文件：`deploy/tke-package/scripts/build-and-push-tcr.ps1`
   - 文件：`deploy/tke-package/scripts/verify-tke-smoke.ps1`

汇总顺序：

```powershell
git -C .runtime\worktrees\opl-v1 merge --no-ff codex/opl-gateway-sso-wt
git -C .runtime\worktrees\opl-v1 merge --no-ff codex/portal-identity-access-wt
git -C .runtime\worktrees\opl-v1 merge --no-ff codex/opl-web-deploy-wt
git -C .runtime\worktrees\opl-v1 merge --no-ff codex/opl-v1-hard-loop
```

如果某些 lane 已经被 `codex/opl-v1-hard-loop` 吸收，则以 `codex/opl-v1-hard-loop` 为最终汇总源，避免重复 cherry-pick。

### 腾讯云镜像推送

在 `deploy/tke-package` 下执行：

```powershell
$env:TCR_PASSWORD="<TCR 访问密码>"
.\scripts\build-and-push-tcr.ps1 `
  -RegistryNamespace "uswccr.ccs.tencentyun.com/gaofenglab" `
  -Username "100047070895" `
  -Tag "opl-v1"
```

如果本轮只更新 Portal 和 Gateway，可以用已验证 tag：

```text
uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v4
uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v2
```

部署前必须渲染 manifest：

```powershell
Copy-Item .\env\tke.env.tcr-gaofenglab.example .\env\tke.env
.\scripts\render-tke-manifests.ps1 -EnvFile .\env\tke.env -TemplateDir .\manifests -OutDir .\rendered
```

然后应用到 TKE：

```powershell
kubectl apply -f .\rendered
kubectl -n portal-staging rollout status deploy/portal
kubectl -n portal-staging rollout status deploy/portal-opl-adapter
kubectl -n portal-staging rollout status deploy/opl-web-upstream
kubectl -n portal-staging rollout status deploy/opl-web-gateway
```

## 交付标准

1. Portal 入口标准。
   - 未登录 Portal 不能创建 launch。
   - 余额、分组策略、workspace 状态不满足时不能创建 launch。
   - `/portal/opl` 只能 302 到带 launch token 的 Gateway URL。

2. Gateway 身份标准。
   - 直开 OPL Gateway 时 `/api/auth/user` 返回 401 和 `portalLaunchRequired=true`。
   - 带 launch cookie 时 `/api/auth/user` 返回 Portal bootstrap 映射用户。
   - upstream OPL Web 的 noauth/admin 用户不能穿透 Gateway 成为浏览器用户。
   - launch 初始化后 URL 中不再保留 `launch_token`。

3. adapter 合同标准。
   - 无效、过期、篡改 launch token 全部返回 401。
   - bootstrap 返回 Portal 用户、workspace、workspace session、runtime session。
   - session bind 必须写入 runtime session 的 OPL session 映射。
   - run/status/artifacts 必须绑定到 launch 所属 runtime session。

4. 部署标准。
   - OPL 域名 Ingress 只指向 `opl-web-gateway`。
   - `opl-web-upstream` 只有集群内 Service，不直接对公网暴露。
   - `OPL_WEBUI_AUTH_MODE=none`。
   - TKE manifest 无未替换占位符。
   - TCR 镜像 digest 可查询，TKE workload 可拉取。

## 测试矩阵

本地必须通过：

```powershell
npm --prefix services/portal run check
npm --prefix services/portal run frontend:typecheck
npm --prefix services/portal run frontend:build
npm --prefix services/opl-runtime-bridge run check
node --check services/opl-web-gateway/src/server.mjs
node scripts/smoke-test-opl-web-gateway-direct-entry.mjs
node scripts/smoke-test-opl-web-gateway-launch.mjs
node scripts/smoke-test-portal-opl-web-launch.mjs
node scripts/smoke-test-portal-opl-web-hard-loop.mjs
```

TKE 部署后必须通过：

```powershell
.\scripts\verify-tke-smoke.ps1 `
  -Namespace portal-staging `
  -PortalHost <portal-domain> `
  -OplHost <opl-domain>
```

线上验收重点：

- `https://<opl-domain>/healthz` 返回 `directEntry.portalLaunchRequired=true`。
- `https://<opl-domain>/api/auth/user` 在无 launch cookie 时返回 401。
- 从 Portal 点击 OPL 后进入的是 `https://<opl-domain>/?launch_token=...`，随后 URL 被 Gateway 清理。
- OPL Web 内部看到的用户 id/email/name 来自 Portal bootstrap。
- 不能用 Portal 邮箱密码在 OPL 原生登录页建立 OPL 原生身份会话。

## 不做的事情

- 不同步 Portal 密码 hash 到 OPL。
- 不让 OPL Web 读取 Portal 用户表。
- 不把 Portal 邮箱密码转发给 OPL 原生登录接口。
- 不新增一个跨模块共享用户数据库。
- 不用“失败后猜测用户身份”的兜底逻辑。
