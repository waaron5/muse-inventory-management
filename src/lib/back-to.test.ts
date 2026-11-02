import { describe, expect, it } from "vitest";
import { backTo, safeBack } from "./back-to";

function form(back?: string) {
  const data = new FormData();
  if (back !== undefined) data.set("back", back);
  return data;
}

describe("backTo", () => {
  it("goes back to a path in the app", () => {
    expect(backTo(form("/events?tab=past"), "/events/1")).toBe("/events?tab=past");
  });

  it("falls back when there's nowhere to go back to", () => {
    expect(backTo(form(), "/events/1")).toBe("/events/1");
    expect(backTo(form(""), "/events/1")).toBe("/events/1");
  });

  it("never leaves the app", () => {
    for (const back of ["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)"]) {
      expect(safeBack(back)).toBeUndefined();
    }
  });
});
