import { afterEach, describe, expect, it, vi } from "vitest";
import { lastError, noteError } from "./last-error";

describe("the last error on the page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("goes with a report from the page it was met on, never from one visited since", () => {
    vi.stubGlobal("location", { pathname: "/events/7/load" });
    noteError({ message: "Something went wrong.", trackerId: "2718281828" });
    expect(lastError()).toEqual({ message: "Something went wrong.", trackerId: "2718281828" });

    vi.stubGlobal("location", { pathname: "/inventory" });
    expect(lastError()).toBeUndefined();
  });
});
