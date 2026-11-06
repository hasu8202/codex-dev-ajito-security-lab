import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "@/db/client";
import {
  adminLogs,
  announcements,
  blocks,
  comments,
  images,
  invites,
  likes,
  messages,
  notifications,
  posts,
  rateLimits,
  roomMembers,
  rooms,
  sessions,
  users,
  type User,
} from "@/db/schema";
import { hashToken, newId, newInviteCode, newSessionToken, normalizeInviteCode } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/password";
import { jstDate } from "@/lib/prompts";
import { earnedTitleKeys, type UserStats } from "@/lib/titles";

/** 画面にそのまま出してよい失敗 */
export class ServiceError extends Error {}

// 毎回ログインを求める方針(2026-11-06)。クッキーはブラウザを閉じると消え、サーバー側も12時間で切れる
export const SESSION_HOURS = 12;
export const MAX_OPEN_INVITES = 3;
// 1日に作れる合言葉の数(管理人は除く)。使っては作り直して捨てアカウントを量産されないように
export const MAX_INVITES_PER_DAY = 5;

// ───────── 入会・ログイン ─────────

export async function registerWithInvite(
  db: Db,
  input: { code: string; handle: string; name: string; password: string },
): Promise<User> {
  const code = normalizeInviteCode(input.code);
  const passwordHash = await hashPassword(input.password);

  const inviteError = "その合言葉は使えません。紹介してくれた人に確かめてください";
  const handleError = "そのIDはもう使われています";

  // 先に分かる失敗は、ここで分かりやすく返す
  const [invite] = await db.select().from(invites).where(eq(invites.code, code));
  if (!invite || invite.usedBy) throw new ServiceError(inviteError);
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, input.handle));
  if (taken) throw new ServiceError(handleError);

  // 本番の D1 は対話的なトランザクションが使えないため、条件付きの3文を batch(全部か無しか)で流す。
  // 合言葉が未使用でIDも空いているときだけ会員を作り、作れたときだけ合言葉を使用済みにする
  const id = newId();
  const now = Date.now();
  // (D1 の batch は db.run(sql) を受け付けないので、すべてクエリビルダーで書く。
  // INSERT…SELECT は表の全列を定義の順に並べる決まり)
  const lit = <T>(value: unknown, as: string) => sql<T>`${value}`.as(as);
  const none = <T>(as: string) => sql<T>`NULL`.as(as);
  await db.batch([
    db
      .insert(users)
      .select(
        db
          .select({
            id: lit<string>(id, "id"),
            handle: lit<string>(input.handle, "handle"),
            name: lit<string>(input.name, "name"),
            passwordHash: lit<string>(passwordHash, "password_hash"),
            bio: lit<string>("", "bio"),
            avatarImageId: none<string | null>("avatar_image_id"),
            titleKey: lit<string>("newcomer", "title_key"),
            invitedBy: invites.createdBy,
            // 最初の1人が管理人になる
            isAdmin: sql<boolean>`(SELECT count(*) FROM "users") = 0`.as("is_admin"),
            createdAt: lit<Date>(now, "created_at"),
            isModerator: lit<boolean>(0, "is_moderator"),
            customTitle: none<string | null>("custom_title"),
            bannedAt: none<Date | null>("banned_at"),
            banReason: none<string | null>("ban_reason"),
          })
          .from(invites)
          .where(and(eq(invites.code, code), isNull(invites.usedBy))),
      )
      .onConflictDoNothing({ target: users.handle }),
    db
      .update(invites)
      .set({ usedBy: id, usedAt: new Date(now) })
      .where(
        and(
          eq(invites.code, code),
          isNull(invites.usedBy),
          sql`EXISTS (SELECT 1 FROM "users" u WHERE u."id" = ${id})`,
        ),
      ),
    db
      .insert(notifications)
      .select(
        db
          .select({
            id: lit<string>(newId(), "id"),
            userId: sql<string>`${invites.createdBy}`.as("user_id"),
            kind: lit<"joined">("joined", "kind"),
            actorId: lit<string>(id, "actor_id"),
            postId: none<string | null>("post_id"),
            commentId: none<string | null>("comment_id"),
            detail: none<string | null>("detail"),
            readAt: none<Date | null>("read_at"),
            createdAt: lit<Date>(now, "created_at"),
          })
          .from(invites)
          .where(and(eq(invites.code, code), eq(invites.usedBy, id), sql`${invites.createdBy} IS NOT NULL`)),
      ),
  ]);

  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    // 同時に同じ合言葉かIDで入会したときは、後の方をここで止める
    const [again] = await db.select().from(invites).where(eq(invites.code, code));
    throw new ServiceError(!again || again.usedBy ? inviteError : handleError);
  }

  if (user.invitedBy) await checkTitles(db, user.invitedBy);
  return user;
}

// ───────── ログインの試行制限 ─────────

