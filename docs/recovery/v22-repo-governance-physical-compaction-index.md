# v22 Repo Governance Physical Compaction Index

本索引记录 `goal/v22-repo-governance-physical-compaction` 的全仓库分层审计和物理清退裁定。它不是新产品合同，不改变当前产品 cursor；它只把仓库文件归回 `contracts / truth / index / eval / agent-runs / active-code / frozen-governance` 六类，并记录哪些文件已清退、哪些必须等下一轮带 gate 的 cleanup leaf。

## 执行模型

- 总控 / 集成模型：`gpt-5.4`
- 合同与 `docs/product.md` / `docs/architecture.md` 审计 subagent：`gpt-5.4`
- `docs/recovery/**` 审计 subagent：`gpt-5.4`
- `scripts/**` 审计 subagent：`gpt-5.4`
- `services/**` 审计 subagent：`gpt-5.4`
- root / config / `.sentrux/**` 审计 subagent：`gpt-5.4`

## 全量覆盖

本轮按路径域全量阅读 tracked 文件，覆盖范围如下：

| Domain | Files Reviewed | Layer | Decision |
| --- | ---: | --- | --- |
| `docs/product.md`, `docs/architecture.md`, `docs/contracts/**` | 45 | `contracts / truth` | 长期主线边界保留，只记录 merge/rename/retire 候选，不在本分支物理删除合同。 |
| `docs/recovery/**` | 43 | `truth / index / agent-runs` | 核心 truth/index 保留；阶段性 recovery 文件进入候选清单，待引用迁移后退场。 |
| `scripts/**` | 162 before smoke/eval compaction, 160 after smoke/eval compaction | `eval` | v22 smoke/eval 主链保留；真实生产/DNS/kubectl 残留脚本和已迁移旧 eval/support 脚本物理清退。 |
| `services/**` | 289 | `active-code` | `portal`、`opl-web-gateway`、`opl-runtime-bridge` 是 active code surface，本分支不删除服务代码。 |
| root / `configs/**` / `.sentrux/**` | 24 before cleanup, 10 after cleanup | `frozen-governance / retired-config` | `configs/**` 物理清退；`.sentrux/**` 冻结不触碰；`compose.product.yaml` 因仍被本地运行 gate 引用暂不删除。 |

本 leaf 提交后的 tracked 文件总数：`556`。

根级 `docs/status.md`、`docs/vibe-coding.md`、`docs/invariants.md`、`docs/decisions.md` 归为 governance reference。它们仍引用 `scripts/v22-agent-workflow.mjs`，因此本轮不物理删除该脚本。

## 稳定主线

### contracts

长期合同只表达稳定边界、授权和非目标，不承载阶段故事线。

必须保留：

- `docs/contracts/README.md`
- `docs/contracts/v22-mvp-managed-opl-loop.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md`
- `docs/contracts/v22-portal-user-surface-boundary.md`
- `docs/contracts/v22-portal-admin-ops-surface-boundary.md`
- `docs/contracts/v22-opl-entry-preflight-auth-boundary.md`
- `docs/contracts/v22-token-provider-boundary.md`
- `docs/contracts/v22-upstream-opl-boundary.md`
- `docs/contracts/v22-portal-opl-connection-boundary.md`
- `docs/contracts/v22-portal-opl-context-backflow-boundary.md`
- `docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md`
- `docs/contracts/v22-opl-work-message-file-run-boundary.md`
- `docs/contracts/v22-portal-files-billing-trace-boundary.md`
- `docs/contracts/v22-trace-metadata-boundary.md`
- `docs/contracts/v22-resource-plan-boundary.md`
- `docs/contracts/v22-tenant-resource-binding-boundary.md`
- `docs/contracts/v22-managed-environment-open-boundary.md`
- `docs/contracts/v22-release-stop-billing-audit-boundary.md`
- `docs/contracts/v22-production-cloud-topology-boundary.md`
- `docs/contracts/v22-authorized-tencent-create-release-*.md`
- `docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md`
- `docs/contracts/v22-smoke-eval-boundary.md`

候选但不在本分支删除：

| File | Decision | Blocker |
| --- | --- | --- |
| `docs/contracts/v22-admin-ops-console-boundary.md` | merge-candidate | 仍被 UI/admin 合同包引用。 |
| `docs/contracts/v22-user-credit-provider-key-boundary.md` | merge-candidate | provider key 语义需先并入 token/preflight 主合同并迁引用。 |
| `docs/contracts/v22-billing-freeze-boundary.md` | merge-candidate | 需先并入 release/stop billing/audit 合同并迁引用。 |
| `docs/contracts/v22-real-opl-*canary*.md` | merge-candidate | canary 证据尚被 validation path 和 gate 引用。 |
| `docs/contracts/v22-portal-ui-design-quality-audit-boundary.md` | rename-candidate | 本质是 eval rubric，改名会影响现有 gate。 |
| `docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md` | retire-candidate | Figma UI 已冻结，但仍被当前 UI 历史边界引用。 |
| `docs/contracts/v22-cloud-onboarding-workflow-boundary.md` | rename-candidate | 仍是 cloud future-authorized workflow 入口。 |
| `docs/contracts/v22-tencent-tc3-diagnostic-cleanup-plan.md` | retire-candidate | 仍被 readonly inventory / workflow 引用。 |

