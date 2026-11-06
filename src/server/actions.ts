"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, posts } from "@/db/schema";
import {
  commentSchema,
  firstError,
  groupSchema,
  loginSchema,
  messageSchema,
  passwordSchema,
  postSchema,
  profileSchema,
  signupSchema,
} from "@/lib/validation";
import { currentSessionToken, endSession, requireStaff, requireUser, startSession } from "./auth";
import * as svc from "./services";

export type FormState = { error?: string; ok?: boolean } | undefined;

function fail(e: unknown): FormState {
  if (e instanceof svc.ServiceError) return { error: e.message };
  throw e;
}

// 書き込みの回数制限(10分あたり、1人ごと)。会員がプログラムで連投して荒らしたり DB を埋めたりするのを防ぐ。
// 普段の使い方では届かない回数にしてある
// password は今のパスワードの確認(盗んだセッションから総当たりされないように)
const WRITE_LIMITS = { post: 10, comment: 30, message: 60, like: 60, image: 10, group: 3, password: 5 } as const;


async function throttle(userId: string, kind: keyof typeof WRITE_LIMITS) {
  if (!(await svc.hitRateLimit(db, `w:${kind}:${userId}`, WRITE_LIMITS[kind]))) {
    throw new svc.ServiceError("短い間に続けすぎです。少し時間をおいてからもう一度どうぞ");
  }
}

async function readImage(ownerId: string, value: FormDataEntryValue | null): Promise<string | undefined> {
  if (!(value instanceof File) || value.size === 0) return undefined;
  await throttle(ownerId, "image");
  return svc.saveImage(db, ownerId, value.type, Buffer.from(await value.arrayBuffer()));
}

// ───────── 入会・ログイン ─────────

// 総当たりを抑える。回数は DB の rate_limits 表で数える(services の hitRateLimit)。
// - IDごと(接続元によらない、実在しないIDも同じ扱い): 20回/10分。1つのIDは試し放題にならない
// 接続元が信頼できるときだけ、さらに:
// - 接続元+ID: 5回。他人が失敗を重ねても、本人の接続元からはまだ入れる
// - 接続元の合計: 30回。多数のIDを順に試すやり方を止める
// 接続元が分からない環境で全体の上限を置かないのは、1人の失敗で全員が締め出されるのを避けるため。
// その場合でも、試せる回数は「メンバー数 × 20回」までに収まる。
const MAX_PER_PAIR = 5;
const MAX_PER_IP = 30;
const MAX_PER_HANDLE = 20;
const MAX_SIGNUP_PER_IP = 10;

/**
 * 接続元。X-Forwarded-For は利用者が自由に書けるので、公開先がこの値を上書きしてくれる
 * ときだけ信じる(Vercel は自動で VERCEL=1。ほかの公開先では TRUST_PROXY=1 を設定する)。
 * Cloudflare Workers(wrangler.jsonc の ON_CLOUDFLARE=1)では、Cloudflare が必ず上書きする
 * cf-connecting-ip を使う。信頼できない環境では null(接続元ごとの制限は使わない)。
 * 信頼できるのに値が無いときは 1つの共有枠 "unknown" に入れて、制限をすり抜けられないようにする。
 */