export const RATE_WINDOW_MS = 10 * 60_000;

/**
 * 試行を1回数え、上限以内なら true。数えるのと判定は1文の UPSERT で行うので、
 * 並列で送られても上限を越えない。期限が切れた記録はその場で1から数え直す。
 */
export async function hitRateLimit(
  db: Db,
  key: string,
  max: number,
  now = Date.now(),
  windowMs = RATE_WINDOW_MS,
): Promise<boolean> {
  const until = now + windowMs;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, until })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when "rate_limits"."until" <= ${now} then 1 else "rate_limits"."count" + 1 end`,
        until: sql`case when "rate_limits"."until" <= ${now} then ${until} else "rate_limits"."until" end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= max;
}

export async function clearRateLimit(db: Db, keys: string[]): Promise<void> {
  if (keys.length) await db.delete(rateLimits).where(inArray(rateLimits.key, keys));
}

/** 期限切れの記録を消す(表が膨らみ続けないように) */
export async function pruneRateLimits(db: Db, now = Date.now()): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.until, now));
}

export async function authenticate(db: Db, handle: string, password: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.handle, handle));
  if (!user) {
    // ID の有無を時間差で悟られないよう、同じ重さの計算をしておく
    await verifyPassword(password, "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  // パスワードが合っていた人にだけ、停止中であることを伝える(IDの有無は悟らせない)
  if (user.bannedAt) {
    throw new ServiceError(
      `このアカウントは管理人により停止されています${user.banReason ? `(理由: ${user.banReason})` : ""}`,
    );
  }
  return user;
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  // ログインのついでに期限切れのセッションを掃除する(友達規模なら表は小さい)
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySession(db: Db, token: string): Promise<User | null> {
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)));
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  if (row.user.bannedAt) return null;
  return row.user;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** いま使っている端末(keepToken)以外のセッションを全部消す。乗っ取られたかもしれないときの逃げ道 */
export async function deleteOtherSessions(db: Db, userId: string, keepToken: string): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(keepToken))));
}

/** 今のパスワードを確かめてから変える。ほかの端末のセッションは消す(盗まれたセッションも切れる) */
export async function changePassword(
  db: Db,
  userId: string,
  current: string,
  next: string,
  keepToken: string,
): Promise<void> {
  const user = await getUserById(db, userId);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new ServiceError("今のパスワードが違います");
  }
  if (current === next) throw new ServiceError("新しいパスワードが今のものと同じです");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
  await deleteOtherSessions(db, userId, keepToken);
}

// ───────── 合言葉 ─────────

export async function createInvite(db: Db, userId: string, unlimited = false): Promise<string> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invites)
    .where(and(eq(invites.createdBy, userId), isNull(invites.usedBy)));
  if (!unlimited && n >= MAX_OPEN_INVITES) {
    throw new ServiceError(`未使用の合言葉は${MAX_OPEN_INVITES}つまでです。使われるか取り消すと新しく作れます`);
  }
  const code = newInviteCode();
  await db.insert(invites).values({ code, createdBy: userId });
  return code;
}

/** 管理用: 誰の紹介でもない合言葉(最初の1人用) */
export async function createRootInvite(db: Db): Promise<string> {
  const code = newInviteCode();
  await db.insert(invites).values({ code, createdBy: null });
  return code;
}

export async function revokeInvite(db: Db, userId: string, code: string): Promise<void> {
  await db
    .delete(invites)
    .where(and(eq(invites.code, code), eq(invites.createdBy, userId), isNull(invites.usedBy)));
}

export async function listInvites(db: Db, userId: string) {
  return db
    .select({
      code: invites.code,
      usedAt: invites.usedAt,
      createdAt: invites.createdAt,
      usedByName: users.name,
      usedByHandle: users.handle,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.usedBy))
    .where(eq(invites.createdBy, userId))
    .orderBy(desc(invites.createdAt));
}

// ───────── 画像 ─────────

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/gif"];
// D1 は1行2MBまで。ブラウザで WebP に縮めれば数百KBなので、縮小を飛ばした送信だけが引っかかる
export const MAX_IMAGE_BYTES = 1_500_000;
// 1人が画像を送り続けて DB(無料枠 500MB)を埋められないようにする
export const MAX_IMAGE_BYTES_PER_USER = 30_000_000;

export async function saveImage(db: Db, ownerId: string, mime: string, data: Buffer): Promise<string> {
  if (!IMAGE_TYPES.includes(mime)) throw new ServiceError("画像は WebP・JPEG・PNG・GIF にしてください");
  if (data.byteLength > MAX_IMAGE_BYTES) throw new ServiceError("画像が大きすぎます(1.5MBまで)");
  const [{ used }] = await db
    .select({ used: sql<number>`coalesce(sum(length(${images.data})), 0)` })
    .from(images)
    .where(eq(images.ownerId, ownerId));
  if (Number(used) + data.byteLength > MAX_IMAGE_BYTES_PER_USER) {
    throw new ServiceError("画像の保存枠(1人30MB)がいっぱいです。古い写真付きの投稿を消すと空きます");
  }
  const id = newId();
  await db.insert(images).values({ id, ownerId, mime, data });
  return id;
}

