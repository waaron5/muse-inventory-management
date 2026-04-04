import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  InventoryImageUploadError,
  saveInventoryImageFile,
} from "@/lib/inventory-image-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No image file provided." }, { status: 400 });
  }

  try {
    const imageUrl = await saveInventoryImageFile(file);
    return Response.json({ imageUrl });
  } catch (error) {
    if (error instanceof InventoryImageUploadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error("Inventory image upload failed", error);
    return Response.json(
      { error: "Unable to upload image right now." },
      { status: 500 }
    );
  }
}
