import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { createSession, deleteSession, getUserBySession } from "./services";

export const SESSION_COOKIE = "ajito_security_lab_session";

/** いま使っている端末のセッショントークン(ほかの端末だけログアウトさせるときに残す) */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await currentSessionToken();
  if (!token) return null;
  return getUserBySession(db, token);
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 管理人か副管理人だけ。それ以外は掲示板に戻す */
export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin && !user.isModerator) redirect("/");
  return user;
}

export async function startSession(userId: string) {
  const { token } = await createSession(db, userId);
  // expires を付けない=セッションクッキー。ブラウザを閉じるとログインが切れる
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(db, token);
  jar.delete(SESSION_COOKIE);
}
