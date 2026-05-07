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
