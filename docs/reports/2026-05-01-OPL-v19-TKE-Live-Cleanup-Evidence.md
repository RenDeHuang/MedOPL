# OPL v19 TKE Live Cleanup Evidence

日期：2026-05-01

分支：`codex/opl-v19`

提交基线：`99c6368` 之后的工作区修复

## 结论

Step 4 尚未通过。

本轮已经证明：

- TKE live gate 脚本可以使用 WSL2 下的 Windows `kubectl.exe` 和显式 kubeconfig/server。
- `CreateClusterNodePool` 可以创建真实 node pool。
- 创建出的 node pool 带完整业务标签：
  - `tenantid`
  - `workspaceid`
  - `runid`
  - `serverplanid`
  - `resourceorderid`
- 删除请求可以释放 node pool。
- 失败轮次结束后，`0501a`、`0501b`、`0501c`、`0501d` 均无 node pool、CVM、Pod、Job、PVC 残留。

仍未通过的原因：

- `0501d` 使用 `MinSize=1`、`DesiredCapacity=1` 后，node pool `np-qceybpqk` 在 15 分钟内保持 `normal`，但没有出现匹配 CVM instance。
- 因此还不能证明“真实计算资源创建 + CVM 清理”闭环。

## 真实云上数据

Kubeconfig：

- `/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)`

Kubernetes API server：

- `https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443`

Secret：

- `tencent-provisioner-secret`

Secret 明文没有写入文档、git、日志或镜像。

## 本轮修复

文件：

- `scripts/live-test-v19-tke-create-delete-cleanup.mjs`
- `adapters/resource-provisioner/src/provisioner.mjs`
- `scripts/smoke-test-resource-provisioner-v12-contract.mjs`

修复内容：

- `kubectl` 调用显式传入 `--kubeconfig`，避免 Windows `kubectl.exe` 只读 `KUBECONFIG` 环境变量时出现 server override 的证书校验错误。
- `CreateClusterNodePool` payload 不再设置 `LaunchConfigurePara.ImageId`。
- `LaunchConfigurePara.InstanceChargeType` 默认补为 `POSTPAID_BY_HOUR`。
- 空的 `LaunchConfigurePara.DataDisks=[]` 不再发送。
- 空的 `InstanceAdvancedSettings.DataDisks=[]` 不再发送。
- 在 VPC network 场景下，如果 `AutoScalingGroupPara.SubnetIds` 已存在，则不发送 `AutoScalingGroupPara.Zones`。

这些修复均有本地 contract 锁定。

## 验证命令

```bash
node --check adapters/resource-provisioner/src/provisioner.mjs
node --check scripts/live-test-v19-tke-create-delete-cleanup.mjs
node scripts/smoke-test-resource-provisioner-v12-contract.mjs
node scripts/smoke-test-resource-provisioner-contract.mjs
node scripts/check-v18-module-boundaries.mjs
```

## Live 尝试摘要

### 0501a

- 目标：`test-ro-v19-0501a`
- 结果：失败后 cleanup 成功，无残留。
- 失败原因：
  - 初始 cleanup-only 暴露 `kubectl` 未显式传 `--kubeconfig` 的 TLS 校验问题。
  - 修复后 create 暴露 `ImageId can not be set`。
  - 去除 `ImageId` 后暴露 `InstanceChargeType must be set`。
  - 删除验证：无 node pool、CVM、Pod、Job、PVC 残留。

### 0501b

- 目标：`test-ro-v19-0501b`
- Node pool：`np-hvlddcsq`
- 结果：失败后 cleanup 成功，无残留。
- 失败原因：
  - `LaunchConfigurePara.DataDisks=[]` 或 `InstanceAdvancedSettings.DataDisks=[]` 被腾讯云 AS 判定为无效。
  - 删除请求：`DeleteClusterNodePool` 成功。
  - 删除验证：无 node pool、CVM、Pod、Job、PVC 残留。

### 0501c

- 目标：`test-ro-v19-0501c`
- Node pool：`np-3ilkbaua`
- 结果：手动 cleanup-only 成功，无残留。
- 失败原因：
  - `AutoScalingGroupPara.Zones` 在 VPC network 场景无效。
  - Node pool 曾达到 `normal`，但没有匹配 CVM instance。
  - 删除验证：无 node pool、CVM、Pod、Job、PVC 残留。

### 0501d

- 目标：`test-ro-v19-0501d`
- Node pool：`np-qceybpqk`
- Evidence JSON：
  - `.runtime/resource-provisioner/live-tke-create-delete-cleanup/2026-05-01T01-53-28-807Z.json`
- 结果：完整脚本返回 `ok=false`，cleanup 成功，无残留。
- 失败原因：
  - `create_instances_timeout`
  - node pool 已创建，状态 `normal`
  - node pool 标签完整
  - 15 分钟内没有匹配 CVM instance

关键错误摘要：

```json
{
  "ok": false,
  "mode": "create_delete_cleanup",
  "nodePoolId": "np-qceybpqk",
  "error": {
    "message": "create_instances_timeout"
  }
}
```

node pool 标签摘要：

```json
{
  "nodePoolId": "np-qceybpqk",
  "name": "opl-ma5-medium16-0501d",
  "status": "normal",
  "tagMap": {
    "tenantid": "testtenantv190501d",
    "workspaceid": "testworkspacev190501d",
    "runid": "testrunv190501d",
    "serverplanid": "ma5medium16",
    "resourceorderid": "testrov190501d"
  },
  "labelMap": {
    "gaofenglab/tenant-id": "test-tenant-v19-0501d",
    "gaofenglab/workspace-id": "test-workspace-v19-0501d",
    "gaofenglab/run-id": "test-run-v19-0501d",
    "gaofenglab/server-plan-id": "ma5-medium16",
    "gaofenglab/resource-order-id": "test-ro-v19-0501d"
  }
}
```

cleanup 摘要：

```json
{
  "deleteNodePool": {
    "ok": true,
    "action": "DeleteClusterNodePool",
    "nodePoolId": "np-qceybpqk",
    "destroyCvmInstances": true
  },
  "finalState": {
    "matchedNodePools": [],
    "matchedInstances": []
  },
  "kubernetesAfterDelete": {
    "itemCount": 0,
    "items": []
  }
}
```

## 最终残留复查

只读复查覆盖：

- `test-ro-v19-0501a`
- `test-ro-v19-0501b`
- `test-ro-v19-0501c`
- `test-ro-v19-0501d`

结果：

```json
{
  "matchedNodePools": [],
  "matchedInstances": [],
  "kubernetes": {
    "0501a": 0,
    "0501b": 0,
    "0501c": 0,
    "0501d": 0
  }
}
```

## 验收状态

- [x] live gate 脚本存在并有 no-live guard。
- [x] `kubectl.exe` + kubeconfig + server override 可用。
- [x] 真实 node pool 可以创建。
- [x] node pool 标签完整。
- [x] 失败后 node pool 可删除。
- [x] 最终无 node pool、CVM、Pod、Job、PVC 残留。
- [ ] 真实 CVM instance 创建成功。
- [ ] 真实 CVM instance 标签完整。
- [ ] 完整脚本返回 `ok=true`。

## 下一步

继续查明为什么 TKE node pool 已 `normal` 但没有生成 CVM instance。不能把 Step 4 标为通过，也不能把 v19 标为可滚云正式版本。

