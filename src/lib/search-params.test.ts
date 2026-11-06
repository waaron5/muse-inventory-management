import { describe, expect, it } from "vitest";
import { asSearchParams } from "./search-params";

describe("asSearchParams", () => {
  it("keeps repeated keys, in order, and drops missing ones", () => {
    expect(asSearchParams({ client_id: "abc", ba_param: ["exp", "sig"], state: undefined }).toString()).toBe(
      "client_id=abc&ba_param=exp&ba_param=sig",
    );
  });
});
