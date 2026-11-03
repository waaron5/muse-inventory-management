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

import { codeMailerFromEnv, inviteMailerFromEnv, mailGoesToOutbox } from "./mail";

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

    await codeMailerFromEnv("https://inventory.museem.com")("invited@museem.com", "123456");
    expect(await inviteMailerFromEnv("https://inventory.museem.com")("invited@museem.com")).toBe("emailed");

    expect(send).toHaveBeenCalledTimes(2);
    for (const [mail] of send.mock.calls) {
      expect(mail).toMatchObject({ from: "Muse Inventory <no-reply@inventory.museem.com>", to: "invited@museem.com" });
    }
    expect(send.mock.calls[0][0].text).toContain("123456");
    // The HTML shows the code too, under a header served from the app.
    expect(send.mock.calls[0][0].html).toContain(">123456<");
    expect(send.mock.calls[0][0].html).toContain('src="https://inventory.museem.com/email/code-header.png"');
  });

  it("honours an explicitly configured sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("MAIL_FROM", "Muse <sign-in@mail.museem.com>");
    send.mockResolvedValue({ data: { id: "sent" }, error: null });

    await codeMailerFromEnv("https://inventory.museem.com")("invited@museem.com", "123456");

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: "Muse <sign-in@mail.museem.com>" }));
  });

  it("says an invite Resend refused didn't go", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "domain is not verified" } });

    expect(await inviteMailerFromEnv("https://inventory.museem.com")("invited@museem.com")).toBe("failed");
    expect(captureException).toHaveBeenCalledOnce();
  });
});

describe("mail on a laptop", () => {
  it("only reaches the local outbox without a Resend key, and says so", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL", "");

    expect(mailGoesToOutbox()).toBe(true);
    expect(await inviteMailerFromEnv("http://localhost:3000")("invited@museem.com")).toBe("outbox");
    expect(send).not.toHaveBeenCalled();
  });

  it("is real email once a Resend key is set, and never the outbox on Vercel", () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    expect(mailGoesToOutbox()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VERCEL", "1");
    expect(mailGoesToOutbox()).toBe(false);
  });
});
