# OPL v19 TKE Live Cleanup Evidence

日期：2026-05-01

分支：`codex/opl-v19`

提交基线：`99c6368` 之后的工作区修复

## 结论

Step 4 已通过。

本轮已经证明：

- TKE live gate 脚本可以使用 WSL2 下的 Windows `kubectl.exe` 和显式 kubeconfig/server。
- patch 后的 `resource-provisioner-opl` 已运行镜像 `uswccr.ccs.tencentyun.com/gaofenglab/resource-provisioner-opl:opl-v19-tke-disk-20260501-79051d7`。
- deployment 环境变量 `TENCENT_TKE_SYSTEM_DISK_TYPE=CLOUD_BSSD` 已生效。
- `CreateClusterNodePool` 可以创建真实 node pool。
- 创建出的 node pool 带完整业务标签：
  - `tenantid`
  - `workspaceid`
  - `runid`
  - `serverplanid`
  - `resourceorderid`
- `0501h` 已创建真实 CVM `ins-h4uz5mky`，实例规格 `MA5.MEDIUM16`，系统盘类型 `CLOUD_BSSD`，状态到达 `RUNNING`。
- 缩容和删除链路可释放 CVM、ASG 容量和 node pool。
- `0501a`、`0501b`、`0501c`、`0501d`、`0501f`、`0501h` 结束后均无 node pool、CVM、AS group、Pod、Job、PVC 残留。

结论：

- `0501g` 收敛出的根因 `CallCvmError:InvalidParameter: [19045]CVM not support the required disk` 已被 `CLOUD_BSSD` 默认系统盘修复跨过。
- `0501h` 已证明“真实计算资源创建 + CVM 清理”闭环成立。

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
- `adapters/resource-provisioner/src/config.mjs`
- `adapters/resource-provisioner/src/provisioner.mjs`
- `scripts/smoke-test-resource-provisioner-v12-contract.mjs`

修复内容：

- `kubectl` 调用显式传入 `--kubeconfig`，避免 Windows `kubectl.exe` 只读 `KUBECONFIG` 环境变量时出现 server override 的证书校验错误。
- `CreateClusterNodePool` payload 不再设置 `LaunchConfigurePara.ImageId`。
- `LaunchConfigurePara.InstanceChargeType` 默认补为 `POSTPAID_BY_HOUR`。
- 空的 `LaunchConfigurePara.DataDisks=[]` 不再发送。
- 空的 `InstanceAdvancedSettings.DataDisks=[]` 不再发送。
- 在 VPC network 场景下，如果 `AutoScalingGroupPara.SubnetIds` 已存在，则不发送 `AutoScalingGroupPara.Zones`。
- `scaleToZero` 改为调用 TKE `ModifyNodePoolDesiredCapacityAboutAsg`，不再向 `ModifyClusterNodePool` 发送无效的 `AutoScalingGroupPara`。
- 默认系统盘类型改为可配置：
  - `TENCENT_TKE_SYSTEM_DISK_TYPE`，默认 `CLOUD_BSSD`
  - `TENCENT_TKE_SYSTEM_DISK_SIZE`，默认 `50`
- `serverPlan.systemDiskType` / `serverPlan.SystemDiskType` 仍可显式覆盖默认盘型。

这些修复均有本地 contract 锁定。

## 验证命令

