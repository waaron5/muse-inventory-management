import { ai } from "@/server/ai";

// AI Connections' MCP server (ADR 0017), over Streamable HTTP.
const serve = (request: Request) => ai.mcp(request);
export { serve as DELETE, serve as GET, serve as OPTIONS, serve as POST };
