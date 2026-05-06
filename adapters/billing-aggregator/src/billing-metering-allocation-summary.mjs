export function createBillingAllocationSummaryRuntime() {
  function zeroTotals() {
    return { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
  }

  function asEntries(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data.flatMap((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return Object.values(item);
        }
        return [];
      });
    }

    if (typeof data === "object") {
      return Object.values(data);
    }

    return [];
  }

  function labelKeyAliases(key = "") {
    const text = String(key || "").trim();
    const compact = text.replace(/_/g, "");
    const dashed = text.replace(/_/g, "-");
    if (!text) return [];
    return [...new Set([text, compact, dashed])];
  }

  function explicitLabelMaps(entry = {}) {
    const properties = entry?.properties && typeof entry.properties === "object" ? entry.properties : {};
    const labels = entry?.labels && typeof entry.labels === "object" ? entry.labels : {};
    const tags = entry?.tags && typeof entry.tags === "object" ? entry.tags : {};
    const propertyLabels = properties.labels && typeof properties.labels === "object" ? properties.labels : {};
    const propertyTags = properties.tags && typeof properties.tags === "object" ? properties.tags : {};

    return {
      properties,
      labels,
      tags,
      propertyLabels,
      propertyTags,
    };
  }

  function labelValue(entry, key) {
    const maps = explicitLabelMaps(entry);

    for (const alias of labelKeyAliases(key)) {
      const value = (
        maps.labels[alias] ||
        maps.tags[alias] ||
        maps.propertyLabels[alias] ||
        maps.propertyTags[alias] ||
        maps.properties[`label:${alias}`] ||
        maps.properties[`tag:${alias}`] ||
        maps.properties[alias] ||
        maps.properties[`gaofenglab/${alias}`] ||
        maps.propertyLabels[`gaofenglab/${alias}`] ||
        maps.propertyTags[`gaofenglab/${alias}`] ||
        null
      );
      if (value) return value;
    }

    return null;
  }

  function attributionKeys(entry = {}) {
    return {
      customerId: labelValue(entry, "customer_id") || labelValue(entry, "tenant_id") || null,
      workspaceId: labelValue(entry, "workspace_id") || null,
      runId: labelValue(entry, "run_id") || null,
    };
  }

  function unattributedEntry(entry, reasons = []) {
    return {
      name: entry?.name || null,
      start: entry?.start || null,
      end: entry?.end || null,
      cpuCost: Number(entry?.cpuCost || 0),
      gpuCost: Number(entry?.gpuCost || 0),
      pvCost: Number(entry?.pvCost || 0),
      totalCost: Number(entry?.totalCost || 0),
      properties: entry?.properties || {},
      reasons,
      attributionState: "unattributed",
    };
  }

  function classifyEntry(entry, customerId = "", workspaceId = "") {
    const keys = attributionKeys(entry);
    const reasons = [];

    if (!keys.customerId) reasons.push("missing_customer_id");
    if (!keys.workspaceId) reasons.push("missing_workspace_id");
    if (!keys.runId) reasons.push("missing_run_id");

    if (reasons.length > 0) {
      return {
        attributed: false,
        matched: false,
        keys,
        unattributed: unattributedEntry(entry, reasons),
      };
    }

    if (customerId && keys.customerId !== customerId) {
      return { attributed: true, matched: false, keys, unattributed: null };
    }
    if (workspaceId && keys.workspaceId !== workspaceId) {
      return { attributed: true, matched: false, keys, unattributed: null };
    }

    return {
      attributed: true,
      matched: true,
      keys,
      unattributed: null,
    };
  }

  function buildSummaryMetadata({ customerId = "", workspaceId = "", itemCount = 0, unattributedItems = [] }) {
    const unattributedCount = unattributedItems.length;
    const warnings = unattributedCount > 0
      ? [{
        code: "unattributed_allocation_entries",
        message: `Found ${unattributedCount} allocation entries without explicit attribution labels.`,
        count: unattributedCount,
      }]
      : [];
    const status = itemCount > 0
      ? (unattributedCount > 0 ? "partial" : "ready")
      : (unattributedCount > 0 ? "unattributed" : "unavailable");

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      source: "local_metering_pending",
      cloudSource: "platform_provisioned_local_metering",
      status,
      warnings,
      errors: [],
      unattributed: {
        source: "local_metering_pending_unattributed",
        status: unattributedCount > 0 ? "unattributed" : "ready",
        itemCount: unattributedCount,
        items: unattributedItems,
      },
    };
  }

  function explainRuns(entries) {
    const grouped = new Map();

    for (const entry of entries) {
      const keys = attributionKeys(entry);
      const current = grouped.get(keys.runId) || {
        runId: keys.runId,
        workspaceId: keys.workspaceId,
        customerId: keys.customerId,
        start: entry?.start || null,
        end: entry?.end || null,
        cpuCost: 0,
        gpuCost: 0,
        pvCost: 0,
        totalCost: 0,
        sources: [],
      };

      current.cpuCost += Number(entry?.cpuCost || 0);
      current.gpuCost += Number(entry?.gpuCost || 0);
      current.pvCost += Number(entry?.pvCost || 0);
      current.totalCost += Number(entry?.totalCost || 0);
      current.sources.push(entry?.name || "allocation");

      if (!current.start || String(entry?.start || "") < String(current.start)) current.start = entry?.start || current.start;
      if (!current.end || String(entry?.end || "") > String(current.end)) current.end = entry?.end || current.end;

      grouped.set(keys.runId, current);
    }

    return [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
  }

  function summarize(entries, customerId, workspaceId = "") {
    const attributedEntries = [];
    const unattributedItems = [];

    for (const entry of entries) {
      const classified = classifyEntry(entry, customerId, workspaceId);
      if (!classified.attributed && classified.unattributed) {
        unattributedItems.push(classified.unattributed);
        continue;
      }
      if (!classified.matched) continue;
      attributedEntries.push(entry);
    }

    const filteredRuns = explainRuns(attributedEntries);
    const totals = attributedEntries.reduce(
      (acc, entry) => {
        acc.cpuCost += Number(entry?.cpuCost || 0);
        acc.gpuCost += Number(entry?.gpuCost || 0);
        acc.pvCost += Number(entry?.pvCost || 0);
        acc.totalCost += Number(entry?.totalCost || 0);
        return acc;
      },
      zeroTotals(),
    );

    return {
      ...buildSummaryMetadata({
        customerId,
        workspaceId,
        itemCount: attributedEntries.length,
        unattributedItems,
      }),
      itemCount: attributedEntries.length,
      totals,
      runs: filteredRuns,
      items: attributedEntries.map((entry) => ({
        name: entry?.name || null,
        start: entry?.start || null,
        end: entry?.end || null,
        cpuCost: Number(entry?.cpuCost || 0),
        gpuCost: Number(entry?.gpuCost || 0),
        pvCost: Number(entry?.pvCost || 0),
        totalCost: Number(entry?.totalCost || 0),
        properties: entry?.properties || {},
      })),
    };
  }

  function summaryFromPendingRuns(runs, customerId = "", workspaceId = "") {
    const totals = runs.reduce(
      (acc, item) => {
        acc.cpuCost += Number(item.cpuCost || 0);
        acc.gpuCost += Number(item.gpuCost || 0);
        acc.pvCost += Number(item.pvCost || 0);
        acc.totalCost += Number(item.totalCost || 0);
        return acc;
      },
      zeroTotals(),
    );

    return {
      ...buildSummaryMetadata({
        customerId,
        workspaceId,
        itemCount: runs.length,
        unattributedItems: [],
      }),
      itemCount: runs.length,
      totals,
      runs,
      items: runs.map((item) => ({
        name: item.runId,
        start: item.start,
        end: item.end,
        cpuCost: item.cpuCost,
        gpuCost: item.gpuCost,
        pvCost: item.pvCost,
        totalCost: item.totalCost,
        properties: {
          customer_id: item.customerId,
          workspace_id: item.workspaceId,
          run_id: item.runId,
          pricing_source: item.pricingSource,
          duration_hours: item.breakdown?.durationHours ?? null,
          cpu_cores: item.breakdown?.cpuCores ?? null,
          gpu_count: item.breakdown?.gpuCount ?? null,
          storage_bytes: item.breakdown?.storageBytes ?? null,
        },
      })),
    };
  }

  function summaryFromRawAllocations(entries, customerId = "", workspaceId = "") {
    const attributedEntries = [];
    const unattributedItems = [];

    for (const entry of entries) {
      const classified = classifyEntry(entry, customerId, workspaceId);
      if (!classified.attributed && classified.unattributed) {
        unattributedItems.push(classified.unattributed);
        continue;
      }
      if (!classified.matched) continue;
      attributedEntries.push(entry);
    }

    const runs = explainRuns(attributedEntries);
    const totals = runs.reduce((acc, item) => {
      acc.cpuCost += Number(item.cpuCost || 0);
      acc.gpuCost += Number(item.gpuCost || 0);
      acc.pvCost += Number(item.pvCost || 0);
      acc.totalCost += Number(item.totalCost || 0);
      return acc;
    }, zeroTotals());

    return {
      ...buildSummaryMetadata({
        customerId,
        workspaceId,
        itemCount: runs.length,
        unattributedItems,
      }),
      itemCount: runs.length,
      totals,
      runs,
      items: runs.map((item) => ({
        name: item.runId,
        start: item.start,
        end: item.end,
        cpuCost: item.cpuCost,
        gpuCost: item.gpuCost,
        pvCost: item.pvCost,
        totalCost: item.totalCost,
        properties: {
          customer_id: item.customerId,
          tenantid: item.customerId,
          workspace_id: item.workspaceId,
          workspaceid: item.workspaceId,
          run_id: item.runId,
          runid: item.runId,
          pricing_source: "platform_provisioned_local_metering",
        },
      })),
    };
  }

  return {
    asEntries,
    summaryFromPendingRuns,
    summaryFromRawAllocations,
    summarize,
  };
}
