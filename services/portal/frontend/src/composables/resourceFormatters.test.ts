import { describe, expect, it } from "vitest";
import {
  auditStatusText,
  computeSpecText,
  concurrencyText,
  money,
  planLabel,
  protectionEstimateText,
  resourceStatusBadge,
  resourceStatusText,
  storageCapacityText,
  workspaceDisplayName,
} from "./resourceFormatters";

describe("resourceFormatters", () => {
  it("formats money and resource estimates for user-facing cards", () => {
    expect(money(3.2)).toBe("¥3.20");
    expect(protectionEstimateText({ weeklyAmount: 12.5, frozenAmount: 3 } as any)).toBe("¥12.50");
    expect(protectionEstimateText({ frozenAmount: 3 } as any)).toBe("¥3.00");
  });

  it("maps plan ids to clear resource labels without slash-separated copy", () => {
    expect(planLabel("starter_2c4g_10gb")).toBe("基础套餐");
    expect(planLabel("pro_8c16g_100gb")).toBe("Pro 套餐");
    expect(computeSpecText({ serverPlanId: "starter_2c4g_10gb" })).toBe("2 核 4GB");
    expect(computeSpecText({ instanceType: "2 核 / 4GB" })).toBe("2 核 4GB");
    expect(storageCapacityText({ storageCapacityGb: 100 })).toBe("100GB 文件空间");
    expect(concurrencyText("pro_8c16g_100gb")).toBe("2 个任务");
  });

  it("maps resource state to business copy and stable badge classes", () => {
    expect(resourceStatusText("active")).toBe("可用");
    expect(resourceStatusText("matched")).toBe("已核对");
    expect(auditStatusText("done")).toBe("已完成");
    expect(resourceStatusBadge("failed")).toBe("badge-danger");
    expect(resourceStatusBadge("active")).toBe("badge-success");
    expect(workspaceDisplayName("workspace-42")).toBe("工作空间 42");
  });
});