```bash
node --check adapters/resource-provisioner/src/config.mjs
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

### 0501f

- 目标：`test-ro-v19-0501f`
- Node pool：`np-lq7am8bw`
- AS group：`asg-il3o01p0`
- Evidence JSON：
  - `.runtime/resource-provisioner/live-tke-create-delete-cleanup/2026-05-01T02-26-54-326Z.json`
- 结果：完整脚本返回 `ok=false`，cleanup 成功，无残留。
- 失败原因：
  - `create_instances_timeout`
  - node pool 已创建，状态 `normal`
  - node pool 标签完整
  - AS group 已创建，状态 `NORMAL`
  - AS group 曾为 `DesiredCapacity=1`、`MinSize=1`、`MaxSize=1`
  - AS group `InstanceCount=0`、`InServiceInstanceCount=0`
  - AS group 没有 scaling activities
  - `ModifyNodePoolDesiredCapacityAboutAsg` 可改变 desired，但仍没有触发 CVM 创建
- 删除验证：
  - `matchedNodePools=[]`
  - `matchedClusterInstances=[]`
  - `matchedCvm=[]`
  - `matchedAsg=[]`
  - Kubernetes `pods/jobs/pvc` itemCount 为 0

额外诊断结论：

```json
{
  "nodePoolId": "np-lq7am8bw",
  "autoScalingGroupId": "asg-il3o01p0",
  "asGroupObserved": {
    "desiredCapacity": 1,
    "minSize": 1,
    "maxSize": 1,
    "instanceCount": 0,
    "inServiceInstanceCount": 0,
    "activities": []
  },
  "finalResiduals": {
    "matchedNodePools": [],
    "matchedClusterInstances": [],
    "matchedCvm": [],
    "matchedAsg": [],
    "kubernetesItemCount": 0
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

### 0501g 只读根因复核

- 目标：`test-ro-v19-0501g`
- Pending Pod 首次观测：`2026-05-01T04:17:11Z`
- Pending Pod 最后观测：`2026-05-01T04:37:11Z`
- 云侧 ASG：
  - `asg-il3o01p0`
  - `asg-4khf07pu`
- 只读 AS 活动结论：
  - ASG 已尝试扩容。
  - `DescribeAutoScalingActivities` 返回 `statusCode=FAILED`。
  - 失败消息为 `CallCvmError:InvalidParameter: [19045]CVM not support the required disk`。
- Kubernetes 侧观察：
  - 当前 MachineSet 只有 `np-30dcy6vw`。
  - `cluster-autoscaler-status` 只认识 `np-30dcy6vw`。
  - 当前工作 MachineSet 的系统盘类型为 `CloudBSSD`。

结论：这轮失败不是 kubeconfig、CA 未触发、CVM 已起但未注册，也不是单纯 pod selector/taint 问题。首要失败点是创建实例时系统盘参数不被当前地域/机型支持。

### 0501h 修复后 live create/delete

- 目标：`test-ro-v19-0501h`
- Node pool：`np-59gyia12`
- CVM：`ins-h4uz5mky`
- AS group：`asg-al9g3m5a`
- Evidence JSON：
  - `.runtime/resource-provisioner/live-tke-create-delete-cleanup/2026-05-01T06-20-23-286Z.json`
- 结果：完整脚本返回 `ok=true`，create/delete/cleanup 全链路通过。
- 关键创建结果：
  - `CreateClusterNodePool requestId=d7412bc3-d686-455e-ae5d-6626ae002e55`
  - 预览 payload `LaunchConfigurePara.SystemDisk={"DiskType":"CLOUD_BSSD","DiskSize":50}`
  - 匹配实例 `ins-h4uz5mky`
  - `instanceType=MA5.MEDIUM16`
  - `status=RUNNING`
  - `clusterStatus=initializing`
  - 实例系统盘 `DiskType=CLOUD_BSSD`
- Kubernetes 侧创建观测：
  - `v19-scale-test-ro-v19-0501h` 在 `after-create` 被观测为 `Pending`
  - 标签选择器命中 1 个 Pod，说明 scale trigger 生效
- Cleanup 结果：
  - `DeleteClusterNodePool requestId=27f549a7-b05e-4807-8741-f91746278a08`
  - cleanup 收尾后复查 `asg-al9g3m5a` 已不存在
  - 最终 `matchedNodePools=[]`
  - 最终 `matchedInstances=[]`
  - 最终 `matchedAsg=[]`
  - 最终 Kubernetes `pods/jobs/pvc` itemCount 为 `0`

关键成功摘要：

```json
{
  "ok": true,
  "nodePoolId": "np-59gyia12",
  "instanceId": "ins-h4uz5mky",
  "instanceType": "MA5.MEDIUM16",
  "systemDiskType": "CLOUD_BSSD",
  "cleanupDeleteNodePoolRequestId": "27f549a7-b05e-4807-8741-f91746278a08",
  "finalResiduals": {
    "matchedNodePools": [],
    "matchedInstances": [],
    "matchedAsg": [],
    "kubernetesItemCount": 0
  }
}
```

## 最终残留复查

只读复查覆盖：

- `test-ro-v19-0501a`
- `test-ro-v19-0501b`
- `test-ro-v19-0501c`
- `test-ro-v19-0501d`
- `test-ro-v19-0501f`
- `test-ro-v19-0501h`

结果：

```json
{
  "matchedNodePools": [],
  "matchedInstances": [],
  "kubernetes": {
    "0501a": 0,
    "0501b": 0,
    "0501c": 0,
    "0501d": 0,
    "0501f": 0,
    "0501h": 0
  }
}
```

## 验收状态

- [x] live gate 脚本存在并有 no-live guard。
- [x] `kubectl.exe` + kubeconfig + server override 可用。
- [x] 真实 node pool 可以创建。
- [x] node pool 标签完整。
- [x] 失败后 node pool 可删除。
- [x] 真实 CVM instance 创建成功。
- [x] 真实 CVM instance 标签完整。
- [x] 最终无 node pool、CVM、Pod、Job、PVC 残留。
- [x] 完整脚本返回 `ok=true`。

## 下一步

Step 4 已完成。后续只需把这轮 `0501h` 证据带回主线汇总，并继续推进剩余 live gate。
