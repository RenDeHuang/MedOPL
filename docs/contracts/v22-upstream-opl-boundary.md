# v22 Upstream OPL Boundary Contract

本合同定义 MedOPL v22 与 one-person-lab upstream 的边界。

## Upstream

one-person-lab 是 clean upstream：

```text
https://github.com/gaofeng21cn/one-person-lab
```

## Rules

- upstream 目录只读/clean。
- 不修改 upstream 源码。
- 不写 MedOPL 代码进 upstream。
- 不在 upstream 目录写 Portal、Gateway、Adapter 代码。
- 不 import upstream 内部模块。
- 不把 Portal 账号、计费、资源开通、密钥管理或审计逻辑写进 upstream。
- 不把 Portal 账号、计费、资源、gflabtoken、trace、Langfuse、腾讯云逻辑写进 upstream。
- Portal / Gateway / Runtime / Langfuse / 腾讯云逻辑不得写进 upstream。

## Adaptation

upstream 更新后，平台拉取更新，并通过以下公开边界适配：

- OPL Web Gateway
- Portal OPL Adapter
- Runtime Agent
- API/CLI
- 反向代理边界

只能通过 Gateway、Adapter、Runtime Agent、公开 API/CLI 或反向代理边界接入。

## Real Main-Repo Canary Findings

截至 2026-05-10，本地真实 canary 对 `/home/dev/projects/one-person-lab` 主仓验证结果如下：

- `opl web` 真实执行返回 `cli_usage_error`，`retired=true`；主仓当前不提供可启动的本地 Product API Web 进程。
- 主仓当前没有暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` 这类 HTTP Product API endpoint；这些 endpoint 只能通过未来独立 WebUI/Product API provider 或 Gateway/Adapter 映射层接入，不能由 fake Product API smoke 代替真实结论。
- `opl session runtime --acp` 是当前可验证的公开 CLI/ACP 边界；canary 已验证 `initialize`、`session_list`、`session_ledger` 可访问。
- `workspace_list` 虽出现在 ACP command list 中，但隔离 canary 返回 `invalid_payload`；在映射层完成并验证前必须标记为 `capability_not_supported`。
- OPL Web Gateway 配置 `OPL_UPSTREAM_URL` 指向不可用真实 Web 时必须 fail closed，不得回退到旧端口、旧 workbench 或 fake upstream。
- Portal OPL Adapter 可在 `OPL_RUNTIME_MODE=acp`、`OPL_ACP_RUNTIME_DIR=/home/dev/projects/one-person-lab` 下通过真实 ACP runtime 完成 bootstrap 和 session bind，并写回 Adapter state。

上述结论只证明主仓真实 canary 边界；不证明独立 OPL WebUI、真实浏览器交互、真实 provider key 调用或生产部署已完成。

## Real WebUI Canary Findings

截至 2026-05-10，本地真实 WebUI canary 对已构建的 OPL/AionUI WebUI 运行态验证结果如下：

- 真实 WebUI 进程可启动为独立 Web server；`GET /` 返回 One Person Lab Web app HTML，`GET /api/auth/status` 和 `GET /api/auth/user` 可在 `OPL_WEBUI_AUTH_MODE=none` 的隔离 canary 环境返回真实用户上下文。
- WebUI 的 `/api/opl/system`、`/api/opl/sessions`、`/api/opl/messages` 虽然 `GET` 返回 200，但源码与 canary 均证明它们命中通用 `/api` catch-all，只返回 `API endpoint - bridge integration working`；这不是 Product API，必须分类为 `capability_not_supported`，不能被 Gateway/Adapter 当成真实 Product API。
- WebUI 的真实业务协议是 browser WebSocket bridge，而不是 `/api/opl/*` HTTP Product API；canary 已通过 `create-conversation`、`database.get-user-conversations` 和 `database.get-conversation-messages` 验证真实 session 创建和数据库回读。
- OPL Web Gateway 指向真实 WebUI 后可代理 HTML、注入 launch script、拒绝 secret query，并可代理 WebSocket bridge 完成 session 创建和数据库回读。
- Portal OPL Adapter 在 `OPL_RUNTIME_MODE=webui` 下可通过 WebSocket bridge 创建真实 WebUI conversation，并把 session 创建和 database 回读投影到 MedOPL bootstrap/state；该映射属于 Gateway/Adapter anti-corruption layer，不修改 WebUI/upstream 源码。
- 2026-05-10 discovery 阶段只证明 `chat.send.message` 能进入 WebUI WebSocket bridge 并触发后端 agent 启动路径；当时未配置可用 provider/agent 登录，必须标记为 `capability_not_supported`。
- 后续授权 provider message live canary 已证明，在用户显式授权 `REAL_OPL_PROVIDER_MESSAGE_CANARY=1`、`OPL_PROVIDER_SECRET_FILE` 和真实 WebUI 来源后，message reply 可按 `mapped_to_webui_bridge` 回流 Portal message status 与 Portal session trace。该事实只证明 message/reply，不证明 HTTP Product API、真实 WebUI file upload、run/artifact、真实云 runtime、生产部署或 Langfuse 已上线。

上述结论只证明真实 WebUI 进程、页面、认证上下文、WebSocket session bridge、Gateway proxy、Adapter session bridge，以及授权 canary 下的 provider message reply 可接通；不证明 HTTP Product API、真实 WebUI 文件上传、run/artifact、真实云 runtime、生产部署或 Langfuse 已上线。

## Local Gateway Proxy

v22 本地最小代理链路必须满足：

- OPL Gateway 通过 `OPL_UPSTREAM_URL` 显式配置 clean upstream one-person-lab Web。
- 不硬编码 v19/v20/v21 upstream 路径，不使用旧 direct upstream path 作为默认值。
- 未配置 `OPL_UPSTREAM_URL` 时，Gateway 返回稳定错误 `opl_upstream_url_required`，不得降级到本地旧端口、旧目录或 legacy route。
- Gateway 只代理 upstream HTML 或健康响应，并注入公开启动上下文。
- 注入/暴露给 upstream 的公开上下文只包含 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL。
- raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query、response、log、localStorage 或 sessionStorage。
- launchToken/runtimeToken/apiKey 不得通过 URL query 传递；Gateway 必须拒绝这类 query。
- Gateway 可以使用 httpOnly cookie 或服务端状态保存 launch context。
- 本地 proxy smoke 只验证合同和本地 fixture，不部署、不调用真实云 API，不修改 upstream。

## Product Entry

用户不能通过 direct upstream path 作为 v22 产品入口。用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight。

MedOPL 有两种进入 OPL Web 的路径：

- 路径 1：从 Portal SaaS 后台进入。
- `portal.medopl.cn -> Portal 工作空间 / 托管运行环境 / “进入 OPL 工作台”按钮 -> Gateway launch / preflight -> clean upstream one-person-lab Web`
- 路径 2：直接访问 OPL 工作台。
- `opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号/密码/gflabtoken API Key preflight -> clean upstream one-person-lab Web`

两条路径最终进入同一套 Gateway / preflight / launch 逻辑。该逻辑必须保持 MedOPL 的 tenant、workspace、runtime availability、resource binding 和 token provider boundary，不绕过 Portal 控制面。

用户可见入口不是 /internal/opl/auth/login。/internal/opl/auth/login 只能是 internal implementation path。
