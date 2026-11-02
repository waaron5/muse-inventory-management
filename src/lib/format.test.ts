import { describe, expect, it } from "vitest";
import { formatDayHeading, formatMonth, formatPrice, formatRowDays, formatShortDays, formatTime } from "./format";

describe("formatPrice", () => {
  it("leaves off the cents when there are none", () => {
    expect(formatPrice(1000)).toBe("$10");
    expect(formatPrice(125000)).toBe("$1,250");
    expect(formatPrice(0)).toBe("$0");
  });

  it("keeps the cents when there are some", () => {
    expect(formatPrice(1050)).toBe("$10.50");
    expect(formatPrice(2499)).toBe("$24.99");
    expect(formatPrice(5)).toBe("$0.05");
  });

  it("reads an unknown Unit Price as $-", () => {
    expect(formatPrice(null)).toBe("$-");
  });
});

describe("formatMonth", () => {
  it("names a calendar date's month and year, never shifted by a time zone", () => {
    expect(formatMonth("2026-11-01")).toBe("November 2026");
    expect(formatMonth("2027-01-31")).toBe("January 2027");
  });
});

describe("formatShortDays", () => {
  it("names a run of days briefly, as a chip reads it", () => {
    expect(formatShortDays("2026-11-12", "2026-11-14")).toBe("Nov 12 – Nov 14");
    expect(formatShortDays("2026-11-12", "2026-11-12")).toBe("Nov 12");
  });
});

describe("formatRowDays", () => {
  it("drops the year, which the month label above the row gives", () => {
    expect(formatRowDays("2026-11-12", "2026-11-14")).toBe("Nov 12 – 14");
    expect(formatRowDays("2026-11-28", "2026-12-02")).toBe("Nov 28 – Dec 2");
    expect(formatRowDays("2026-12-30", "2027-01-02")).toBe("Dec 30 – Jan 2");
  });

  it("reads one day, or an Event missing a date, as that day", () => {
    expect(formatRowDays("2026-11-12", "2026-11-12")).toBe("Nov 12");
    expect(formatRowDays(null, "2026-11-14")).toBe("Nov 14");
    expect(formatRowDays(null, null)).toBe("No dates yet");
  });
});

describe("formatDayHeading", () => {
  it("says Today and Yesterday, then the weekday and date, with the year only when it isn't this one", () => {
    expect(formatDayHeading("2026-10-28", "2026-10-28")).toBe("Today");
    expect(formatDayHeading("2026-10-27", "2026-10-28")).toBe("Yesterday");
    expect(formatDayHeading("2026-10-26", "2026-10-28")).toBe("Mon, Oct 26");
    expect(formatDayHeading("2025-12-31", "2026-01-01")).toBe("Yesterday");
    expect(formatDayHeading("2025-12-30", "2026-01-01")).toBe("Tue, Dec 30, 2025");
  });
});

describe("formatTime", () => {
  it("tells the time in Muse's time zone", () => {
    expect(formatTime(new Date("2026-10-28T21:42:00Z"))).toBe("3:42 PM");
  });
});
