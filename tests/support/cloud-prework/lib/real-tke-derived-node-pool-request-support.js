function withoutEmpty(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined && child !== null && child !== ""));
}

function normalizeTencentCloudTagKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.:-]/gu, "_")
    .replace(/^_+/u, "")
    .slice(0, 127);
}

function normalizeTencentCloudTags(tags = [], fallback = []) {
  const safe = (Array.isArray(tags) && tags.length ? tags : fallback)
    .map((tag) => {
      const key = normalizeTencentCloudTagKey(tag?.Key ?? tag?.key ?? tag?.Name ?? tag?.name ?? "");
      const value = String(tag?.Value ?? tag?.value ?? "").trim().slice(0, 255);
      return key && value ? { Key: key, Value: value } : null;
    })
    .filter(Boolean);
  return safe.length ? safe : undefined;
}

export function cloneLaunchConfiguration(source = {}, overrides = {}) {
  const instanceTypes = Array.isArray(overrides.InstanceTypes) && overrides.InstanceTypes.length
    ? overrides.InstanceTypes
    : (Array.isArray(source.InstanceTypes) && source.InstanceTypes.length ? source.InstanceTypes : undefined);
  return withoutEmpty({
    ImageId: source.ImageId,
    ImageFamily: source.ImageFamily,
    ProjectId: source.ProjectId,
    InstanceType: overrides.InstanceType || (!instanceTypes ? source.InstanceType : undefined),
    InstanceTypes: instanceTypes,
    SystemDisk: source.SystemDisk,
    DataDisks: overrides.DataDisks || source.DataDisks,
    InternetAccessible: source.InternetAccessible,
    SecurityGroupIds: source.SecurityGroupIds,
    EnhancedService: source.EnhancedService,
    InstanceChargeType: source.InstanceChargeType || "POSTPAID_BY_HOUR",
    InstanceTypesCheckPolicy: source.LastOperationInstanceTypesCheckPolicy || source.InstanceTypesCheckPolicy || "ANY",
    InstanceTags: source.InstanceTags,
    Tags: normalizeTencentCloudTags(source.Tags),
    CamRoleName: source.CamRoleName,
    HostNameSettings: source.HostNameSettings,
    InstanceNameSettings: source.InstanceNameSettings,
    DiskTypePolicy: source.DiskTypePolicy,
    HpcClusterId: source.HpcClusterId,
    DisasterRecoverGroupIds: source.DisasterRecoverGroupIds,
    DedicatedClusterId: source.DedicatedClusterId,
  });
}

export function cloneAutoScalingGroup(source = {}, launchConfigurationId = "", overrides = {}) {
  return withoutEmpty({
    LaunchConfigurationId: launchConfigurationId,
    MaxSize: Number(overrides.MaxSize || 1),
    MinSize: Number(overrides.MinSize || 1),
    DesiredCapacity: Number(overrides.DesiredCapacity || 1),
    VpcId: source.VpcId,
    SubnetIds: source.SubnetIdSet,
    Zones: source.ZoneSet,
    ProjectId: source.ProjectId,
    DefaultCooldown: source.DefaultCooldown,
    TerminationPolicySet: source.TerminationPolicySet,
    RetryPolicy: source.RetryPolicy,
    Tags: normalizeTencentCloudTags(source.Tags),
    ServiceSettings: source.ServiceSettings,
    MultiZoneSubnetPolicy: source.MultiZoneSubnetPolicy,
    HealthCheckType: source.HealthCheckType,
    LoadBalancerHealthCheckGracePeriod: source.LoadBalancerHealthCheckGracePeriod,
    InstanceAllocationPolicy: source.InstanceAllocationPolicy,
    SpotMixedAllocationPolicy: source.SpotMixedAllocationPolicy,
    CapacityRebalance: source.CapacityRebalance,
    InstanceNameIndexSettings: source.InstanceNameIndexSettings,
    HostNameIndexSettings: source.HostNameIndexSettings,
    ConcurrentScaleOutForDesiredCapacity: source.ConcurrentScaleOutForDesiredCapacity,
  });
}
