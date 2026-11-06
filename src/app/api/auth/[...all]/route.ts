import { ai } from "@/server/ai";

// Better Auth's OAuth routes for AI Connections (ADR 0017), and nothing else of it.
const serve = (request: Request) => ai.oauth(request);
export { serve as GET, serve as OPTIONS, serve as POST };
