import { db } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { getImage } from "@/server/services";

// 画像も会員しか見られない
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const img = await getImage(db, (await params).id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      // 画像は作り直さないので長く持たせる(会員の端末にだけ残る)
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