### truth

当前真相只由少数文件承载：

- `docs/product.md`
- `docs/architecture.md`
- `docs/recovery/product-truth.md`
- `docs/recovery/architecture-truth.md`
- `docs/recovery/v22-truth-freeze.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/mvp-contract-acceptance.md`

当前业务真相：

1. Portal 是托管科研工作台控制面，不是云控制台。
2. 用户通过 Portal 主动开通托管计算资源和文件空间；底层可映射 CVM / object storage / runtime，但普通用户不直接配置云资源。
3. Portal 负责用户、额度、套餐、托管资源绑定、文件索引、OPL session/run/artifact 投影、账单、审计和释放状态。
4. OPL upstream 保持 clean；Portal 通过 Gateway / Runtime Bridge / Runtime Agent 与 upstream 公共边界衔接。
5. 文件正文在 object storage；Portal 保存 logical file ref、workspace 归属、状态、元数据、计费和审计索引。公开响应不得泄漏 raw object key、local path、signed URL、raw provider key 或 token。
6. 用户删除文件空间进入 7 天保护期；释放计算资源只停止计算计费和续用，不等于立即删除文件空间。
7. PostgreSQL 是未来 production truth 的 canonical relational store；Redis 只用于 session/cache/queue/lock，不作为账本或审计真相。
8. 云 mutation、deploy、live-test、真实云资源操作仍必须单独授权。

### index

下一步 cursor、gap、验证命令和允许写入范围以机器入口为准：

- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-agent-verify-manifest.json`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `docs/recovery/v22-product-completion-scoreboard.json`
- `docs/recovery/v22-cloud-harness-manifest.json`
- `docs/recovery/v22-contract-eval-compaction-index.md`
- `docs/recovery/v22-repo-governance-physical-compaction-index.md`

### taxonomy-skeleton

`cleanup/v22-docs-taxonomy-skeleton` 新增 OPL-style lifecycle taxonomy 骨架。它们是过渡期的人读目录入口，不替代当前 machine truth、contracts、recovery cursor 或 verify manifest。

- `docs/README.md`
- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/specs/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `docs/public/README.md`
- `docs/references/README.md`
- `docs/history/README.md`
- `tests/README.md`

本组文件的删除门槛与旧文档相反：它们是后续清退旧 `docs/contracts/**`、`docs/recovery/**` 和 `tests/**/*.mjs` 前的替代 taxonomy skeleton；本轮不物理删除旧路径。

### eval

Eval 入口继续保留分层：

- `scripts/v22-verify.mjs` 是统一 runner。
- `docs/recovery/v22-agent-verify-manifest.json` 是 suite / branch override authority。
- `scripts/v22-test-classification.mjs` 是 v22 smoke/eval 分类 authority。
- `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs` 是本轮仓库治理压缩 gate。

### agent-runs

`docs/recovery/agent-runs/*` 只保存每个 leaf 的开发证据和 B review/吸收记录，不替代 current truth。

## 已物理清退

本轮删除的是不在 active surface、没有当前合同身份、且会把仓库默认入口带回 infra/deploy/live/secret-store 叙事的文件。

### `configs/**`

已删除：

- `configs/gateway/nginx.conf`
- `configs/harbor/harbor-values-local.yaml`
- `configs/kind/kubesphere-preview.yaml`
- `configs/kubesphere/ks-console-nodeport-patch.json`
- `configs/ops/eso-local-dev-probe.yaml`
- `configs/ops/eso-local-dev-secretstore.yaml`
- `configs/ops/eso-portal-platform-secrets.example.yaml`
- `configs/ops/eso-secretstore-openbao.example.yaml`
- `configs/ops/eso-workspace-runtime-secrets.example.yaml`
- `configs/ops/external-secrets-values.yaml`
- `configs/ops/ingress-nginx-values.yaml`
- `configs/ops/kube-prometheus-stack-values.yaml`
- `configs/ops/openbao-production-values.example.yaml`
- `configs/ops/openbao-values.yaml`

理由：

- 不属于 AGENTS 定义的 active surface。
- 混入 gateway nginx、Harbor、Kind、KubeSphere、External Secrets、OpenBao、Prometheus、Ingress 等集群运维叙事。
- 多数文件是 deploy/infra/canary 类资产，但当前分支不授权真实云、deploy 或 live-test。

### 非 v22 eval / live operation scripts

已删除：

- `scripts/check-production-entry-health.mjs`
- `scripts/check-production-entry-performance.mjs`
- `scripts/update-dnspod-records.mjs`
- `scripts/smoke-test-root-dockerignore.mjs`
- `scripts/fixtures/fake-kubectl-success.cmd`

理由：

- 生产入口探针、DNS 变更器、kubectl fixture 或 build-surface 旧检查不属于当前 v22 local eval 主链。
- 删除后 v22 eval 主链仍由 `tests/**/*.mjs`、`scripts/v22-verify.mjs`、`scripts/v22-workflow-gate.mjs` 覆盖。

### smoke/eval support compaction

`cleanup/v22-smoke-eval-physical-compaction` 追加删除：

- `scripts/check-portal-copy.mjs`
- `scripts/check-one-person-lab-upstream-clean.mjs`
- `scripts/smoke-test-workspace-storage-routes-contract.mjs`

理由：

- `scripts/check-portal-copy.mjs` 的 Portal copy/mojibake 检查由 `scripts/check-mojibake.mjs` 的全仓库文本扫描覆盖。
- `scripts/check-one-person-lab-upstream-clean.mjs` 的 upstream checkout clean 检查已迁入 `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`：当 `.runtime/one-person-lab-upstream` 存在时，gate 会执行 `git status --short` 并要求为空；该检查不把 `.runtime` 内容提交进 git。
- `scripts/smoke-test-workspace-storage-routes-contract.mjs` 是非 v22 旧命名 route gate，并且会断言公开响应返回 `storageKey`；当前 v22 替代入口是 `tests/regression/portal/smoke-test-v22-workspace-storage-public-response.mjs` 和 `tests/regression/portal/smoke-test-v22-portal-file-space-management.mjs`，公开响应不得泄漏内部存储字段。

## 暂不删除的阻塞候选

| File / Pattern | Classification | Why blocked |
| --- | --- | --- |
| `compose.product.yaml` | blocked-retire-candidate | 仍被 `tests/contract/smoke-test-v22-default-entry-narrative-gate.mjs` 和 `docs/recovery/repo-zoning.md` 明确引用；同时是本地 PostgreSQL/Redis 下一 leaf 的潜在本地编排入口。 |
| `scripts/v22-agent-workflow.mjs` | duplicate-governance-candidate | 仍被 `docs/status.md`、`docs/vibe-coding.md`、`docs/invariants.md`、`docs/decisions.md`、cloud workflow 合同和 smoke 引用。 |
| `scripts/sync-workspace-file-to-minio.ps1` | blocked-retire-candidate | 仍被 `services/portal/src/config/portal-config.mjs` 挂载。 |
| `services/**` residue candidates | future-cleanup-candidate | 服务代码属于 active surface；候选文件必须另开 service cleanup leaf，补 import/runtime/eval 证明后再删。 |
| `.sentrux/**` | frozen-forbidden | AGENTS 明确禁止普通分支修改；虽然内容陈旧，只能记录，不可触碰。 |
| `.env.demo.template` | sensitive-template | 本轮不读取内容、不修改路径。 |

下一业务 cursor 仍是 `leaf-portal-postgres-redis-local-production-data-closure`。本治理分支只整理仓库，不实现该 leaf。

## active code truth

`services/**` 不在本治理分支物理删除。当前代码边界：

- `services/portal`：control plane，负责 Portal API、用户/工作空间/资源/账单/审计/OPL 投影。
- `services/portal/frontend`：React/Vite Portal SPA，只调用 `/portal/api/**`。
- `services/opl-web-gateway`：`opl.medopl.cn` 前置网关，负责 auth bridge、launch script、upstream proxy 和 runtime bridge proxy。
- `services/opl-runtime-bridge`：Runtime Bridge，负责 launch/session/message/file/run/artifact/trace/cost projection。

高置信服务内 residue 候选只记录，不删除：

- `services/opl-runtime-bridge/src/runtime-bridge-routes-http.mjs`
- `services/opl-runtime-bridge/src/runtime-bridge-managed-run-context.mjs`
- `services/opl-runtime-bridge/src/run-observability.mjs`
- `services/opl-runtime-bridge/src/runner-client.mjs`
- `services/portal/src/app/portal-app.mjs`
- `services/portal/src/domain/tencent-readonly-inventory-*.mjs`
- `services/portal/src/domain/user-resource-bindings.mjs`

## AI 开发仓库规则

后续开发只按五层推进：

1. `contracts`：长期不变量、边界、授权和非目标。
2. `truth`：当前产品、架构、数据、云和治理事实。
3. `index`：下一步 cursor、gap、允许写入范围、验证命令。
4. `eval`：机器可运行 gate，不负责讲故事。
5. `agent-runs`：每一步开发证据、验证结果、B review 和吸收记录。

不再新增阶段性故事文件作为事实源。需要阶段执行记录时写入 `agent-runs`；需要当前事实时回写 truth/index；需要规则时写合同；需要验收时写 eval。
