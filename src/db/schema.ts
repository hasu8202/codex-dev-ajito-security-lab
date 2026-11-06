import { sql } from "drizzle-orm";
import { blob, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  bio: text("bio").notNull().default(""),
  avatarImageId: text("avatar_image_id"),
  titleKey: text("title_key").notNull().default("newcomer"),
  invitedBy: text("invited_by"),
  // 管理人(最上位)。副管理人・称号・BAN は下の列
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  // 副管理人: 投稿や追記の削除と BAN ができる
  isModerator: integer("is_moderator", { mode: "boolean" }).notNull().default(false),
  // 管理人が贈る特別な称号(自由な文字)。あれば通常の称号の代わりに表示する
  customTitle: text("custom_title"),
  // BAN された日時と理由。ログイン・閲覧ができなくなる
  bannedAt: integer("banned_at", { mode: "timestamp_ms" }),
  banReason: text("ban_reason"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const invites = sqliteTable("invites", {
  code: text("code").primaryKey(),
  createdBy: text("created_by"),
  usedBy: text("used_by"),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  mime: text("mime").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  createdAt: createdAt(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageId: text("image_id"),
    sealed: integer("sealed", { mode: "boolean" }).notNull().default(false),
    // 今日の依頼に応えた投稿なら、その日付(JST, YYYY-MM-DD)
    promptDate: text("prompt_date"),
    createdAt: createdAt(),
  },
  (t) => [index("posts_created_idx").on(t.createdAt), index("posts_author_idx").on(t.authorId)],
);

export const likes = sqliteTable(
  "likes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("likes_user_idx").on(t.userId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId)],
);

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  // グループのときだけ名前を持つ。1対1は null
  name: text("name"),
  isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
  // 1対1の重複防止用(ユーザーIDを並べて連結)
  pairKey: text("pair_key").unique(),
  lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const roomMembers = sqliteTable(
  "room_members",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 自分が最後に開いた時刻(未読の目印にだけ使い、相手には見せない)
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.userId] }), index("room_members_user_idx").on(t.userId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_room_idx").on(t.roomId, t.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["like", "comment", "joined", "title", "notice"] }).notNull(),
    actorId: text("actor_id"),
    postId: text("post_id"),
    // コメントの知らせなら元のコメント(消されたら知らせも消すため)
    commentId: text("comment_id"),
    detail: text("detail"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;

// ログインの試行回数。サーバーのメモリではなく DB に持つので、台数が増えても共有でき、
// 大量に送られても制限中の記録が押し出されることがない
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: integer("until").notNull(),
});

// 管理人からの告示。掲示板の上に最新の1件を出す
export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

// 管理操作の記録(誰が・何を・誰に)。管理画面で新しい順に見る
export const adminLogs = sqliteTable(
  "admin_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_logs_created_idx").on(t.createdAt)],
);

// ブロック: blocker が blocked との密談を断る(新しい密談・1対1での発言・会合への招待を止める)
export const blocks = sqliteTable(
  "blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);