async function clientIp(): Promise<string | null> {
  if (process.env.ON_CLOUDFLARE === "1") return (await headers()).get("cf-connecting-ip") || "unknown";
  if (process.env.VERCEL !== "1" && process.env.TRUST_PROXY !== "1") return null;
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  // 合言葉の総当たりとパスワード計算の連打を抑える(接続元が分かるときだけ)
  const ip = await clientIp();
  if (ip && !(await svc.hitRateLimit(db, `s:${ip}`, MAX_SIGNUP_PER_IP))) {
    return { error: "失敗が続いたので10分ほど待ってからもう一度試してください" };
  }
  let userId: string;
  try {
    userId = (await svc.registerWithInvite(db, parsed.data)).id;
  } catch (e) {
    return fail(e);
  }
  await startSession(userId);
  redirect("/");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { handle, password } = parsed.data;

  const tooMany = { error: "失敗が続いたので10分ほど待ってからもう一度試してください" };
  await svc.pruneRateLimits(db);
  const ip = await clientIp();
  const handleKey = `h:${handle}`;
  const pairKey = ip ? `p:${ip}|${handle}` : null;
  // パスワードを確かめる前に数える。実在するIDかどうかで数え方を変えない(IDの有無を悟らせない)
  if (ip && !(await svc.hitRateLimit(db, `ip:${ip}`, MAX_PER_IP))) return tooMany;
  if (pairKey && !(await svc.hitRateLimit(db, pairKey, MAX_PER_PAIR))) return tooMany;
  if (!(await svc.hitRateLimit(db, handleKey, MAX_PER_HANDLE))) return tooMany;

  let user;
  try {
    user = await svc.authenticate(db, handle, password);
  } catch (e) {
    return fail(e);
  }
  if (!user) return { error: "IDかパスワードが違います" };
  await svc.clearRateLimit(db, pairKey ? [pairKey, handleKey] : [handleKey]);
  await startSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

// ───────── 掲示板 ─────────

export async function createPostAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = postSchema.safeParse({
    body: form.get("body") ?? "",
    sealed: form.get("sealed") === "on",
    answersPrompt: form.get("answersPrompt") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await throttle(me.id, "post");
    const imageId = await readImage(me.id, form.get("image"));
    await svc.createPost(db, me.id, { ...parsed.data, imageId });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deletePostAction(postId: string) {
  const me = await requireUser();
  // 本人は自分の情報を、管理人・副管理人は(自分より下の位の)他人の情報を消せる
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (post && post.authorId !== me.id && svc.isStaff(me)) await svc.moderateDeletePost(db, me, postId);
  else await svc.deletePost(db, me.id, postId);
  revalidatePath("/", "layout");
}

export async function toggleLikeAction(postId: string): Promise<boolean> {
  const me = await requireUser();
  await throttle(me.id, "like");
  const liked = await svc.toggleLike(db, me.id, postId);
  revalidatePath(`/posts/${postId}`);
  return liked;
}

export async function addCommentAction(postId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = commentSchema.safeParse(form.get("body") ?? "");
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await throttle(me.id, "comment");
    await svc.addComment(db, me.id, postId, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function deleteCommentAction(commentId: string, postId: string) {
  const me = await requireUser();
  const [comment] = await db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, commentId));
  if (comment && comment.authorId !== me.id && svc.isStaff(me)) await svc.moderateDeleteComment(db, me, commentId);
  else await svc.deleteComment(db, me.id, commentId);
  revalidatePath(`/posts/${postId}`);
}

// ───────── 合言葉・プロフィール ─────────

export async function createInviteAction(): Promise<FormState> {
  const me = await requireUser();
  try {
    if (!me.isAdmin && !(await svc.hitRateLimit(db, `w:invite:${me.id}`, svc.MAX_INVITES_PER_DAY, Date.now(), 86_400_000))) {
      throw new svc.ServiceError(`合言葉を作れるのは1日${svc.MAX_INVITES_PER_DAY}つまでです。明日またどうぞ`);
    }
    await svc.createInvite(db, me.id, me.isAdmin);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/me");
  return { ok: true };
}

export async function revokeInviteAction(code: string) {
  const me = await requireUser();
  await svc.revokeInvite(db, me.id, code);
  revalidatePath("/me");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = profileSchema.safeParse({
    name: form.get("name") ?? "",
    bio: form.get("bio") ?? "",
    titleKey: form.get("titleKey") ?? "newcomer",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    // 先に称号を確かめ、失敗したときに画像だけ残らないようにする
    await svc.updateProfile(db, me.id, parsed.data);
    const avatarImageId = await readImage(me.id, form.get("avatar"));
    if (avatarImageId) {
      await svc.updateProfile(db, me.id, { ...parsed.data, avatarImageId });
      // 古いアイコンは誰からも参照されないので消す(保存枠を空ける)
      if (me.avatarImageId) await svc.deleteImage(db, me.id, me.avatarImageId);
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const parsed = passwordSchema.safeParse(String(form.get("next") ?? ""));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data !== form.get("confirm")) return { error: "新しいパスワードが確認用と一致しません" };
  const token = await currentSessionToken();
  if (!token) redirect("/login");
  try {
    await throttle(me.id, "password");
    await svc.changePassword(db, me.id, current, parsed.data, token);
  } catch (e) {
    return fail(e);
  }
  return { ok: true };
}

export async function logoutOtherSessionsAction(): Promise<FormState> {
  const me = await requireUser();
  const token = await currentSessionToken();
  if (!token) redirect("/login");
  await svc.deleteOtherSessions(db, me.id, token);
  return { ok: true };
}

// ───────── ブロック ─────────

export async function blockUserAction(otherId: string) {
  const me = await requireUser();
  try {
    await svc.blockUser(db, me.id, otherId);
  } catch (e) {
    fail(e);
  }
  revalidatePath("/", "layout");
}

export async function unblockUserAction(otherId: string) {
  const me = await requireUser();
  await svc.unblockUser(db, me.id, otherId);
  revalidatePath("/", "layout");
}

// ───────── 密談 ─────────

export async function leaveRoomAction(roomId: string) {
  const me = await requireUser();
  try {
    await svc.leaveRoom(db, me.id, roomId);
  } catch (e) {
    fail(e);
    return;
  }
  revalidatePath("/rooms");
  redirect("/rooms");
}

export async function openDirectRoomAction(otherId: string) {
  const me = await requireUser();
  let roomId: string;
  try {
    roomId = await svc.openDirectRoom(db, me.id, otherId);
  } catch (e) {
    fail(e);
    redirect("/rooms?unavailable=1");
  }
  redirect(`/rooms/${roomId}`);
}

export async function createGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = groupSchema.safeParse({
    name: form.get("name") ?? "",
    memberIds: form.getAll("memberIds").map(String),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  let roomId: string;
  try {
    await throttle(me.id, "group");
    roomId = await svc.createGroupRoom(db, me.id, parsed.data.name, parsed.data.memberIds);
  } catch (e) {
    return fail(e);
  }
  redirect(`/rooms/${roomId}`);
}

export async function sendMessageAction(roomId: string, body: string): Promise<FormState> {
  const me = await requireUser();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await throttle(me.id, "message");
    await svc.sendMessage(db, me.id, roomId, parsed.data);
  } catch (e) {
    return fail(e);
  }
  return { ok: true };
}

/** afterMs より後の話だけを返す */
export async function fetchMessagesAction(roomId: string, afterMs?: number) {
  const me = await requireUser();
  const rows = await svc.getMessages(db, me.id, roomId, afterMs ? new Date(afterMs) : undefined);
  return rows.map((m) => ({ ...m, createdAt: m.createdAt.getTime() }));
}

// ───────── 知らせ ─────────

// 画面は再描画しない(開いた画面では未読の色を残し、次に開いたときに消える)
export async function markNotificationsReadAction() {
  const me = await requireUser();
  await svc.markNotificationsRead(db, me.id);
}

export async function fetchBadgesAction() {
  const me = await requireUser();
  const b = await svc.getBadges(db, me.id);
  return { notifications: Number(b.notifications), rooms: Number(b.rooms) };
}

// ───────── 管理 ─────────

// 入口では管理側かどうかだけ見る。位の比較(自分より下の人にだけ)は services 側でも必ず行う

export async function banUserAction(targetId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  try {
    await svc.banUser(
      db,
      me,
      targetId,
      String(form.get("reason") ?? ""),
      form.get("deleteContent") === "on",
      form.get("withInvitees") === "on",
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function unbanUserAction(targetId: string) {
  const me = await requireStaff();
  try {
    await svc.unbanUser(db, me, targetId);
  } catch (e) {
    fail(e); // 画面に出す先が無いので、権限の足りない操作は何も起こさず一覧を読み直す
  }
  revalidatePath("/admin");
}

export async function setRoleAction(targetId: string, role: svc.Role) {
  const me = await requireStaff();
  if (!["member", "moderator", "admin"].includes(role)) return;
  try {
    await svc.setRole(db, me, targetId, role);
  } catch (e) {
    fail(e);
  }
  revalidatePath("/", "layout");
}

export async function setCustomTitleAction(targetId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  try {
    await svc.setCustomTitle(db, me, targetId, String(form.get("title") ?? ""));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function postAnnouncementAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireStaff();
  try {
    await svc.postAnnouncement(db, me, String(form.get("body") ?? ""));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearAnnouncementsAction() {
  const me = await requireStaff();
  try {
    await svc.clearAnnouncements(db, me);
  } catch (e) {
    fail(e);
  }
  revalidatePath("/", "layout");
}
