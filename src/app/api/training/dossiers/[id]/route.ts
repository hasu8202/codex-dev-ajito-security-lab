import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { posts } from "@/db/schema";

// 演習用に意図的に認可を省略している。実アプリ・公開環境には絶対に移さないこと。
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.select({ id: posts.id, body: posts.body, sealed: posts.sealed }).from(posts).where(eq(posts.id, id)).get();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(post);
}
