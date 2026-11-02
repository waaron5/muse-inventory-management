import { expect, it } from "vitest";
import { monthOccurrence } from "./month-filter";

it("uses the current or next month on Upcoming, the current or most recent on Past", () => {
  expect(monthOccurrence(10, "2026-10-28")).toBe("2026-10");
  expect(monthOccurrence(9, "2026-10-28")).toBe("2027-09");
  expect(monthOccurrence(9, "2026-10-28", true)).toBe("2026-09");
  expect(monthOccurrence(11, "2026-10-28", true)).toBe("2025-11");
  expect(monthOccurrence(12, "2026-01-01", true)).toBe("2025-12");
  expect(monthOccurrence(1, "2026-12-31")).toBe("2027-01");
});
