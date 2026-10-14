import { describe, expect, it } from "vitest";
import { formatDateTime, parseColomboLocal, toColomboInputValue } from "@/lib/time";

describe("Sri Lanka time handling (independent of the machine's time zone)", () => {
  it("reads typed times as Asia/Colombo (UTC+05:30)", () => {
    expect(parseColomboLocal("2031-01-01T10:00")?.toISOString()).toBe("2031-01-01T04:30:00.000Z");
    expect(parseColomboLocal("2031-01-01T00:15")?.toISOString()).toBe("2030-12-31T18:45:00.000Z");
  });
  it("round-trips through the input format", () => {
    const value = "2031-06-15T23:45";
    expect(toColomboInputValue(parseColomboLocal(value)!)).toBe(value);
  });
  it("rejects malformed and impossible values", () => {
    for (const v of ["", "garbage", "2031-02-30T10:00", "2031-13-01T10:00", "2031-01-01T25:00", "2031-01-01 10:00", "2031-01-01T10:00:00"]) {
      expect(parseColomboLocal(v)).toBeNull();
    }
  });
  it("displays in Colombo time", () => {
    expect(formatDateTime("2031-01-01T04:30:00Z")).toContain("10:00");
  });
});