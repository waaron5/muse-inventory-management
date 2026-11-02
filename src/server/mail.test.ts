import { afterEach, describe, expect, it, vi } from "vitest";

const { send, captureException } = vi.hoisted(() => ({
  send: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("resend", () => ({
  Resend: class { emails = { send }; },
}));

import { codeMailerFromEnv, inviteMailerFromEnv } from "./mail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("production mail delivery", () => {
  it("sends codes and invitations from Muse's domain rather than Resend's restricted test sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("MAIL_FROM", "");
    vi.stubEnv("VERCEL", "1");
    send.mockResolvedValue({ data: { id: "sent" }, error: null });

    await codeMailerFromEnv()("invited@museem.com", "123456");
    expect(await inviteMailerFromEnv("https://inventory.museem.com")("invited@museem.com")).toBe(true);

    expect(send).toHaveBeenCalledTimes(2);
    for (const [mail] of send.mock.calls) {
      expect(mail).toMatchObject({ from: "Muse Inventory <no-reply@inventory.museem.com>", to: "invited@museem.com" });
    }
    expect(send.mock.calls[0][0].text).toContain("123456");
  });

  it("honours an explicitly configured sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("MAIL_FROM", "Muse <sign-in@mail.museem.com>");
    send.mockResolvedValue({ data: { id: "sent" }, error: null });

    await codeMailerFromEnv()("invited@museem.com", "123456");

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: "Muse <sign-in@mail.museem.com>" }));
  });
});
