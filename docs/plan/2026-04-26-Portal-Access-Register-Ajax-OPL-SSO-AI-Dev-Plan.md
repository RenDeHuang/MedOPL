# Portal 权限、注册、无刷新与 OPL SSO 开发方案

## 为什么要做

Portal 是 SaaS 控制面，OPL Web 是工作台，OPL runtime 是执行面。三者必须通过明确合同连接，不能把一个模块的问题扩散到另一个模块。

当前问题集中在四个边界：

1. 身份权限边界不清：普通用户能看到管理后台入口，前端展示和后端权限没有形成一致合同。
2. 用户管理交互太重：用户管理页仍用原生 form POST，导致页面刷新、滚动到顶部、上下文丢失。
3. 注册入口缺失：后端有 allowRegistration 设置，但登录页没有给本地身份模式提供注册入口。
4. OPL 入口认知不清：Portal 本地账号不能直接登录原生 OPL URL。正确入口应是 Portal 或 OPL gateway 的 Portal SSO/launch 合同。

顶层原则：模块内高聚合，模块间低耦合。

- 身份权限模块只负责当前用户、注册、登录、角色。
- 用户管理模块只负责 admin 用户列表和账户动作。
- Trace 模块只负责 trace 查询，普通用户只能按自身 userId 查询。
- OPL 接入模块只负责 launch/bootstrap/session bind，不读取 Portal 内部 DB。

## 要修改什么

### 1. 身份权限模块

文件：

- `services/portal/src/server.mjs`
- `services/portal/frontend/src/api/portal.ts`
- `services/portal/frontend/src/router/index.ts`
- `services/portal/frontend/src/layouts/AppSidebar.vue`

做法：

- `/portal/api/me` 保持为前端唯一身份源。
- 前端路由增加 `requiresAdmin` meta，进入 `/admin/*` 前检查当前用户 role。
- Sidebar 只在 role 为 admin 时渲染管理后台。
- 普通用户访问 admin SPA 路由时跳回 `/overview`。
- `/portal/api/traces` 对普通用户强制使用当前 userId。

交付标准：

- 普通用户看不到管理后台导航。
- 普通用户直接访问 `/portal/app/admin/users` 会回到 `/portal/app/overview`。
- 普通用户 `/portal/api/traces?userId=other` 不能看到别人的 trace。

### 2. 注册模块

文件：

- `services/portal/src/server.mjs`
- `scripts/smoke-test-portal-local-login.mjs`
- `scripts/smoke-test-portal-access-register.mjs`

做法：

- 本地身份模式 `PORTAL_OIDC_ENABLED=0` 时，`GET /login` 显示“注册账号”入口。
- `GET /register` 显示注册表单。
- `POST /register` 在 `allowRegistration=true` 时创建普通用户、钱包和默认 workspace。
- 自助注册和管理员开通账号共用同一个 Portal 用户创建函数，邮箱归一化、重复检查、密码长度、默认钱包和默认 workspace 只维护一份。
- `allowRegistration=false` 时拒绝注册。
- OIDC 模式保留统一身份登录，不在 Portal 本地注册。

交付标准：

- 登录页可见注册入口。
- 注册成功后可用新账号登录。
- 关闭注册后，注册接口返回拒绝。

### 3. 用户管理模块

文件：

- `services/portal/frontend/src/views/admin/AdminUsersView.vue`
- `services/portal/frontend/src/api/portal.ts`

做法：

- 把开通账号、注册设置、禁用/恢复、编辑、充值、退款、删除改成 `fetch/axios` 提交。
- 表单使用 `@submit.prevent`，操作成功后只刷新当前列表数据，不整页 reload。
- 列表主标识改为邮箱和名称；UUID 改为弱化的“内部ID”，用于复制/排障，不作为主视觉。
- 有旧 payload 时刷新不显示整页“正在加载”，只显示小型刷新状态。

交付标准：

- 用户管理任何按钮操作不触发页面导航。
- 操作后 URL 和滚动位置保持。
- 新用户出现在列表/API 中。
- UUID 不再压过邮箱展示。

### 4. OPL Gateway SSO 模块

文件：

- `services/opl-web-gateway/src/server.mjs`
- `scripts/smoke-test-opl-web-gateway-launch.mjs`
- `scripts/smoke-test-opl-web-gateway-direct-entry.mjs`

做法：

- 继续支持 Portal launch token。
- 增加 gateway 直达入口的说明或自动引导：没有 launch cookie 时，不假装 OPL 原生登录能识别 Portal 账号。
- 若网关收到有效 `portal_session` 且配置了 Portal base URL，可换取 launch 或提示从 Portal 打开工作台。

交付标准：

- 从 Portal 进入 OPL Web 仍成功。
- 直接打开 OPL gateway 不会进入错误的原生登录认知。
- `/api/auth/user` 在没有 launch cookie 时返回明确未登录状态，不制造 502。

## 如何实现

用 worktree 并行：

- `codex/portal-identity-access-wt`：身份、注册、权限 guard。
- `codex/portal-users-ajax-wt`：用户管理无刷新和 UUID 展示。
- `codex/opl-gateway-sso-wt`：OPL gateway 直达入口和 auth/user 合同。

汇总到 `codex/opl-v1-hard-loop` 后统一测试、构建镜像并推送。

## 测试标准

必须通过：

- `node --check services/portal/src/server.mjs`
- `npm --prefix services/portal/frontend run build`
- `node scripts/smoke-test-portal-local-login.mjs`
- 注册 smoke：登录页有注册入口，注册用户能登录。
- 普通用户 smoke：无管理后台入口，不能访问 admin API/页面。
- 用户管理 smoke：开通账号无页面刷新，新用户可登录。
- `node scripts/smoke-test-portal-access-register.mjs`
- `node scripts/smoke-test-portal-spa-access.mjs`
- `node scripts/smoke-test-portal-opl-web-launch.mjs`
- `node scripts/smoke-test-opl-web-gateway-launch.mjs`
- `node scripts/smoke-test-opl-web-gateway-direct-entry.mjs`

## 镜像交付

预计至少更新：

- `uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v4`

如果 OPL gateway 合同代码改动，则同时更新：

- `uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v2`
