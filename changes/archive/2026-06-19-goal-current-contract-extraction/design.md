# goal-current-contract-extraction Design

## Architecture

`tests/fixtures/v22/goal-current.json` 继续做唯一 machine cursor，但不再承载大型 owner payload。新增两个 consumer-first JSON contracts 到 `contracts/`，分别作为 Package D deploy readiness 与 production launch gap map 的唯一机器 owner surface。`goal-current.json` 只通过 `*_ref` 字段引用它们。

## Data Flow

`goal-current.json` -> ref fields -> `contracts/*.json` -> direct consumer tests/runners。

内部 JSON pointer 也一起迁移：`deployAuthorizationPack.path` 和引用它的 `authorizationPack` 都改指向 `contracts/medopl-package-d-deploy-readiness.json`，避免留下跨文件悬挂引用。

## Failure Modes

- 如果未来有人把大对象重新塞回 `goal-current.json` 顶层，index-loop test 会失败。
- 如果有人新增合同但不被 tests/source/runner 消费，会违反 consumer-first contract discipline。
- 如果内部 pointer 仍指向旧 `goal-current.json` 路径，future-authorized 合同消费者会读取到过期路径。

## Surface Impact

- source: none
- docs: `contracts/README.md`, `docs/specs/README.md`, `docs/source/README.md`, `docs/policies/README.md`
- specs: `specs/framework/spec.md`
- tests: `tests/contract/contract-test-v22-current-state-index-loop.mjs`, `tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`, `tests/fixtures/v22/goal-current.json`
