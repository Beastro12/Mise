import { describe, expect, it } from "vitest";
import { isDue, nextDue } from "@/lib/domain/household";

describe("household refills", () => {
  it("computes the next due date", () => {
    expect(nextDue({ intervalDays: 14, lastBoughtOn: "2026-09-10" })).toBe("2026-09-24");
    expect(nextDue({ intervalDays: 14, lastBoughtOn: null })).toBeNull();
  });
  it("is due when never bought or running out within the coming week", () => {
    expect(isDue({ intervalDays: 21, lastBoughtOn: null, active: true }, "2026-09-25")).toBe(true);
    expect(isDue({ intervalDays: 21, lastBoughtOn: "2026-09-10", active: true }, "2026-09-25")).toBe(true); // due 1.10.
    expect(isDue({ intervalDays: 30, lastBoughtOn: "2026-09-20", active: true }, "2026-09-25")).toBe(false); // due 20.10.
    expect(isDue({ intervalDays: 7, lastBoughtOn: null, active: false }, "2026-09-25")).toBe(false);
  });
});
