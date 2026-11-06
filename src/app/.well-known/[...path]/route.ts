import { ai } from "@/server/ai";

// Where AI apps discover how to connect (RFC 9728, RFC 8414).
const serve = (request: Request) => ai.oauth(request);
export { serve as GET, serve as OPTIONS };
