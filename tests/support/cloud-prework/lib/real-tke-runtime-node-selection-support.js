function instanceConfigCpu(config = {}) {
  return Number(config.CPU ?? config.Cpu ?? config.CpuCores ?? config.CpuCoreCount);
}

function instanceConfigMemory(config = {}) {
  return Number(config.Memory ?? config.Mem ?? config.MemoryGb ?? config.MemorySize);
}

function stockStatusScore(config = {}, hasStockSignal = false) {
  const raw = String(config.StatusCategory || config.Status || config.SaleStatus || "")
    .trim()
    .toLowerCase();
  if (!raw) return hasStockSignal ? 20 : 5;
  if (/enough|normal|available|sell|售卖|充足|有保障/u.test(raw)) return raw.includes("normal") ? 1 : 0;
  if (/under|limited|少量|即将/u.test(raw)) return 4;
  if (/without|sold|sellout|unavailable|offline|closed|unsupported|无货|售罄|不可用/u.test(raw)) return 100;
  return 10;
}

function buildStockStatusIndex(stockConfigs = [], allowedZones = []) {
  const zones = new Set((Array.isArray(allowedZones) ? allowedZones : []).filter(Boolean));
  const index = new Map();
  for (const config of Array.isArray(stockConfigs) ? stockConfigs : []) {
    const instanceType = String(config.InstanceType || "").trim();
    if (!instanceType) continue;
    if (zones.size && config.Zone && !zones.has(config.Zone)) continue;
    const previous = index.get(instanceType);
    const score = stockStatusScore(config, true);
    if (!previous || score < previous.score) index.set(instanceType, { score });
  }
  return index;
}

export function pickInstanceType(configs = [], tier = {}, allowedZones = [], stockConfigs = []) {
  const zones = new Set((Array.isArray(allowedZones) ? allowedZones : []).filter(Boolean));
  const nativeCvmFamilyPriority = ["S5", "S8", "S9e", "S3", "SA2", "SA3", "SA4", "SA5", "M8", "M3", "MA5", "MA4", "MA3", "BF1", "ITA5", "TGN7", "BMG5t", "S2"];
  const nativeCvmFamilyOrder = new Map(nativeCvmFamilyPriority.map((family, index) => [family, index]));
  const nativeCvmSupportedFamily = /^(?:BF1|BMG5t|ITA5|M3|M8|MA3|MA4|MA5|S2|S3|S5|S8|S9e|SA2|SA3|SA4|SA5|TGN7)\./u;
  const familyPrefix = (instanceType = "") => String(instanceType).split(".")[0];
  const stockStatusByType = buildStockStatusIndex(stockConfigs, allowedZones);
  const hasStockSignal = stockStatusByType.size > 0;
  const candidates = (Array.isArray(configs) ? configs : [])
    .filter((config) => instanceConfigCpu(config) === Number(tier.cpuCores) && instanceConfigMemory(config) === Number(tier.memoryGb))
    .filter((config) => !zones.size || !config.Zone || zones.has(config.Zone))
    .map((config) => {
      const instanceType = String(config.InstanceType || "").trim();
      const stock = stockStatusByType.get(instanceType);
      return {
        instanceType,
        stockScore: stock?.score ?? stockStatusScore(config, hasStockSignal),
      };
    })
    .filter((candidate) => candidate.instanceType)
    .filter((candidate) => nativeCvmSupportedFamily.test(candidate.instanceType))
    .filter((candidate) => candidate.stockScore < 100)
    .sort((leftCandidate, rightCandidate) => {
      if (leftCandidate.stockScore !== rightCandidate.stockScore) return leftCandidate.stockScore - rightCandidate.stockScore;
      const left = leftCandidate.instanceType;
      const right = rightCandidate.instanceType;
      const leftFamilyOrder = nativeCvmFamilyOrder.get(familyPrefix(left)) ?? 99;
      const rightFamilyOrder = nativeCvmFamilyOrder.get(familyPrefix(right)) ?? 99;
      if (leftFamilyOrder !== rightFamilyOrder) return leftFamilyOrder - rightFamilyOrder;
      return left.localeCompare(right);
    });
  return candidates[0]?.instanceType || "";
}

export function pickImage(images = [], pattern = "") {
  const normalizedPattern = String(pattern || "").trim().toLowerCase();
  const candidates = (Array.isArray(images) ? images : [])
    .filter((image) => String(image.ImageId || "").trim())
    .filter((image) => !image.ImageState || String(image.ImageState).toUpperCase() === "NORMAL")
    .filter((image) => {
      if (!normalizedPattern) return true;
      return `${image.ImageName || ""} ${image.OsName || ""} ${image.Platform || ""}`.toLowerCase().includes(normalizedPattern);
    })
    .map((image) => String(image.ImageId || "").trim())
    .sort();
  return candidates[0] || "";
}

export function pickSecurityGroup(securityGroups = [], vpcId = "") {
  const candidates = (Array.isArray(securityGroups) ? securityGroups : [])
    .filter((group) => String(group.SecurityGroupId || "").trim())
    .filter((group) => !vpcId || !group.VpcId || group.VpcId === vpcId)
    .sort((left, right) => {
      const leftName = String(left.SecurityGroupName || left.GroupName || "").toLowerCase();
      const rightName = String(right.SecurityGroupName || right.GroupName || "").toLowerCase();
      const leftPreferred = /medopl|runtime|tke|default/u.test(leftName) ? 0 : 1;
      const rightPreferred = /medopl|runtime|tke|default/u.test(rightName) ? 0 : 1;
      if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
      return String(left.SecurityGroupId).localeCompare(String(right.SecurityGroupId));
    });
  return String(candidates[0]?.SecurityGroupId || "").trim();
}

export function securityGroupDiscoveryRequest(securityGroupId = "") {
  return securityGroupId ? { SecurityGroupIds: [securityGroupId] } : { Limit: "100" };
}

export function pickZone(configs = [], allowedZones = []) {
  const zones = new Set((Array.isArray(allowedZones) ? allowedZones : []).filter(Boolean));
  const candidates = (Array.isArray(configs) ? configs : [])
    .map((config) => String(config.Zone || "").trim())
    .filter((zone) => zone && (!zones.size || zones.has(zone)))
    .sort();
  return candidates[0] || "";
}
