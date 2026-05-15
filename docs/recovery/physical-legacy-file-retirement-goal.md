# MedOPL v22 Strict Monolith Legacy Retirement Goal

## Branch Declaration

- branch: `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement`
- model: `gpt-5.4`
- role: strict monolith cleanup goal
- intent: 先写清 v22 理想形态与差距，再清故事线，最后分 slice 物理删除旧模块、旧接口、旧测试、旧脚本、旧部署资产和旧兼容面。
- base: latest `origin/recovery/platform-v22-trunk`
- target: hand off to B review only; do not push, do not merge trunk.
- physical_delete_batch_status: strict_monolith_retirement_in_progress

## Contract Subscription

本 goal 订阅：

- `AGENTS.md`
- `docs/contracts/README.md`
- `docs/contracts/v22-saas-control-plane-user-experience-boundary.md`
- `docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md`
- `docs/recovery/v22-goal-current.json`
- `docs/recovery/v22-current-vs-ideal-gap-matrix.md`
- `docs/recovery/v22-goal-state.md`
- `docs/recovery/status-matrix.md`
- `docs/recovery/repo-zoning.md`
- `docs/recovery/legacy-cleanup-backlog.md`
- `docs/recovery/physical-legacy-file-retirement-inventory.md`
- `docs/recovery/physical-legacy-file-retirement-run-manifest.json`

## Ideal State

- MedOPL 是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。
- Portal 是托管科研工作台 control plane。
- 用户购买套餐、算力、存储和运行环境。
- 平台负责开通、隔离、计费、审计和释放。
- OPL runtime 负责科研工作区执行、文件、任务和结果。

## Gap To Ideal

- `user-owned` 不是主线；旧 public route、route registration、compat alias、fixture、copy、evalset 和测试锚点都必须删除。
- `resource-order` 不是主线；旧 route、domain、store、schema、migration key、snapshot helper、fixture、copy、evalset 和测试锚点都必须删除，或先迁入 v22 active boundary。
- v19/v20/v21 legacy smoke 不是当前验证体系；active repo 不再保留旧脚本作为验证入口或历史证据。
- old runner/provisioner 不是 v22 Runtime Bridge / Gateway 主线；旧 adapter、deploy、infra 资产必须退役。
- OpenCost/Langfuse 旧默认叙事不是当前产品事实源；旧 compose/deploy/infra 资产不得作为完成态保留。Sanitized trace metadata implementation boundary 可以保留在 active v22 code 中。

## Strict Policy

每个 legacy 文件或文件组必须精确裁定为一个状态：

- `delete`: 无 active v22 reason，必须物理删除。
- `migrate`: 仍有业务价值，但必须先改名、改边界、改合同并进入 v22 active surface；旧文件随后删除。
- `retain_active_v22`: 只有明确属于 active v22 Portal/Gateway/Runtime Bridge、billing aggregator 或 sanitized trace metadata implementation boundary 的文件可保留。
- `blocker`: 只有触发硬停止条件时使用。

后续 feature leaf 碰到过时模块、接口、测试或兼容面时，必须同 leaf 清理退役，或拆出 cleanup leaf 后再继续。保留项必须有明确 active v22 reason，不能因为 git history、历史证据、旧兼容或旧失败壳而留在 active repo。

## Authorization Boundary

- 不读取 secret、`.env`、kubeconfig、token、SecretId、SecretKey、SSH private key。
- 不调用真实云、COS、Langfuse、one-person-lab 或外部生产 API。
- 不执行 build/push、kubectl、live-test 或真实 runtime smoke。
- 不连接真实 DB，不执行真实 DB migration。
- 不修改 `.sentrux/*` 或 upstream。
- 本次允许删除旧 public retired route shell、v19/v20/v21 legacy smoke、旧 user-owned/resource-order 兼容面，以及不属于 v22 active surface 的旧 deploy/adapters/infra 资产。
- active v22 deploy evidence surface 必须保留：`deploy/local/dockerfiles/portal.Dockerfile`、`deploy/local/dockerfiles/opl-web-gateway.Dockerfile`、`deploy/local/dockerfiles/opl-runtime-bridge.Dockerfile`。

