# v22 Tencent TC3 Diagnostic Cleanup Plan

本计划只定义 hand-rolled TC3 的后续 cleanup 条件和步骤，不删除代码、不修改 runner、不读取 secret、不调用真实云。

## 背景

v22 provider strategy 的 future authorized provider candidate 是 Tencent official SDK wrapper；当前 trunk 默认路径仍是合同级、本地 smoke 和 fail-closed gate。

hand-rolled TC3 当前降级为 diagnostic/reference only。它可以继续作为诊断和参考实现存在，但不能重新成为 future authorized default readonly live path，不能成为 create/release provider，也不能扩大 mutation 权限。

official SDK readonly live 跑通前，不删除 TC3。

official SDK readonly live 跑通后，需要 cleanup TC3 production path。

## 退场条件

TC3 production path cleanup 必须等以下条件全部满足后才能启动：

- official SDK wrapper 合并。
- official SDK 依赖合并。
- official SDK readonly live 成功生成脱敏 report。
- B 审查确认 future authorized provider candidate 不再依赖 TC3。

任何条件不满足时，TC3 只能保持 diagnostic/reference only，不能删除，也不能把 cleanup 当作已完成。

## Cleanup 内容

后续 cleanup 分支需要处理以下内容：

- runner future authorized default candidate 不再使用 tencent-tc3-readonly。
- TC3 smoke 改为 diagnostic fixture 或删除。
- TC3 live bridge 从生产路径退场。
- 保留/删除策略由 cleanup 分支决定。

cleanup 分支必须证明 future authorized provider candidate 仍是 Tencent official SDK wrapper，业务层仍只依赖 v22 readonly inventory interface，TC3 没有被 create/release 或默认 readonly live 主路径继续引用。

## 保留 / 删除策略

cleanup 分支可以选择：

- 保留 TC3 为 isolated diagnostic fixture，用于离线签名形状、readonly allowlist 和脱敏 report fixture 检查。
- 删除 TC3 live bridge 和相关 production path，只保留合同历史。
- 删除全部 TC3 诊断实现，但必须先证明 official SDK readonly live 已覆盖当前诊断价值。

具体选择必须在 cleanup 分支中由 B 审查确认，不能在本计划分支提前决定。

## 非目标

- 当前不删除 TC3。
- 不读 secret。
- 不调用真实云。
- 不改 official SDK implementation。
- 不改 create/release。
- 不安装 SDK 依赖。
- 不修改 runner future authorized default candidate。
- 不修改 TC3 live bridge。

## 验收

本计划分支只通过静态合同 smoke 验收：

```bash
node tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs
node tests/contract/contract-test-v22-mvp-contract-suite.mjs
git diff --check -- docs/contracts scripts
```

## Contract Data

<!-- v22-tencent-tc3-diagnostic-cleanup-plan:start -->
```json
{
  "contract": "v22_tencent_tc3_diagnostic_cleanup_plan",
  "version": 1,
  "tc3CurrentRole": "diagnostic_reference_only",
  "deleteTc3Now": false,
  "callRealCloudNow": false,
  "readSecretNow": false,
  "changesOfficialSdkImplementation": false,
  "changesCreateRelease": false,
  "cleanupRequiresOfficialSdkWrapperMerged": true,
  "cleanupRequiresOfficialSdkDependencyMerged": true,
  "cleanupRequiresOfficialSdkReadonlyLiveRedactedReport": true,
  "cleanupRequiresBAuditProductionDefaultNoTc3": true,
  "runnerProductionDefaultMustNotUseTencentTc3ReadonlyAfterCleanup": true,
  "tc3SmokePolicy": "diagnostic_fixture_or_delete",
  "tc3LiveBridgeProductionPathAfterCleanup": "retired",
  "retainOrDeleteDecisionOwner": "cleanup_branch"
}
```
<!-- v22-tencent-tc3-diagnostic-cleanup-plan:end -->
