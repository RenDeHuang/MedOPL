# v22 SaaS Control Plane User Experience Boundary

本合同固定 MedOPL 与 One Person Lab 的产品关系：MedOPL 是 One Person Lab 的 SaaS 控制面和托管交付平台，让 clean upstream OPL 从需要部署、配置和维护的科研工作台，变成开箱即用、可购买、可管理、可计费、可审计、可释放的托管服务。

本合同只定义产品真相和 Portal 用户体验边界，不实现 UI，不修改 `services/*`，不读取 secret，不调用真实云，不修改 upstream，不运行 build/push/kubectl/live-test。后续 Portal UI 改版必须订阅本合同，再由 `v22-portal-workbench-management-ui-composition-boundary.md`、`v22-portal-figma-make-ui-implementation-boundary.md` 和对应 frontend surface gate 承接具体页面、组件、文案和验收。

模型记录：`gpt-5.4`。

## 产品关系

MedOPL 不是独立科研聊天产品，不重做 OPL chatbot，也不是云资源控制台。

MedOPL 的价值是把 One Person Lab SaaS 化：

- 平台创建账号、管理余额和套餐。
- 平台提供计算资源、文件空间和工作空间生命周期。
- 平台负责开通、隔离、计费、审计、释放和停止计费。
- 平台通过 Gateway、Runtime Bridge 和 Runtime Agent 把 Portal 上下文安全带入 OPL。
- 平台把 OPL session、run、artifact、trace、账单和审计状态回流到 Portal。

用户购买的是托管 OPL 科研工作台服务，不是 CVM、COS、K8s、TKE、节点池或云资源控制台权限。

## Portal 用户体验真相

Portal 是 OPL 的 SaaS 控制面。它必须让用户知道自己买的是什么东西、接受的是什么服务，以及这个服务当前是否可用。

Portal 必须帮助用户回答：

- 我买的是什么服务？
- 我的 OPL 工作台现在能不能用？
- 如果不能用，还缺哪一步？
- 下一步应该点哪里？
- 我的文件、任务、结果在哪里？
- 我的余额、预扣费、冻结金额、停止计费状态是否正常？
- 我什么时候应该释放计算资源但保留文件空间？

这些问题是 Portal 工作台首页、空状态、操作按钮、导航、结果回流和账单摘要的上游产品真相。Portal 不回答科研问题，不复制 OPL 的 chatbot，不把科研执行体验搬到 Portal。

## 职责边界

### Portal 负责

Portal 负责准备、管理、进入、回流、计费、审计和释放，包括：

- 账号和登录态。
- 套餐、余额、预扣费和冻结金额。
- 计算资源、文件空间和工作空间状态。
- gflabtoken 模型调用密钥绑定状态和 OPL preflight 入口。
- 进入 OPL 工作台。
- OPL session、run、artifact、trace 的回流展示。
- 账单、审计、释放和停止计费状态。

### OPL 负责

OPL 负责科研执行，包括：

- chatbot。
- agent。
- 科研任务执行。
- 文件理解。
- 结果生成。
- 工作台内交互体验。

### Gateway / Runtime Bridge / Runtime Agent 负责

- 统一入口、preflight、launch 和上下文注入。
- providerKeyRef、workspace、resource binding、file/run/artifact/trace 的安全投影。
- no-fake-success gate。
- 不把 raw API key、launchToken、runtimeToken、bearer token、objectKey、localPath 或 signedUrl 写入 URL、浏览器持久化状态、日志、evidence 或 git。

## Portal 不得做

- 重做 OPL chatbot。
- 成为云资源控制台。
- 要求普通用户理解 CVM/COS/K8s/TKE。
- 把 raw API key、launchToken、runtimeToken、bearer token 写入浏览器持久化状态、日志、evidence 或 git。

## 验收方式

本合同的本地验收入口是：

```bash
node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs
```

该 smoke 只读取 repo-tracked 文档，不读取 secret，不调用真实云，不执行 build/push/kubectl/live-test，不修改 upstream。

## Contract Data

<!-- v22-saas-control-plane-user-experience-contract:start -->
```json
{
  "contract": "v22_saas_control_plane_user_experience_boundary",
  "version": 1,
  "model": "gpt-5.4",
  "scope": {
    "portalIsSaasControlPlane": true,
    "portalReimplementsOplChatbot": false,
    "portalIsCloudConsole": false,
    "modifiesServices": false,
    "callsRealCloud": false,
    "readsSecrets": false,
    "modifiesUpstream": false
  },
  "userQuestions": [
    "我买的是什么服务？",
    "我的 OPL 工作台现在能不能用？",
    "如果不能用，还缺哪一步？",
    "下一步应该点哪里？",
    "我的文件、任务、结果在哪里？",
    "我的余额、预扣费、冻结金额、停止计费状态是否正常？",
    "我什么时候应该释放计算资源但保留文件空间？"
  ],
  "portalResponsibilities": [
    "账号和登录态",
    "套餐、余额、预扣费和冻结金额",
    "计算资源、文件空间和工作空间状态",
    "gflabtoken 模型调用密钥绑定状态和 OPL preflight 入口",
    "进入 OPL 工作台",
    "OPL session、run、artifact、trace 的回流展示",
    "账单、审计、释放和停止计费状态"
  ],
  "oplResponsibilities": [
    "chatbot",
    "agent",
    "科研任务执行",
    "文件理解",
    "结果生成",
    "工作台内交互体验"
  ],
  "portalMustNot": [
    "重做 OPL chatbot",
    "成为云资源控制台",
    "要求普通用户理解 CVM/COS/K8s/TKE",
    "把 raw API key、launchToken、runtimeToken、bearer token 写入浏览器持久化状态、日志、evidence 或 git"
  ],
  "downstreamImplementationContract": "v22-portal-workbench-management-ui-composition-boundary.md",
  "currentUiImplementationSource": "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md",
  "smoke": "tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs"
}
```
<!-- v22-saas-control-plane-user-experience-contract:end -->