## Execution Slices

### Slice A: Story And Inventory Policy Retirement

- 改 `docs/recovery/physical-legacy-file-retirement-*`、gap matrix、status truth、repo zoning、legacy backlog 和 contracts cleanup package。
- 写清 strict monolith cleanup policy。
- RED: `node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --policy`
- GREEN: 同命令通过。
- commit: `cleanup: define strict monolith legacy retirement policy`

### Slice B: User-Owned And Resource-Order Compatibility Surface Deletion

- 删除 public retired route shell 和 route registration。
- 删除 Portal UI、fixtures、evalset、tests 中旧兼容引用。
- 删除旧 compat alias，只保留 v22 active 主语义。
- RED/GREEN: `node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --portal`
- commit: `cleanup: delete retired user owned and resource order compatibility surfaces`

### Slice C: Legacy Script Deletion

- 删除 v19/v20/v21 legacy smoke、check、daily、live-prepare、resource-provisioner、OpenCost legacy scripts。
- 更新默认 suite 和 gates，只跑 v22 当前验证。
- RED/GREEN: `node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --scripts`
- commit: `cleanup: delete archived legacy smoke scripts`

### Slice D: Retired Adapter Deploy And Infra Asset Deletion

- 删除 `adapters/resource-provisioner/**`、`adapters/med-autoscience-runner/**`、`adapters/cloud-provisioner/**`、`adapters/shared/**`、`infra/opencost/**`、`infra/kubernetes/**`、`infra/codex-runtime/**`、`infra/production-hardening/**`、`compose.demo.yaml`、`compose.langfuse.yaml`、旧 runner/provisioner Dockerfile、`deploy/tke-package/**`，以及 strict scan 发现的旧 v13、portal resource-order/provisioner、runner fixture、v19/v20 helper lib 脚本资产。
- 保留 active v22 Dockerfile surface 和已证明 active 的 `adapters/billing-aggregator/**`。
- RED/GREEN: `node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --assets`
- commit: `cleanup: delete retired adapter deploy and infra assets`

### Slice E: Legacy Schema And Store Remnant Retirement

- 扫描并清退 resource-order schema/store/migration/Postgres snapshot helper。
- 如果涉及真实 DB migration execution，停止并写 blocker；不得执行真实 DB。
- RED/GREEN: `node scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs --schema`
- commit: `cleanup: retire legacy schema and store remnants`

## Per Slice Rules

- 先 RED gate。
- 删除前用 `rg` / import scan 证明无 active v22 reference。
- 删除后更新 inventory、gap matrix、status truth。
- 跑对应 GREEN gate。
- 单独 commit。
- 不把失败 gate 改弱成兼容通过。
- 不混入与 legacy 清退无关的 UI redesign、新功能或样式优化。

## Hard Stop Conditions

- 需要读取 secret / `.env` / kubeconfig / token。
- 需要 live cloud / live-test / build/push/kubectl / deploy。
- 需要真实 DB migration execution。
- 删除会破坏当前 v22 active Portal / Gateway / Runtime Bridge 主线。
- 某旧文件仍被 active v22 runtime/default suite 使用，且无法在本 slice 内迁到最新 v22 surface。
- cleanup 分支开始做与 legacy 清退无关的 UI redesign、新功能或样式优化。

## Verification

必须运行：

```bash
node scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs
node scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs
node scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs
node scripts/smoke-test-v22-retire-user-owned-primary-path.mjs
node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs
node scripts/smoke-test-v22-cleanup-completion-truth.mjs
node scripts/smoke-test-v22-default-entry-narrative-gate.mjs
node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json
node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk
git diff --check -- docs/recovery docs/contracts scripts services deploy adapters infra
```

必要时运行：

```bash
node scripts/smoke-test-v22-mvp-contract-suite.mjs
npm --prefix services/portal run check
npm --prefix services/portal/frontend run test:visual
```
