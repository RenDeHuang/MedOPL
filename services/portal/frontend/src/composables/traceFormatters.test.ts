import { describe, expect, it } from "vitest";
import {
  costEstimateText,
  displayIndex,
  humanizeStatus,
  money,
  rechargeStatusText,
  statusBadge,
} from "./traceFormatters";

describe("traceFormatters", () => {
  it("formats trace cost and display indexes", () => {
    expect(money(9.6)).toBe("9.60 CNY");
    expect(costEstimateText({ costEstimate: { amount: 1.25, currency: "CNY" } } as any)).toBe("1.25 CNY");
    expect(displayIndex(0)).toBe("1");
  });

  it("maps trace status to user-facing copy and badges", () => {
    expect(humanizeStatus("running")).toBe("运行中");
    expect(humanizeStatus("settled")).toBe("已完成");
    expect(humanizeStatus("released")).toBe("已释放");
    expect(statusBadge("failed")).toBe("badge-danger");
    expect(statusBadge("running")).toBe("badge-primary");
  });

  it("keeps recharge state explicit", () => {
    expect(rechargeStatusText("display_only")).toBe("仅展示");
    expect(rechargeStatusText("unknown")).toBe("待估算");
  });
});
