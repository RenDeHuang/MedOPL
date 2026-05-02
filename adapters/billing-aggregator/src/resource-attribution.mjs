function stringValue(value) {
  return String(value ?? "").trim();
}

export function resourceIdCandidates(row = {}) {
  const values = [
    row.ResourceId,
    row.InstanceId,
    row.ResourceName,
    row.ResourceIdName,
    row.ResourceID,
    row["资源ID"],
    row["资源 Id"],
    row["资源ID/实例ID"],
    row["实例ID"],
    row["实例 Id"],
    row["实例ID/资源ID"],
    row["资源名称"],
    row["资源别名"],
    row["资源"],
  ];
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = stringValue(value);
    if (!text || text === "-" || seen.has(text)) continue;
    result.push(text);
    seen.add(text);
  }
  return result;
}

export function buildResourceAttributionIndex(mappings = []) {
  const index = new Map();
  for (const mapping of Array.isArray(mappings) ? mappings : []) {
    const nodePoolId = stringValue(mapping.nodePoolId);
    const clusterId = stringValue(mapping.clusterId);
    const ids = [
      nodePoolId,
      clusterId && nodePoolId ? `${clusterId}_${nodePoolId}` : "",
      clusterId && nodePoolId ? `${clusterId}/${nodePoolId}` : "",
      ...(Array.isArray(mapping.nodePoolIds) ? mapping.nodePoolIds : []),
      ...(Array.isArray(mapping.nodePoolIds) ? mapping.nodePoolIds.map((id) => clusterId && id ? `${clusterId}_${id}` : "") : []),
      ...(Array.isArray(mapping.nodePoolIds) ? mapping.nodePoolIds.map((id) => clusterId && id ? `${clusterId}/${id}` : "") : []),
      ...(Array.isArray(mapping.cvmInstanceIds) ? mapping.cvmInstanceIds : []),
      ...(Array.isArray(mapping.nodeNames) ? mapping.nodeNames : []),
      ...(Array.isArray(mapping.podNames) ? mapping.podNames : []),
      ...(Array.isArray(mapping.jobNames) ? mapping.jobNames : []),
      ...(Array.isArray(mapping.pvcNames) ? mapping.pvcNames : []),
      ...(Array.isArray(mapping.cosKeys) ? mapping.cosKeys : []),
    ].map(stringValue).filter(Boolean);
    for (const id of ids) {
      const current = index.get(id) || [];
      current.push(mapping);
      index.set(id, current);
    }
  }
  return index;
}

function exactMappingAttribution(mapping = {}) {
  const tenantId = stringValue(mapping.tenantId);
  const workspaceId = stringValue(mapping.workspaceId);
  const resourceOrderId = stringValue(mapping.resourceOrderId);
  const runId = stringValue(mapping.runId);
  const serverPlanId = stringValue(mapping.serverPlanId);
  if (!tenantId || !workspaceId || !resourceOrderId || !runId || !serverPlanId) return null;
  return {
    tenantId,
    workspaceId,
    resourceOrderId,
    runId,
    serverPlanId,
  };
}

export function resolveAttributionFromResourceIds(row = {}, index = new Map()) {
  const candidates = resourceIdCandidates(row);
  const matches = [];
  const seenMappingIds = new Set();
  for (const candidate of candidates) {
    for (const mapping of index.get(candidate) || []) {
      const key = stringValue(mapping.id || mapping.resourceOrderId || mapping.runId || JSON.stringify(mapping));
      if (seenMappingIds.has(key)) continue;
      const attribution = exactMappingAttribution(mapping);
      if (!attribution) continue;
      matches.push({ candidate, mapping, attribution });
      seenMappingIds.add(key);
    }
  }
  if (matches.length !== 1) {
    return {
      attributed: false,
      matchCount: matches.length,
      resourceIds: candidates,
    };
  }
  return {
    attributed: true,
    matchCount: 1,
    resourceIds: candidates,
    matchedResourceId: matches[0].candidate,
    mappingId: stringValue(matches[0].mapping.id),
    ...matches[0].attribution,
  };
}

export function applyResourceAttribution(row = {}, index = new Map()) {
  if (row.attributed) return row;
  const resolved = resolveAttributionFromResourceIds(row, index);
  if (!resolved.attributed) {
    return {
      ...row,
      attributionState: resolved.matchCount > 1 ? "resource_mapping_ambiguous" : "unattributed",
      attributionResourceIds: resolved.resourceIds,
      attributionMatchCount: resolved.matchCount,
    };
  }
  return {
    ...row,
    tenantId: resolved.tenantId,
    workspaceId: resolved.workspaceId,
    resourceOrderId: resolved.resourceOrderId,
    runId: resolved.runId,
    serverPlanId: resolved.serverPlanId,
    attributed: true,
    attributionState: "resource_mapping_attributed",
    attributionSource: "resource_mapping",
    attributionResourceIds: resolved.resourceIds,
    matchedResourceId: resolved.matchedResourceId,
    resourceMappingId: resolved.mappingId,
  };
}

export function applyResourceAttributionToRows(rows = [], mappings = []) {
  const index = buildResourceAttributionIndex(mappings);
  return (Array.isArray(rows) ? rows : []).map((row) => applyResourceAttribution(row, index));
}
