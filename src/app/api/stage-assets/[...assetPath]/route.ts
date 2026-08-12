import { STAGE_ASSET_IMAGE_DATA } from "@/lib/assets/image-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetPath: string[] }> },
) {
  const { assetPath } = await params;
  const encoded = STAGE_ASSET_IMAGE_DATA[assetPath.join("/")];
  if (!encoded) return new Response("Asset not found", { status: 404 });
  return new Response(Buffer.from(encoded, "base64"), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
