import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { appVersion, sendBugReport } from "../bug-report";
import { answer, refused } from "./answers";
import { takeAiChange, tooManyChanges } from "./change-limit";
import type { AiDeps } from "./mcp-server";

/**
 * Report a bug through an AI app: the same email as Report a bug, replying to
 * the person, with the app named in place of page and device. Nothing is
 * stored, and there's no screenshot. It counts toward the changes an hour, so
 * an AI stuck in a loop can't flood the maintainer's inbox.
 */
export function registerBugReport(server: McpServer, { db, appURL, connection, sendBugMail }: AiDeps) {
  server.registerTool(
    "reportBug",
    {
      title: "Report a bug",
      description:
        "Emails a bug report to Muse Inventory's maintainer, who replies to the person by email. Use it when the person asks to report a bug or a problem, with this connection or with Muse Inventory.",
      inputSchema: z.object({
        what: z
          .string()
          .describe("What happened, as the person said it, and what they tried: their words, summarised. The first line is the email's subject."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ what }) => {
      if (!(await takeAiChange(db, connection))) return tooManyChanges(appURL);
      const result = await sendBugReport(sendBugMail, connection, { what, via: connection.appName }, { at: new Date(), version: appVersion });
      if (result.error) return refused(result.error);
      return answer({ sent: `Sent to Muse Inventory's maintainer, who replies to ${connection.email}.` });
    },
  );
}