/** 本人の画像だけ消す(差し替えたアイコンの後始末) */
export async function deleteImage(db: Db, ownerId: string, id: string): Promise<void> {
  await db.delete(images).where(and(eq(images.id, id), eq(images.ownerId, ownerId)));
}

export async function getImage(db: Db, id: string) {
  const [img] = await db.select().from(images).where(eq(images.id, id));
  return img ?? null;
}

// ───────── 投稿 ─────────

export async function createPost(
  db: Db,
  userId: string,
  input: { body: string; sealed: boolean; answersPrompt: boolean; imageId?: string | null },
): Promise<string> {
  const id = newId();
  await db.insert(posts).values({
    id,
    authorId: userId,
    body: input.body,
    sealed: input.sealed,
    imageId: input.imageId ?? null,
    promptDate: input.answersPrompt ? jstDate() : null,
  });
  await checkTitles(db, userId);
  return id;
}

export async function deletePost(db: Db, userId: string, postId: string): Promise<void> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post || post.authorId !== userId) throw new ServiceError("自分の情報だけ消せます");
  await db.delete(posts).where(eq(posts.id, postId));
  if (post.imageId) await db.delete(images).where(eq(images.id, post.imageId));
  await db.delete(notifications).where(eq(notifications.postId, postId));
}

export type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

