# 历史参考文档，不是 v22 active 合同或当前实现入口；不得作为当前主线、smoke、接云或部署依据。

# OPL v21 Agent Coordination Runbook

日期：2026-05-07

## 目的

本文用于协调多个 Codex 窗口同时整理 `platform-v21`。目标不是加速乱改，而是在不破坏 v21 产品方向的前提下，让一个主执行窗口和多个只读侦察窗口并行工作。

v21 产品北极星：

```text
MedOPL v21 是 platform-provisioned / customer-dedicated 的 OPL SaaS 托管科研工作台。
用户购买套餐、计算能力、存储容量和运行环境。
平台负责开通、隔离、计费、审计和释放。
用户不自带 CVM/COS/K8s，也不配置云资源。
```

## 全局硬边界

所有窗口必须先读取根目录 `README.md` 与 `AGENTS.md`，并遵守以下规则：

- `user_owned` 只能作为 legacy alias；主产品语义必须是 `platform_provisioned` / `customer_dedicated`。
- upstream OPL 必须保持 clean；只能通过 Gateway、Adapter、Runtime Agent、API/CLI 等公开边界适配，不能修改 upstream 源码。
- raw provider API key 只能进入后端密钥边界；前端最多持有 `providerKeyRef`、bound status 和一次性输入态。
- bearer token、launchToken、runtimeToken 不能进入 sessionStorage/localStorage、全局 JS state、日志、evidence 或 git。
- build/push、kubectl、live-test、真实云资源操作和 `.sentrux/*` 修改必须单独授权。
- 禁止 `git add -A`。
- 每个提交只能有一个主题，且必须能说明：改了什么、为什么、如何验证、如何回滚。

## 窗口角色

### 窗口 A：主执行窗口

窗口 A 是唯一默认允许写代码和提交的窗口。

允许：

- 对一个明确小主题做 read-only review。
- 定义最小白名单。
- 在白名单内修改文件。
- 运行非 live、本地验证。
- 只 stage 白名单。
- 做单主题 commit。

必须停止并报告：

- 需要扩大白名单。
- commit 边界不纯。
- 行为变化伪装成 refactor。
- 发现安全风险，例如路径穿越、跨 workspace 访问、token 泄露。
- 测试失败原因不明确。
- 需要触碰 deploy/TKE、live-test、build/push、kubectl、真实云资源或 `.sentrux/*`。
- 需要处理旧 `med-autoscience-runner` / `resource-provisioner`。
- 需要产品方向判断。

提交前必须运行：

```bash
git diff --cached --name-only
git diff --check -- <白名单文件>
```

提交后必须输出：

1. commit hash
2. 实际提交文件
3. 变更主题和边界
4. 验证命令和结果
5. `git diff --cached --name-only` 是否为空
6. 未触碰的禁止范围确认

### 窗口 B：只读侦察窗口

窗口 B 默认只做侦察和分解，不写代码。

允许：

- 读取文件、diff、git status。
- 运行只读静态命令，例如 `rg`、`git diff --name-only`、`git diff --check`、`node --check`。
- 使用 subagent 做只读复核；必须记录模型，允许模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 输出分组、风险、候选白名单和验证命令。

禁止：

- 修改文件。
- stage 或 commit。
- stash pop/drop。
- 运行 live-test、build/push、kubectl 或真实云资源操作。

推荐任务：

- Portal backend 剩余 dirty tree 分解。
- scripts 分类。
- 某个高风险模块的只读威胁模型或依赖闭包 review。

### 窗口 C：deploy/TKE 只读窗口

窗口 C 专门用于 deploy/TKE 风险盘点，默认暂停。

允许：

- 只读 review `deploy/tke-package/**`、`compose.product.yaml`、部署文档和 manifest。
- 输出哪些内容会鼓励 build/push/kubectl/live 操作。
- 输出后续推云前 gate。

禁止：

- 修改 deploy/TKE 文件。
- 执行 build/push、docker login/build/push、kubectl apply、rollout、live-test。
- 把 deploy/TKE 改动带入普通重构提交。

deploy/TKE 只能在用户明确授权“推云前 runbook 整理”或“灰度执行”时继续。

## 推荐工作流

1. 窗口 B 或 C 做只读 review，输出候选。
2. 用户选择一个候选交给窗口 A。
3. 窗口 A 先 read-only review。
4. 如果边界干净，窗口 A 修改、验证、commit。
5. 如果触发停止条件，窗口 A 停下并输出原因。
6. 不允许两个窗口同时在同一个工作树写代码。

## 当前优先队列

低风险优先：

1. Portal backend `page payload` 拆分。
2. Portal backend `auth/http dispatcher` 拆分。
3. Portal backend `resource-order domain normalizer` 拆分，仅限 domain helper，不含 routes/cloud/ledger。
4. contract-only scripts 小批次同步，但必须排除 live/cloud/deploy/destructive、v13/v19/v20 legacy。

继续暂缓：

- runtime bridge routes/message/relay/workspace-index 行为面。
- Langfuse / trace 退役。
- OPL launch service。
- resource order public routes / platform provisioning 行为面。
- deploy/TKE、compose.product.yaml。
- `.sentrux/*`。
- 旧 `med-autoscience-runner`、`resource-provisioner`。

## 交接模板

只读窗口输出模板：

```text
只读 review 完成；未改代码、未 stage、未 commit。

范围：
- ...

结论：
- 可提交 / 暂缓 / 需要产品判断

文件分组：
- ...

风险：
- ...

建议白名单：
- ...

验证命令：
- ...
```

执行窗口提交模板：

```text
已提交：
<commit hash>
<commit message>

实际提交文件：
- ...

边界说明：
- ...

验证结果：
- ...

未触碰：
- deploy/live/cloud/.sentrux/adapters/旧栈 等
```

停止报告模板：

```text
已停止，未提交。

原因：
- 白名单需要扩大 / 行为变化不纯 / 安全风险 / 测试旧契约 / deploy-live-cloud 触发

当前状态：
- staged 是否为空
- 已改但未提交文件
- 已运行验证

建议下一步：
- ...
```
