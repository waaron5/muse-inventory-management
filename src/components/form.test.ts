import { describe, expect, it } from "vitest";
import { lastError } from "@/lib/last-error";
import { failsInline, keepPrice } from "./form";

type State = { error?: string; values?: Record<string, string>; done?: boolean };

describe("a form action that fails inline", () => {
  const form = new FormData();
  form.set("name", "Chalkboard");

  it("passes the action's own result through", async () => {
    const action = failsInline<State>(async () => ({ error: "Enter a name." }));
    expect(await action({}, form)).toEqual({ error: "Enter a name." });
  });

  it("turns a failure into a message beside the form, keeping what was typed and the error for a report", async () => {
    const failed = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "2718281828" });
    const action = failsInline<State>(async () => {
      throw failed;
    });

    expect(await action({ done: false }, form)).toEqual({
      done: false,
      error: "Something went wrong. Try again.",
      values: { name: "Chalkboard" },
    });
    expect(lastError()).toEqual({ message: failed.message, trackerId: "2718281828" });
  });

  it("lets a redirect through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/events;303;" });
    const action = failsInline<State>(async () => {
      throw redirect;
    });
    await expect(action({}, form)).rejects.toBe(redirect);
  });
});

describe("keepPrice", () => {
  it("keeps digits and one decimal point", () => {
    expect(keepPrice("24.99")).toBe("24.99");
    expect(keepPrice("10")).toBe("10");
    expect(keepPrice("10.")).toBe("10.");
  });

  it("drops anything that isn't part of a price", () => {
    expect(keepPrice("$1,250")).toBe("1250");
    expect(keepPrice("ten")).toBe("");
    expect(keepPrice("1e3")).toBe("13");
    expect(keepPrice("-5")).toBe("5");
  });

  it("allows one decimal point and two places after it", () => {
    expect(keepPrice("1.2.3")).toBe("1.23");
    expect(keepPrice("1250.505")).toBe("1250.50");
  });
});
