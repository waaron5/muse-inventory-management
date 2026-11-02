import type { Db } from "@/db/types";
import { createAuth } from "@/server/auth/create-auth";

/** Better Auth on the test database, with every code it emails kept in an outbox. */
export function testAuth(db: Db) {
  const sent: { to: string; code: string }[] = [];
  const auth = createAuth({
    db,
    secret: "test-secret-at-least-32-characters-long",
    baseURL: "http://localhost:3000",
    sendCodeEmail: async (to, code) => {
      sent.push({ to, code });
    },
  });
  const outbox = {
    sent,
    codeFor(to: string) {
      const last = sent.findLast((mail) => mail.to === to);
      if (!last) throw new Error(`No code was emailed to ${to}`);
      return last.code;
    },
  };
  return { auth, outbox };
}
