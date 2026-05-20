# v22 Smoke / Eval Physical Compaction Index

本索引记录 `cleanup/v22-smoke-eval-physical-compaction` 的 smoke/eval 物理压缩裁定。它不新增产品合同、不推进业务 cursor、不接云、不读取 secret、不执行 build/push/deploy/kubectl/live-test，只收敛 repo-local eval 文件、suite 入口和可删除重复脚本。

## 当前权威

- `docs/contracts/v22-smoke-eval-boundary.md`：smoke/eval 语义边界。
- `scripts/v22-test-classification.mjs`：所有 `tests/**/*.mjs` 的 category/tier/surface 权威。
- `docs/recovery/v22-agent-verify-manifest.json`：suite、branch override 和允许写入范围权威。
- `scripts/v22-verify.mjs`：统一验证入口。

## 当前统计

- v22 eval scripts: 148
- health-check: 6
- smoke-golden: 11
- contract-local: 21
- local-regression: 62
- future-authorized: 48
- retired: 0

以上统计是 `cleanup/v22-smoke-eval-physical-compaction` 吸收时的基线。后续治理 gate 会增加当前 eval 总量，但不得改变本 leaf 已清退 3 个旧脚本、health/smoke-golden 保持小集合、future-authorized 不授权真实云这三条事实。

`health` 和 `smoke` 保持小集合。`local-contract` 和 `local-regression` 是 eval，不再叫 smoke。`future-authorized` 只做分类可见性，不授权真实云或 live/deploy。

## 本轮物理清退

| File | Decision | Replacement / Authority |
| --- | --- | --- |
| `scripts/check-portal-copy.mjs` | delete | `scripts/check-mojibake.mjs` 已覆盖 Portal server mojibake 和更宽文本面。 |
| `scripts/check-one-person-lab-upstream-clean.mjs` | delete | upstream checkout clean 检查迁入 `tests/contract/smoke-test-v22-repo-governance-physical-compaction.mjs`；当 `.runtime/one-person-lab-upstream` 存在时，gate 执行 `git status --short` 并要求为空。 |
| `scripts/smoke-test-workspace-storage-routes-contract.mjs` | delete | v22 workspace storage gates 覆盖更强公开响应和文件空间行为：`tests/regression/portal/smoke-test-v22-workspace-storage-public-response.mjs`、`tests/regression/portal/smoke-test-v22-portal-file-space-management.mjs`；旧 gate 还会要求公开响应返回 `storageKey`，与当前脱敏合同冲突。 |

## 暂不删除

| File | Status | Reason |
| --- | --- | --- |
| `scripts/v22-agent-workflow.mjs` | blocked-retire-candidate | 仍被 `docs/status.md`、`docs/vibe-coding.md`、`docs/invariants.md`、`docs/decisions.md`、cloud workflow 合同和 smoke 引用。 |
| `scripts/sync-workspace-file-to-minio.ps1` | blocked-retire-candidate | 仍被 `services/portal/src/config/portal-config.mjs` 挂载，删除会触碰服务实现边界。 |
| `scripts/lib/portal-oidc-playwright.mjs` | keep-support | browser/local Portal auth helper，不属于 smoke 文件但仍是测试支撑库。 |
| `scripts/fixtures/opl-product-api-fixture.mjs` | keep-support | OPL product API fixture，被 v22 eval 使用。 |
| `scripts/v22-cloud-*.mjs`, `scripts/v22-tencent-*.mjs` | keep-support | future-authorized 本地选择/runner 支撑，不执行真实云。 |

## Suite 收敛

- `suite health`：最小控制面生命体征，6 个脚本。
- `suite smoke`：唯一 broad smoke 入口，运行 golden smoke suite。
- `suite local-contract`：合同/治理/control-plane eval，包含本 compaction gate。
- `suite local-regression`：本地业务回归，当前仍通过 `smoke-test-v22-mvp-contract-suite.mjs` 聚合。
- `suite mvp`：保留 legacy alias，但语义已收敛为 local deterministic regression，不再作为纯 smoke。
- `suite cloud-future-authorized`：分类可见性，不跑真实云。

## 后续候选

后续若继续压缩，不应直接删大批 `tests/**/*.mjs`。正确顺序是：

1. 先把 `local-regression` 从 `mvp` 旧命名聚合迁到更清晰的 runner。
2. 再把 `v22-agent-workflow.mjs` 与 `v22-workflow-gate.mjs` 的职责拆清，迁移 docs/contracts 引用。
3. 对 future-authorized cloud gates 做 grouped manifest，而不是执行真实云。
4. 每个物理删除都必须有替代 gate 或 explicit retired record。

## 非目标

- 不新增产品合同。
- 不改 current cursor。
- 不改 services 业务代码。
- 不接真实云。
- 不读取 secret。
- 不执行 build/push/deploy/kubectl/live-test。
- 不修改 upstream。