export async function getFeed(
  db: Db,
  viewerId: string,
  opts: { authorId?: string; promptDate?: string; postId?: string; before?: Date; limit?: number } = {},
) {
  const conds = [];
  if (opts.authorId) conds.push(eq(posts.authorId, opts.authorId));
  if (opts.promptDate) conds.push(eq(posts.promptDate, opts.promptDate));
  if (opts.postId) conds.push(eq(posts.id, opts.postId));
  if (opts.before) conds.push(lt(posts.createdAt, opts.before));

  return db
    .select({
      id: posts.id,
      body: posts.body,
      imageId: posts.imageId,
      sealed: posts.sealed,
      promptDate: posts.promptDate,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        handle: users.handle,
        name: users.name,
        avatarImageId: users.avatarImageId,
        titleKey: users.titleKey,
        customTitle: users.customTitle,
        isAdmin: users.isAdmin,
        isModerator: users.isModerator,
      },
      likeCount: sql<number>`(select count(*) from "likes" l where l."post_id" = "posts"."id")`,
      commentCount: sql<number>`(select count(*) from "comments" c where c."post_id" = "posts"."id")`,
      likedByMe: sql<number>`exists(select 1 from "likes" l where l."post_id" = "posts"."id" and l."user_id" = ${viewerId})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(opts.limit ?? 30);
}

export async function toggleLike(db: Db, userId: string, postId: string): Promise<boolean> {
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (!post) throw new ServiceError("その情報は見つかりません");

  const removed = await db
    .delete(likes)
    .where(and(eq(likes.postId, postId), eq(likes.userId, userId)))
    .returning({ postId: likes.postId });
  if (removed.length > 0) return false;

  await db.insert(likes).values({ postId, userId }).onConflictDoNothing();
  if (post.authorId !== userId) {
    // 買い直しで知らせが重ならないようにする
    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, post.authorId),
          eq(notifications.kind, "like"),
          eq(notifications.actorId, userId),
          eq(notifications.postId, postId),
        ),
      );
    if (!already) {
      await db
        .insert(notifications)
        .values({ id: newId(), userId: post.authorId, kind: "like", actorId: userId, postId });
    }
    await checkTitles(db, post.authorId);
  }
  await checkTitles(db, userId);
  return true;
}

export async function addComment(db: Db, userId: string, postId: string, body: string): Promise<void> {
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId));
  if (!post) throw new ServiceError("その情報は見つかりません");
  const commentId = newId();
  await db.insert(comments).values({ id: commentId, postId, authorId: userId, body });
  if (post.authorId !== userId) {
    await db.insert(notifications).values({
      id: newId(),
      userId: post.authorId,
      kind: "comment",
      actorId: userId,
      postId,
      commentId,
      detail: body.slice(0, 60),
    });
  }
  await checkTitles(db, userId);
}

export async function deleteComment(db: Db, userId: string, commentId: string): Promise<void> {
  const own = and(eq(comments.id, commentId), eq(comments.authorId, userId));
  await db.batch([
    // 消したコメントの本文が相手の知らせに残らないようにする(本人のコメントのときだけ)
    db
      .delete(notifications)
      .where(
        and(
          eq(notifications.commentId, commentId),
          sql`EXISTS (SELECT 1 FROM "comments" c WHERE c."id" = ${commentId} AND c."author_id" = ${userId})`,
        ),
      ),
    db.delete(comments).where(own),
  ]);
}

export async function getComments(db: Db, postId: string) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      author: {
        id: users.id,
        handle: users.handle,
        name: users.name,
        avatarImageId: users.avatarImageId,
        isAdmin: users.isAdmin,
        isModerator: users.isModerator,
      },
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
}

// ───────── 称号・番付 ─────────

export async function getUserStats(db: Db, userId: string): Promise<UserStats> {
  const [row] = await db
    .select({
      posts: sql<number>`(select count(*) from "posts" p where p."author_id" = ${userId})`,
      sealedPosts: sql<number>`(select count(*) from "posts" p where p."author_id" = ${userId} and p."sealed" = 1)`,
      promptAnswers: sql<number>`(select count(distinct p."prompt_date") from "posts" p where p."author_id" = ${userId} and p."prompt_date" is not null)`,
      nightPosts: sql<number>`(select count(*) from "posts" p where p."author_id" = ${userId} and cast(strftime('%H', p."created_at" / 1000, 'unixepoch', '+9 hours') as integer) < 4)`,
      likesGiven: sql<number>`(select count(*) from "likes" l where l."user_id" = ${userId})`,
      likesReceived: sql<number>`(select count(*) from "likes" l inner join "posts" p on p."id" = l."post_id" where p."author_id" = ${userId} and l."user_id" != ${userId})`,
      comments: sql<number>`(select count(*) from "comments" c where c."author_id" = ${userId})`,
      invitesUsed: sql<number>`(select count(*) from "invites" i where i."created_by" = ${userId} and i."used_by" is not null)`,
    })
    .from(sql`(select 1)`);
  return row;
}

/** 新しく取れた称号を知らせる。返り値は今持っている称号のキー */
export async function checkTitles(db: Db, userId: string): Promise<string[]> {
  const earned = earnedTitleKeys(await getUserStats(db, userId));
  const notified = await db
    .select({ key: notifications.detail })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "title")));
  const known = new Set(notified.map((n) => n.key));
  const fresh = earned.filter((k) => k !== "newcomer" && !known.has(k));
  if (fresh.length) {
    await db
      .insert(notifications)
      .values(fresh.map((key) => ({ id: newId(), userId, kind: "title" as const, detail: key })));
  }
  return earned;
}

export async function getRanking(db: Db, since?: Date) {
  const sinceMs = since ? since.getTime() : 0;
  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarImageId: users.avatarImageId,
      titleKey: users.titleKey,
      customTitle: users.customTitle,
      isAdmin: users.isAdmin,
      isModerator: users.isModerator,
      received: sql<number>`(select count(*) from "likes" l inner join "posts" p on p."id" = l."post_id" where p."author_id" = "users"."id" and l."user_id" != "users"."id" and l."created_at" >= ${sinceMs})`,
      posted: sql<number>`(select count(*) from "posts" p where p."author_id" = "users"."id" and p."created_at" >= ${sinceMs})`,
    })
    .from(users)
    .where(isNull(users.bannedAt));
  return rows
    .filter((r) => r.received > 0 || r.posted > 0)
    .sort((a, b) => b.received - a.received || b.posted - a.posted)
    .slice(0, 20);
}

// ───────── メンバー・プロフィール ─────────

export async function getUserByHandle(db: Db, handle: string) {
  const [u] = await db.select().from(users).where(eq(users.handle, handle));
  return u ?? null;
}

export async function getUserById(db: Db, id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u ?? null;
}

export async function listMembers(db: Db) {
  return db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarImageId: users.avatarImageId,
      titleKey: users.titleKey,
      customTitle: users.customTitle,
      isAdmin: users.isAdmin,
      isModerator: users.isModerator,
      bannedAt: users.bannedAt,
    })
    .from(users)
    .where(isNull(users.bannedAt))
    .orderBy(users.createdAt);
}

/** 新しく入った会員。入会日と、最後に情報を流した日時も付ける */
export async function listNewcomers(db: Db, limit: number) {
  return db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarImageId: users.avatarImageId,
      joinedAt: users.createdAt,
      lastPostAt: sql<number | null>`(select max(p.created_at) from "posts" p where p.author_id = "users"."id")`,
    })
    .from(users)
    .where(isNull(users.bannedAt))
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function updateProfile(
  db: Db,
  userId: string,
  input: { name: string; bio: string; titleKey: string; avatarImageId?: string },
): Promise<void> {
  const earned = earnedTitleKeys(await getUserStats(db, userId));
  if (!earned.includes(input.titleKey)) throw new ServiceError("まだ持っていない称号です");
  const [before] = await db.select({ avatar: users.avatarImageId }).from(users).where(eq(users.id, userId));
  await db
    .update(users)
    .set({
      name: input.name,
      bio: input.bio,
      titleKey: input.titleKey,
      ...(input.avatarImageId ? { avatarImageId: input.avatarImageId } : {}),
    })
    .where(eq(users.id, userId));
  if (input.avatarImageId && before?.avatar) await db.delete(images).where(eq(images.id, before.avatar));
}

// ───────── 密談 ─────────

async function assertMember(db: Db, userId: string, roomId: string) {
  const [m] = await db
    .select({ roomId: roomMembers.roomId })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  if (!m) throw new ServiceError("その密談には入っていません");
}

// ───────── ブロック ─────────

export async function blockUser(db: Db, me: string, other: string): Promise<void> {
  if (me === other) throw new ServiceError("自分はブロックできません");
  if (!(await getUserById(db, other))) throw new ServiceError("相手が見つかりません");
  await db.insert(blocks).values({ blockerId: me, blockedId: other }).onConflictDoNothing();
}

export async function unblockUser(db: Db, me: string, other: string): Promise<void> {
  await db.delete(blocks).where(and(eq(blocks.blockerId, me), eq(blocks.blockedId, other)));
}

/** 自分がブロックしている相手か */
export async function isBlocking(db: Db, me: string, other: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blocks.blockedId })
    .from(blocks)
    .where(and(eq(blocks.blockerId, me), eq(blocks.blockedId, other)));
  return !!row;
}

/** どちらかがどちらかをブロックしているか */
export async function isBlockedEitherWay(db: Db, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blocks.blockedId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    );
  return !!row;
}

/** me とのあいだにブロックがある相手(どちら向きでも)の ID */
async function blockedPeers(db: Db, me: string): Promise<Set<string>> {
  const rows = await db
    .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, me), eq(blocks.blockedId, me)));
  return new Set(rows.map((r) => (r.blocker === me ? r.blocked : r.blocker)));
}

export async function listBlocked(db: Db, me: string) {
  return db
    .select({ id: users.id, handle: users.handle, name: users.name, avatarImageId: users.avatarImageId })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, me))
    .orderBy(desc(blocks.createdAt));
}

// 相手がいない・停止中・ブロックがある、を同じ文言にして、ブロックされたことを悟らせない
const DM_UNAVAILABLE = "この相手とは密談できません";

export async function openDirectRoom(db: Db, me: string, other: string): Promise<string> {
  if (me === other) throw new ServiceError("自分とは密談できません");
  const pairKey = [me, other].sort().join(":");
  // すでにある密談は(ブロック後も)開ける。これまでの話は読めて、新しく話せないだけ
  const [existing] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.pairKey, pairKey));
  if (existing) return existing.id;
  const target = await getUserById(db, other);
  if (!target || target.bannedAt || (await isBlockedEitherWay(db, me, other))) throw new ServiceError(DM_UNAVAILABLE);
  const id = newId();
  await db.insert(rooms).values({ id, pairKey, isGroup: false });
  await db.insert(roomMembers).values([
    { roomId: id, userId: me },
    { roomId: id, userId: other },
  ]);
  return id;
}

export async function createGroupRoom(db: Db, me: string, name: string, memberIds: string[]): Promise<string> {
  const picked = [...new Set(memberIds.filter((m) => m !== me))];
  if (picked.length < 2) throw new ServiceError("自分以外に2人以上選んでください");
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, picked), isNull(users.bannedAt)));
  if (found.length !== picked.length) throw new ServiceError("見つからないメンバーがいます");
  // ブロックのある相手は、人数の確認のあとで黙って外す(結果が変わらないので、誰にブロックされたかは分からない)
  const peers = await blockedPeers(db, me);
  const ids = picked.filter((m) => !peers.has(m));
  const id = newId();
  await db.insert(rooms).values({ id, name, isGroup: true });
  await db.insert(roomMembers).values([me, ...ids].map((userId) => ({ roomId: id, userId })));
  return id;
}

export async function listRooms(db: Db, me: string, onlyRoomId?: string) {
  const mine = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      isGroup: rooms.isGroup,
      lastMessageAt: rooms.lastMessageAt,
      lastSeenAt: roomMembers.lastSeenAt,
      createdAt: rooms.createdAt,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, me), onlyRoomId ? eq(rooms.id, onlyRoomId) : undefined));
  if (mine.length === 0) return [];

  const members = await db
    .select({ roomId: roomMembers.roomId, id: users.id, name: users.name, avatarImageId: users.avatarImageId })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(and(inArray(roomMembers.roomId, mine.map((r) => r.id)), ne(roomMembers.userId, me)));

  return mine
    .map((r) => {
      const others = members.filter((m) => m.roomId === r.id);
      return {
        ...r,
        others,
        title: r.isGroup ? (r.name ?? "会合") : (others[0]?.name ?? "(退会した情報屋)"),
        unread: !!r.lastMessageAt && (!r.lastSeenAt || r.lastMessageAt > r.lastSeenAt),
      };
    })
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt).getTime() - (a.lastMessageAt ?? a.createdAt).getTime());
}

export async function getRoom(db: Db, me: string, roomId: string) {
  await assertMember(db, me, roomId);
  const [room] = await listRooms(db, me, roomId);
  return room ?? null;
}

export async function getMessages(db: Db, me: string, roomId: string, after?: Date) {
  await assertMember(db, me, roomId);
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      authorId: messages.authorId,
      authorName: users.name,
      authorAvatar: users.avatarImageId,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(eq(messages.roomId, roomId), after ? gt(messages.createdAt, after) : undefined))
    .orderBy(desc(messages.createdAt))
    .limit(100);
  // 新しい話があったときだけ「見た」を記録する(数秒ごとの取得で毎回書き込まない)
  await db
    .update(roomMembers)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, me),
        sql`("room_members"."last_seen_at" is null or "room_members"."last_seen_at" < (select r."last_message_at" from "rooms" r where r."id" = ${roomId}))`,
      ),
    );
  return rows.reverse();
}

/** 会合から抜ける(1対1はブロックで断つ)。最後の1人が抜けたら会合ごと消す */
export async function leaveRoom(db: Db, me: string, roomId: string): Promise<void> {
  await assertMember(db, me, roomId);
  const [room] = await db.select({ isGroup: rooms.isGroup }).from(rooms).where(eq(rooms.id, roomId));
  if (!room?.isGroup) throw new ServiceError("1対1の密談からは抜けられません。断るときは相手をブロックしてください");
  await db.delete(roomMembers).where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, me)));
  const [left] = await db.select({ n: sql<number>`count(*)` }).from(roomMembers).where(eq(roomMembers.roomId, roomId));
  if (Number(left.n) === 0) await db.delete(rooms).where(eq(rooms.id, roomId));
}

export async function sendMessage(db: Db, me: string, roomId: string, body: string): Promise<void> {
  await assertMember(db, me, roomId);
  const [room] = await db.select({ isGroup: rooms.isGroup }).from(rooms).where(eq(rooms.id, roomId));
  if (room && !room.isGroup) {
    const [other] = await db
      .select({ id: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), ne(roomMembers.userId, me)));
    if (other && (await isBlockedEitherWay(db, me, other.id))) throw new ServiceError(DM_UNAVAILABLE);
  }
  const now = new Date();
  await db.insert(messages).values({ id: newId(), roomId, authorId: me, body, createdAt: now });
  await db.update(rooms).set({ lastMessageAt: now }).where(eq(rooms.id, roomId));
  await db
    .update(roomMembers)
    .set({ lastSeenAt: now })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, me)));
}

// ───────── 知らせ ─────────

export async function listNotifications(db: Db, me: string) {
  return db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      postId: notifications.postId,
      detail: notifications.detail,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actor: { handle: users.handle, name: users.name, avatarImageId: users.avatarImageId },
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, me))
    .orderBy(desc(notifications.createdAt))
    .limit(60);
}

export async function markNotificationsRead(db: Db, me: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me), isNull(notifications.readAt)));
}

export async function getBadges(db: Db, me: string) {
  const [row] = await db
    .select({
      notifications: sql<number>`(select count(*) from "notifications" n where n."user_id" = ${me} and n."read_at" is null)`,
      rooms: sql<number>`(select count(*) from "room_members" m inner join "rooms" r on r."id" = m."room_id" where m."user_id" = ${me} and r."last_message_at" is not null and (m."last_seen_at" is null or r."last_message_at" > m."last_seen_at"))`,
    })
    .from(sql`(select 1)`);
  return row;
}

// ───────── 管理 ─────────

/** 権限の判定に要る最小の情報 */
export type Rank = Pick<User, "isAdmin" | "isModerator">;
export type Actor = Pick<User, "id" | "isAdmin" | "isModerator">;
export type Role = "member" | "moderator" | "admin";

/** 管理人 2 > 副管理人 1 > 会員 0。操作できるのは自分より下の相手だけ */
export const rankOf = (u: Rank): number => (u.isAdmin ? 2 : u.isModerator ? 1 : 0);
export const isStaff = (u: Rank): boolean => rankOf(u) > 0;
/** 自分より下の位の相手の投稿などを消せるか */
export const canModerate = (actor: Rank, target: Rank): boolean => rankOf(actor) > 0 && rankOf(actor) > rankOf(target);

export const MAX_CUSTOM_TITLE = 12;
export const MAX_BAN_REASON = 100;
export const MAX_ANNOUNCEMENT = 300;

function assertStaff(actor: Rank) {
  if (!isStaff(actor)) throw new ServiceError("管理人か副管理人だけができる操作です");
}

function assertAdmin(actor: Rank) {
  if (!actor.isAdmin) throw new ServiceError("管理人だけができる操作です");
}

async function mustGetUser(db: Db, id: string): Promise<User> {
  const user = await getUserById(db, id);
  if (!user) throw new ServiceError("その会員は見つかりません");
  return user;
}

/** 自分より下の位の相手にだけ手を出せる */
function assertOutranks(actor: Actor, target: User, what: string) {
  if (target.id === actor.id) throw new ServiceError(`自分自身には${what}できません`);
  if (rankOf(actor) <= rankOf(target)) throw new ServiceError(`同じか上の位の人には${what}できません`);
}

async function logAdmin(db: Db, actorId: string, action: string, targetId: string | null, detail?: string) {
  await db.insert(adminLogs).values({ id: newId(), actorId, action, targetId, detail: detail ?? null });
}

async function notifyNotice(db: Db, userId: string, detail: string) {
  await db.insert(notifications).values({ id: newId(), userId, kind: "notice", detail });
}

/** 管理人・副管理人が他人の情報を消す(画像と知らせも片付け、本人に伝える) */
export async function moderateDeletePost(db: Db, actor: Actor, postId: string, reason?: string): Promise<void> {
  assertStaff(actor);
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new ServiceError("その情報は見つかりません");
  const author = await mustGetUser(db, post.authorId);
  assertOutranks(actor, author, "情報を消すこと");
  await db.delete(posts).where(eq(posts.id, postId));
  if (post.imageId) await db.delete(images).where(eq(images.id, post.imageId));
  await db.delete(notifications).where(eq(notifications.postId, postId));
  const why = reason?.trim() ? `(${reason.trim().slice(0, 60)})` : "";
  await notifyNotice(db, author.id, `管理人により、あなたの情報が1件削除されました${why}`);
  await logAdmin(db, actor.id, "post.delete", author.id, post.body.slice(0, 60));
}

export async function moderateDeleteComment(db: Db, actor: Actor, commentId: string): Promise<void> {
  assertStaff(actor);
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!comment) throw new ServiceError("その追記は見つかりません");
  const author = await mustGetUser(db, comment.authorId);
  assertOutranks(actor, author, "追記を消すこと");
  await db.batch([
    db.delete(notifications).where(eq(notifications.commentId, commentId)),
    db.delete(comments).where(eq(comments.id, commentId)),
  ]);
  await notifyNotice(db, author.id, "管理人により、あなたの追記が1件削除されました");
  await logAdmin(db, actor.id, "comment.delete", author.id, comment.body.slice(0, 60));
}

/** BAN: ログインも閲覧もできなくなる。deleteContent なら、その人の情報と追記もまとめて消す */
export async function banUser(
  db: Db,
  actor: Actor,
  targetId: string,
  reason: string,
  deleteContent = false,
  withInvitees = false,
): Promise<void> {
  assertStaff(actor);
  const target = await mustGetUser(db, targetId);
  assertOutranks(actor, target, "BANすること");
  if (target.bannedAt) throw new ServiceError("すでにBANされています");
  const why = reason.trim().slice(0, MAX_BAN_REASON);
  await db
    .update(users)
    .set({ bannedAt: new Date(), banReason: why || null })
    .where(eq(users.id, targetId));
  await db.delete(sessions).where(eq(sessions.userId, targetId));
  // 持っていた未使用の合言葉も無効にする(BAN された人の紹介で新しい会員を作れないように)
  await db.delete(invites).where(and(eq(invites.createdBy, targetId), isNull(invites.usedBy)));
  if (deleteContent) {
    const theirPosts = db.select({ id: posts.id }).from(posts).where(eq(posts.authorId, targetId));
    const theirImages = db.select({ id: posts.imageId }).from(posts).where(eq(posts.authorId, targetId));
    await db.delete(images).where(inArray(images.id, theirImages));
    await db.delete(notifications).where(inArray(notifications.postId, theirPosts));
    await db.delete(posts).where(eq(posts.authorId, targetId));
    await db.delete(comments).where(eq(comments.authorId, targetId));
  }
  await logAdmin(
    db,
    actor.id,
    "ban",
    targetId,
    `${why || "理由なし"}${deleteContent ? " / 投稿も削除" : ""}${withInvitees ? " / 紹介した会員も" : ""}`,
  );
  // 捨てアカウント対策: この人の紹介で入った会員(その先の紹介も)もまとめて止める。
  // すでにBAN済みの人・自分と同じか上の位の人は飛ばし、その先もたどらない
  if (withInvitees) {
    const invitees = await db
      .select()
      .from(users)
      .where(and(eq(users.invitedBy, targetId), isNull(users.bannedAt)));
    for (const u of invitees) {
      if (u.id === actor.id || rankOf(actor) <= rankOf(u)) continue;
      await banUser(db, actor, u.id, `紹介元(@${target.handle})のBANに伴う停止`, deleteContent, true);
    }
  }
}

export async function unbanUser(db: Db, actor: Actor, targetId: string): Promise<void> {
  assertStaff(actor);
  const target = await mustGetUser(db, targetId);
  assertOutranks(actor, target, "BANを解くこと");
  if (!target.bannedAt) return;
  await db.update(users).set({ bannedAt: null, banReason: null }).where(eq(users.id, targetId));
  await logAdmin(db, actor.id, "unban", targetId);
}

/** 権限の付与・剥奪(管理人だけ)。自分の権限は変えられない=管理人が0人になることはない */
export async function setRole(db: Db, actor: Actor, targetId: string, role: Role): Promise<void> {
  assertAdmin(actor);
  const target = await mustGetUser(db, targetId);
  if (target.id === actor.id) throw new ServiceError("自分自身の権限は変えられません");
  if (target.bannedAt) throw new ServiceError("BAN中の人には権限を付けられません。先にBANを解いてください");
  await db
    .update(users)
    .set({ isAdmin: role === "admin", isModerator: role === "moderator" })
    .where(eq(users.id, targetId));
  const label = { member: "会員", moderator: "副管理人", admin: "管理人" }[role];
  if (role !== "member") await notifyNotice(db, targetId, `あなたは${label}に任命されました`);
  await logAdmin(db, actor.id, "role", targetId, label);
}

/** 管理人が贈る特別な称号。null で取り上げる */
export async function setCustomTitle(db: Db, actor: Actor, targetId: string, title: string | null): Promise<void> {
  assertAdmin(actor);
  const value = title?.trim() || null;
  if (value && value.length > MAX_CUSTOM_TITLE) throw new ServiceError(`称号は${MAX_CUSTOM_TITLE}文字までです`);
  await mustGetUser(db, targetId);
  await db.update(users).set({ customTitle: value }).where(eq(users.id, targetId));
  if (value && targetId !== actor.id) await notifyNotice(db, targetId, `管理人から特別な称号「${value}」を贈られました`);
  await logAdmin(db, actor.id, "title", targetId, value ?? "取り上げ");
}

export async function postAnnouncement(db: Db, actor: Actor, body: string): Promise<void> {
  assertAdmin(actor);
  const text = body.trim();
  if (!text) throw new ServiceError("告示の本文を入れてください");
  if (text.length > MAX_ANNOUNCEMENT) throw new ServiceError(`告示は${MAX_ANNOUNCEMENT}文字までです`);
  await db.insert(announcements).values({ id: newId(), authorId: actor.id, body: text });
  await logAdmin(db, actor.id, "announce", null, text.slice(0, 60));
}

export async function clearAnnouncements(db: Db, actor: Actor): Promise<void> {
  assertAdmin(actor);
  await db.delete(announcements);
  await logAdmin(db, actor.id, "announce.clear", null);
}

/** 掲示板の上に出す、最新の告示 */
export async function getLatestAnnouncement(db: Db) {
  const [row] = await db
    .select({ id: announcements.id, body: announcements.body, createdAt: announcements.createdAt })
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .limit(1);
  return row ?? null;
}

/** 管理画面の会員一覧(BAN中の人も含む) */
export async function listMembersForAdmin(db: Db) {
  return db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      titleKey: users.titleKey,
      customTitle: users.customTitle,
      isAdmin: users.isAdmin,
      isModerator: users.isModerator,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
      createdAt: users.createdAt,
      postCount: sql<number>`(select count(*) from "posts" p where p."author_id" = "users"."id")`,
    })
    .from(users)
    .orderBy(users.createdAt);
}

export async function listAdminLogs(db: Db, limit = 40) {
  const actor = alias(users, "actor");
  const target = alias(users, "target");
  return db
    .select({
      id: adminLogs.id,
      action: adminLogs.action,
      detail: adminLogs.detail,
      createdAt: adminLogs.createdAt,
      actorName: actor.name,
      targetName: target.name,
      targetHandle: target.handle,
    })
    .from(adminLogs)
    .leftJoin(actor, eq(actor.id, adminLogs.actorId))
    .leftJoin(target, eq(target.id, adminLogs.targetId))
    .orderBy(desc(adminLogs.createdAt))
    .limit(limit);
}

export async function getAdminOverview(db: Db) {
  const [row] = await db
    .select({
      members: sql<number>`(select count(*) from "users")`,
      banned: sql<number>`(select count(*) from "users" where "banned_at" is not null)`,
      posts: sql<number>`(select count(*) from "posts")`,
      comments: sql<number>`(select count(*) from "comments")`,
      openInvites: sql<number>`(select count(*) from "invites" where "used_by" is null)`,
      imageBytes: sql<number>`(select coalesce(sum(length("data")), 0) from "images")`,
    })
    .from(sql`(select 1)`);
  return row;
}
