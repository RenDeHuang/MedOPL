# goal-current-contract-extraction Proposal

Status: authoring
Branch: goal-current-contract-extraction
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

`tests/fixtures/v22/goal-current.json` 仍然直接承载 `package_d_deploy_readiness_plan` 和 `production_launch_goal_gap_map` 两个巨型 owner payload。它们已经被测试直接消费，继续放在 current cursor 会让 machine cursor 退化成第二份 owner surface。

## Goals

- 将 `package_d_deploy_readiness_plan` 迁入 `contracts/medopl-package-d-deploy-readiness.json`。
- 将 `production_launch_goal_gap_map` 迁入 `contracts/medopl-production-launch-gap-map.json`。
- 让 `goal-current.json` 只保小型 current cursor 与合同引用字段。
- 迁移直接消费者测试到新 contracts surface，并为后续 runner/source 消费保留稳定路径。

## Non-Goals

- 不进入商业化实现、真实云、deploy、kubectl、build/push 或 live-test。
- 不修改 upstream、`deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`。
- 不重写 `gaps`、`backend_go_convergence_program` 等其他 owner surface。

## Golden Path Impact

- no-impact: 只调整 machine contract 存放位置与测试消费路径。
- affected steps: current-state index loop、future-authorized local gate、framework/docs cleanup proof。
- required golden path eval: `node tests/contract/contract-test-v22-current-state-index-loop.mjs`，`node tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs`。

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/source/README.md
- docs/policies/README.md
- specs/framework/spec.md
- tests/fixtures/v22/goal-current.json
- tests/contract/contract-test-v22-current-state-index-loop.mjs
