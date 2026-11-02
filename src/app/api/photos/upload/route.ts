import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { photoPathPattern } from "@/lib/photos";
import { currentSession } from "@/server/auth";

// The browser uploads photos straight to Blob storage, already made JPEG. This
// hands it a token for one copy of one new photo; a command then records it.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await currentSession())) throw new Error("Sign in again to continue.");
        if (!photoPathPattern.test(pathname)) throw new Error("That isn't a photo's name.");
        return {
          allowedContentTypes: ["image/jpeg"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The upload was refused." }, { status: 400 });
  }
}
