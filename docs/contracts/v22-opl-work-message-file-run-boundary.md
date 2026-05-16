# v22 OPL Work Message File Run Boundary Contract

本合同定义 MedOPL v22 MVP 闭环第三段：用户进入 OPL 科研工作台，发送信息、上传文件、用文件跑任务，并下载输出文件。

## Product Boundary

用户主叙事必须是：

- 用户进入 OPL 科研工作台。
- 用户发送信息。
- 用户上传文件。
- 用户用文件跑任务。
- 用户下载输出文件。

不得把 CVM、COS、K8s、TKE 或云资源控制台作为用户主语言。

## Upstream Boundary

OPL Web 来自 clean upstream one-person-lab：

```text
https://github.com/gaofeng21cn/one-person-lab
```

平台边界：

- `sourceModified=false`。
- 不修改 upstream 源码。
- 不 import upstream 内部模块。
- 不在 upstream 目录写 Portal、Gateway、Runtime Bridge 或 Runtime Agent 代码。
- 通过 OPL Web Gateway / Runtime Bridge / Runtime Agent 合同边界接入。

## Preconditions

- OPL run 必须先检查 provider readiness。
- 未绑定 gflabtoken provider key 时，run 必须返回 `provider_key_required`。
- OPL run 必须要求已开通托管运行环境，并存在 active `resourceBinding`。
- 未开通托管运行环境时，run 必须返回 `managed_environment_required`。
- 运行合同只使用 `providerKeyRef`，不得泄露 raw API key。
- 不读取 `/home/dev/.secrets/medopl/secrets.env.txt`。
- 不调用真实云 API。
- 不运行 build/push/kubectl/live-test。

## Work Flow

1. 用户从 `opl.medopl.cn` 进入 OPL 科研工作台；session 创建请求必须显式包含 `entrypoint=opl.medopl.cn`。
2. 平台创建 OPL session contract，绑定 workspace、tenant、user、`resourceBinding` 和 `providerKeyRef`。
3. 用户上传文件后，平台生成 workspace file reference。
4. 用户用 workspace file reference 发起 run contract。
5. Runtime Agent 合同生成 artifact reference / output file reference。
6. 用户下载输出时，API 只返回文件引用，不返回内部 storage key、local path、signed URL 或存储密钥。

## Trace Metadata

MVP trace metadata 只允许包含：

- `sessionId`
- `workspaceId`
- `resourceBindingId`
- `providerKeyRef`
- artifact reference 列表
- timestamps

trace metadata 不得包含 raw prompt、raw API key、`launchToken` 或 `runtimeToken`。Langfuse 只能作为后续 trace metadata 来源，不进入 MVP 主产品叙事。

## Public References

- workspace file reference 是用户上传文件的公开引用，不等于 COS key 或本地路径。
- artifact reference 是输出文件的公开引用，不等于 COS key 或本地路径。
- download response 只能返回 output file reference 和必要的 workspace/resourceBinding 引用。

## Non-goals

- 不改 frontend。
- 不修改 one-person-lab upstream。
- 不调用真实云 API。
- 不读取 secrets。
- 不运行 build/push/kubectl/live-test。
- 不改 deploy、`.sentrux` 或 `adapters`。
