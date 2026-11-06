import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import {
  addComment,
  banUser,
  blockUser,
  unblockUser,
  leaveRoom,
  changePassword,
  deleteOtherSessions,
  clearAnnouncements,
  getAdminOverview,
  getLatestAnnouncement,
  getUserById,
  listAdminLogs,
  listMembers,
  listMembersForAdmin,
  MAX_CUSTOM_TITLE,
  moderateDeleteComment,
  moderateDeletePost,
  postAnnouncement,
  setCustomTitle,
  setRole,
  unbanUser,
  authenticate,
  checkTitles,
  clearRateLimit,
  hitRateLimit,
  pruneRateLimits,
  RATE_WINDOW_MS,
  createGroupRoom,
  createInvite,
  createPost,
  createRootInvite,
  createSession,
  deleteComment,
  deleteImage,
  getImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_BYTES_PER_USER,
  saveImage,
  deletePost,
  getComments,
  getBadges,
  getFeed,
  getMessages,
  getRanking,
  getUserBySession,
  listNewcomers,
  listNotifications,
  listRooms,
  MAX_OPEN_INVITES,
  openDirectRoom,
  registerWithInvite,
  sendMessage,
  ServiceError,
  toggleLike,
  updateProfile,
} from "@/server/services";

let db: Db;
const pw = "test-pass-9876";

async function join(handle: string, inviterId?: string) {
  const code = inviterId ? await createInvite(db, inviterId) : await createRootInvite(db);
  return registerWithInvite(db, { code, handle, name: handle.toUpperCase(), password: pw });
}

beforeEach(async () => {
  db = createDb(":memory:").db;
  await runMigrations(db);
});

describe("入会", () => {
  it("合言葉があれば入会でき、最初の1人は管理人になる", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    expect(a.isAdmin).toBe(true);
    expect(b.isAdmin).toBe(false);
    expect(b.invitedBy).toBe(a.id);
  });

  it("合言葉は一度しか使えない", async () => {
    const code = await createRootInvite(db);
    await registerWithInvite(db, { code, handle: "one", name: "one", password: pw });
    await expect(registerWithInvite(db, { code, handle: "two", name: "two", password: pw })).rejects.toThrow(ServiceError);
  });

  it("でたらめな合言葉では入れない", async () => {
    await expect(registerWithInvite(db, { code: "AAAA-AAAA", handle: "x_x", name: "x", password: pw })).rejects.toThrow(
      ServiceError,
    );
  });

  it("小文字やハイフン抜きでも合言葉が通る", async () => {
    const code = await createRootInvite(db);
    const u = await registerWithInvite(db, { code: code.replace("-", "").toLowerCase(), handle: "low", name: "l", password: pw });
    expect(u.handle).toBe("low");
  });

  it("同じIDは使えず、合言葉も消費されない", async () => {
    const a = await join("alpha");
    const code = await createInvite(db, a.id);
    await expect(registerWithInvite(db, { code, handle: "alpha", name: "dup", password: pw })).rejects.toThrow("ID");
    const ok = await registerWithInvite(db, { code, handle: "other", name: "o", password: pw });
    expect(ok.invitedBy).toBe(a.id);
  });

  it("未使用の合言葉は上限まで", async () => {
    const a = await join("alpha");
    for (let i = 0; i < MAX_OPEN_INVITES; i++) await createInvite(db, a.id);
    await expect(createInvite(db, a.id)).rejects.toThrow(ServiceError);
  });

  it("紹介者に入会の知らせが届く", async () => {
    const a = await join("alpha");
    await join("bravo", a.id);
    const list = await listNotifications(db, a.id);
    expect(list.some((n) => n.kind === "joined" && n.actor?.handle === "bravo")).toBe(true);
  });
});

describe("ログイン", () => {
  it("正しいパスワードだけ通り、セッションで本人が引ける", async () => {
    const a = await join("alpha");
    expect(await authenticate(db, "alpha", "wrong-pass")).toBeNull();
    expect(await authenticate(db, "nobody", pw)).toBeNull();
    const user = await authenticate(db, "alpha", pw);
    expect(user?.id).toBe(a.id);
    const { token } = await createSession(db, a.id);
    expect((await getUserBySession(db, token))?.id).toBe(a.id);
    expect(await getUserBySession(db, "bogus")).toBeNull();
  });
});

describe("ログインの試行制限", () => {
  it("上限までは通り、越えたら止まる。期限が切れたら数え直す", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(await hitRateLimit(db, "h:alpha", 3, t0)).toBe(true);
    expect(await hitRateLimit(db, "h:alpha", 3, t0 + 1)).toBe(false);
    expect(await hitRateLimit(db, "h:bravo", 3, t0 + 1)).toBe(true);
    expect(await hitRateLimit(db, "h:alpha", 3, t0 + RATE_WINDOW_MS + 1)).toBe(true);
  });

  it("並列に送られても上限を越えない", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit(db, "h:race", 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("消せば数え直し、期限切れは掃除される", async () => {
    const t0 = 2_000_000;
    await hitRateLimit(db, "h:x", 1, t0);
    expect(await hitRateLimit(db, "h:x", 1, t0)).toBe(false);
    await clearRateLimit(db, ["h:x"]);
    expect(await hitRateLimit(db, "h:x", 1, t0)).toBe(true);
    await pruneRateLimits(db, t0 + RATE_WINDOW_MS + 1);
    expect(await hitRateLimit(db, "h:x", 1, t0 + RATE_WINDOW_MS + 2)).toBe(true);
  });
});

describe("掲示板", () => {
  it("投稿・買う・コメントが数に反映され、知らせが届く", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const postId = await createPost(db, a.id, { body: "ネタ", sealed: true, answersPrompt: true });

    expect(await toggleLike(db, b.id, postId)).toBe(true);
    await addComment(db, b.id, postId, "ほんと?");

    const [post] = await getFeed(db, b.id);
    expect(post.likeCount).toBe(1);
    expect(post.commentCount).toBe(1);
    expect(post.likedByMe).toBe(1);
    expect(post.sealed).toBe(true);
    expect(post.promptDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const kinds = (await listNotifications(db, a.id)).map((n) => n.kind);
    expect(kinds).toContain("like");
    expect(kinds).toContain("comment");

    // 取り消して買い直しても、知らせは増えない
    expect(await toggleLike(db, b.id, postId)).toBe(false);
    await toggleLike(db, b.id, postId);
    const likeNotes = (await listNotifications(db, a.id)).filter((n) => n.kind === "like");
    expect(likeNotes).toHaveLength(1);
  });

  it("コメントを消すと、相手への知らせも消える。他人のコメントは消せない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const postId = await createPost(db, a.id, { body: "x", sealed: false, answersPrompt: false });
    await addComment(db, b.id, postId, "ここだけの話");
    const [c] = await getComments(db, postId);
    await deleteComment(db, a.id, c.id);
    expect(await getComments(db, postId)).toHaveLength(1);
    await deleteComment(db, b.id, c.id);
    expect(await getComments(db, postId)).toHaveLength(0);
    expect((await listNotifications(db, a.id)).filter((n) => n.kind === "comment")).toHaveLength(0);
  });

  it("他人の投稿は消せない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const postId = await createPost(db, a.id, { body: "x", sealed: false, answersPrompt: false });
    await expect(deletePost(db, b.id, postId)).rejects.toThrow(ServiceError);
    await deletePost(db, a.id, postId);
    expect(await getFeed(db, a.id)).toHaveLength(0);
  });
});

describe("称号と番付", () => {
  it("条件を満たすと称号が取れ、持っていない称号は名乗れない", async () => {
    const a = await join("alpha");
    await expect(updateProfile(db, a.id, { name: "A", bio: "", titleKey: "informant" })).rejects.toThrow(ServiceError);
    for (let i = 0; i < 5; i++) await createPost(db, a.id, { body: `p${i}`, sealed: false, answersPrompt: false });
    expect(await checkTitles(db, a.id)).toContain("informant");
    await updateProfile(db, a.id, { name: "A", bio: "", titleKey: "informant" });
    const titleNotes = (await listNotifications(db, a.id)).filter((n) => n.kind === "title");
    expect(titleNotes.map((n) => n.detail)).toEqual(["informant"]);
  });

  it("番付は買われた数の順", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const c = await join("charlie", a.id);
    const pb = await createPost(db, b.id, { body: "b", sealed: false, answersPrompt: false });
    await createPost(db, c.id, { body: "c", sealed: false, answersPrompt: false });
    await toggleLike(db, a.id, pb);
    await toggleLike(db, c.id, pb);
    const rank = await getRanking(db);
    expect(rank[0].handle).toBe("bravo");
    expect(rank[0].received).toBe(2);
  });

  it("新入りの一覧に、入会日と最後に流した日時が付く", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    await createPost(db, b.id, { body: "b", sealed: false, answersPrompt: false });
    const list = await listNewcomers(db, 4);
    const byHandle = Object.fromEntries(list.map((m) => [m.handle, m]));
    expect(byHandle.alpha.lastPostAt).toBeNull();
    expect(byHandle.bravo.lastPostAt).toBeGreaterThan(0);
    expect(byHandle.bravo.joinedAt).toBeInstanceOf(Date);
    expect(await listNewcomers(db, 1)).toHaveLength(1);
  });
});

describe("密談", () => {
  it("1対1は同じ部屋を使い回し、未読の目印が付く", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const r1 = await openDirectRoom(db, a.id, b.id);
    const r2 = await openDirectRoom(db, b.id, a.id);
    expect(r1).toBe(r2);

    await sendMessage(db, a.id, r1, "よう");
    expect((await getBadges(db, b.id)).rooms).toBe(1);
    expect((await listRooms(db, b.id))[0].unread).toBe(true);

    const msgs = await getMessages(db, b.id, r1);
    expect(msgs.map((m) => m.body)).toEqual(["よう"]);
    expect((await getBadges(db, b.id)).rooms).toBe(0);
  });

  it("入っていない密談は読めない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const c = await join("charlie", a.id);
    const room = await openDirectRoom(db, a.id, b.id);
    await expect(getMessages(db, c.id, room)).rejects.toThrow(ServiceError);
    await expect(sendMessage(db, c.id, room, "割り込み")).rejects.toThrow(ServiceError);
  });

  it("会合(グループ)は自分以外に2人以上必要", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const c = await join("charlie", a.id);
    await expect(createGroupRoom(db, a.id, "少人数", [b.id])).rejects.toThrow(ServiceError);
    const room = await createGroupRoom(db, a.id, "作戦会議", [b.id, c.id]);
    const list = await listRooms(db, c.id);
    expect(list[0].id).toBe(room);
    expect(list[0].title).toBe("作戦会議");
    expect(list[0].others).toHaveLength(2);
  });
});

describe("ブロックと退出", () => {
  it("ブロックすると、どちらからも新しい密談と1対1の発言ができず、解除で戻る", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const room = await openDirectRoom(db, a.id, b.id);
    await blockUser(db, b.id, a.id);
    // すでにある密談は開ける(話せないだけ)
    expect(await openDirectRoom(db, a.id, b.id)).toBe(room);
    const c = await join("charlie", a.id);
    await blockUser(db, c.id, a.id);
    await expect(openDirectRoom(db, a.id, c.id)).rejects.toThrow("密談できません");
    await expect(openDirectRoom(db, c.id, a.id)).rejects.toThrow("密談できません");
    await expect(sendMessage(db, a.id, room, "しつこく")).rejects.toThrow("密談できません");
    await expect(sendMessage(db, b.id, room, "こちらからも")).rejects.toThrow("密談できません");
    await unblockUser(db, b.id, a.id);
    await sendMessage(db, a.id, room, "仲直り");
    expect(await openDirectRoom(db, b.id, a.id)).toBe(room);
  });

  it("ブロックしている・されている相手は会合に入らない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const c = await join("charlie", a.id);
    const d = await join("delta", a.id);
    await blockUser(db, b.id, a.id);
    const room = await createGroupRoom(db, a.id, "作戦会議", [b.id, c.id, d.id]);
    const [r] = await listRooms(db, a.id, room);
    expect(r.others.map((o) => o.id).sort()).toEqual([c.id, d.id].sort());
    // ブロックされていても結果(作れる/作れない)は変わらない
    const small = await createGroupRoom(db, a.id, "2人", [b.id, c.id]);
    expect((await listRooms(db, a.id, small))[0].others.map((o) => o.id)).toEqual([c.id]);
  });

  it("会合からは抜けられ、全員抜けたら消える。1対1からは抜けられない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const c = await join("charlie", a.id);
    const room = await createGroupRoom(db, a.id, "会合", [b.id, c.id]);
    await leaveRoom(db, b.id, room);
    await expect(getMessages(db, b.id, room)).rejects.toThrow(ServiceError);
    await expect(sendMessage(db, b.id, room, "戻る")).rejects.toThrow(ServiceError);
    expect(await listRooms(db, b.id)).toHaveLength(0);
    await leaveRoom(db, a.id, room);
    await leaveRoom(db, c.id, room);
    expect(await listRooms(db, a.id)).toHaveLength(0);
    const dm = await openDirectRoom(db, a.id, b.id);
    await expect(leaveRoom(db, a.id, dm)).rejects.toThrow(ServiceError);
  });

  it("BAN中の相手とは新しく密談を始められない", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    await banUser(db, a, b.id, "荒らし");
    await expect(openDirectRoom(db, a.id, b.id)).rejects.toThrow(ServiceError);
  });
});

describe("パスワードとセッション", () => {
  it("今のパスワードが合うときだけ変わり、ほかの端末はログアウトされる", async () => {
    const a = await join("alpha");
    const here = await createSession(db, a.id);
    const other = await createSession(db, a.id);
    await expect(changePassword(db, a.id, "wrong-pass", "new-pass-1234", here.token)).rejects.toThrow("違います");
    await expect(changePassword(db, a.id, pw, pw, here.token)).rejects.toThrow(ServiceError);
    await changePassword(db, a.id, pw, "new-pass-1234", here.token);
    expect(await authenticate(db, "alpha", pw)).toBeNull();
    expect((await authenticate(db, "alpha", "new-pass-1234"))?.id).toBe(a.id);
    expect((await getUserBySession(db, here.token))?.id).toBe(a.id);
    expect(await getUserBySession(db, other.token)).toBeNull();
  });

  it("ほかの端末だけログアウトできる", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    const here = await createSession(db, a.id);
    const other = await createSession(db, a.id);
    const bs = await createSession(db, b.id);
    await deleteOtherSessions(db, a.id, here.token);
    expect(await getUserBySession(db, here.token)).not.toBeNull();
    expect(await getUserBySession(db, other.token)).toBeNull();
    expect(await getUserBySession(db, bs.token)).not.toBeNull();
  });
});

describe("捨てアカウント対策", () => {
  it("紹介した会員もまとめてBANでき、上の位の人は飛ばす", async () => {
    const admin = await join("admin");
    const bad = await join("bad", admin.id);
    const sock1 = await join("sock1", bad.id);
    const sock2 = await join("sock2", sock1.id);
    const good = await join("good", admin.id);
    await banUser(db, admin, bad.id, "荒らし", false, true);
    for (const u of [bad, sock1, sock2]) expect((await getUserById(db, u.id))?.bannedAt).toBeTruthy();
    expect((await getUserById(db, good.id))?.bannedAt).toBeNull();
    expect((await getUserById(db, sock2.id))?.banReason).toContain("@sock1");
  });

  it("まとめてBANしないときは本人だけ", async () => {
    const admin = await join("admin");
    const bad = await join("bad", admin.id);
    const sock = await join("sock", bad.id);
    await banUser(db, admin, bad.id, "荒らし");
    expect((await getUserById(db, sock.id))?.bannedAt).toBeNull();
  });

  it("合言葉の1日の上限は24時間の枠で数える", async () => {
    const t0 = 5_000_000;
    for (let i = 0; i < 5; i++) expect(await hitRateLimit(db, "w:invite:x", 5, t0 + i * RATE_WINDOW_MS, 86_400_000)).toBe(true);
    expect(await hitRateLimit(db, "w:invite:x", 5, t0 + 6 * RATE_WINDOW_MS, 86_400_000)).toBe(false);
    expect(await hitRateLimit(db, "w:invite:x", 5, t0 + 86_400_001, 86_400_000)).toBe(true);
  });
});

describe("画像の保存", () => {
  it("1枚の上限と1人あたりの保存枠を越えると断り、消すと空く", async () => {
    const a = await join("alpha");
    const b = await join("bravo", a.id);
    await expect(saveImage(db, a.id, "image/webp", Buffer.alloc(MAX_IMAGE_BYTES + 1))).rejects.toThrow(ServiceError);
    await expect(saveImage(db, a.id, "text/html", Buffer.alloc(10))).rejects.toThrow(ServiceError);

    const ids: string[] = [];
    const n = Math.floor(MAX_IMAGE_BYTES_PER_USER / MAX_IMAGE_BYTES);
    for (let i = 0; i < n; i++) ids.push(await saveImage(db, a.id, "image/webp", Buffer.alloc(MAX_IMAGE_BYTES)));
    await expect(saveImage(db, a.id, "image/webp", Buffer.alloc(MAX_IMAGE_BYTES))).rejects.toThrow(ServiceError);
    // 他人の枠には影響しない
    await saveImage(db, b.id, "image/webp", Buffer.alloc(MAX_IMAGE_BYTES));

    // 他人の画像は消せない
    await deleteImage(db, b.id, ids[0]);
    expect(await getImage(db, ids[0])).not.toBeNull();
    await deleteImage(db, a.id, ids[0]);
    expect(await getImage(db, ids[0])).toBeNull();
    await saveImage(db, a.id, "image/webp", Buffer.alloc(MAX_IMAGE_BYTES));
  });
});

describe("管理者の権限", () => {
  it("副管理人は他人の情報を消せて、本人に知らせが届く。会員は消せない", async () => {
    const admin = await join("admin1");
    const mod = await join("mod1", admin.id);
    const a = await join("alice", admin.id);
    const b = await join("bobby", admin.id);
    await setRole(db, admin, mod.id, "moderator");
    const modNow = (await getUserById(db, mod.id))!;
    const postId = await createPost(db, a.id, { body: "x", sealed: false, answersPrompt: false });

    await expect(moderateDeletePost(db, b, postId)).rejects.toThrow(ServiceError);
    await moderateDeletePost(db, modNow, postId, "規約違反");
    expect(await getFeed(db, a.id, { postId })).toHaveLength(0);
    const notes = await listNotifications(db, a.id);
    expect(notes.find((n) => n.kind === "notice")?.detail).toContain("規約違反");
  });

  it("位が同じか上の人には手を出せない", async () => {
    const admin = await join("admin1");
    const mod1 = await join("mod1", admin.id);
    const mod2 = await join("mod2", admin.id);
    await setRole(db, admin, mod1.id, "moderator");
    await setRole(db, admin, mod2.id, "moderator");
    const m1 = (await getUserById(db, mod1.id))!;
    await expect(banUser(db, m1, mod2.id, "x")).rejects.toThrow(ServiceError);
    await expect(banUser(db, m1, admin.id, "x")).rejects.toThrow(ServiceError);
    await expect(banUser(db, admin, admin.id, "x")).rejects.toThrow(ServiceError);
    await banUser(db, admin, mod2.id, "x");
  });

  it("BAN されるとセッションが消え、ログインできず、一覧からも消える。解除で戻る", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    const { token } = await createSession(db, a.id);
    await banUser(db, admin, a.id, "荒らし");

    expect(await getUserBySession(db, token)).toBeNull();
    await expect(authenticate(db, "alice", pw)).rejects.toThrow(/荒らし/);
    expect(await authenticate(db, "alice", "wrong-password")).toBeNull();
    expect((await listMembers(db)).map((m) => m.handle)).not.toContain("alice");
    expect((await listMembersForAdmin(db)).find((m) => m.handle === "alice")?.bannedAt).toBeTruthy();

    await unbanUser(db, admin, a.id);
    expect((await authenticate(db, "alice", pw))?.id).toBe(a.id);
  });

  it("BAN と同時に、その人の情報と追記を消せる", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    const p1 = await createPost(db, admin.id, { body: "admin", sealed: false, answersPrompt: false });
    await createPost(db, a.id, { body: "spam", sealed: false, answersPrompt: false });
    await addComment(db, a.id, p1, "spam comment");
    await banUser(db, admin, a.id, "spam", true);
    expect(await getFeed(db, admin.id, { authorId: a.id })).toHaveLength(0);
    expect(await getComments(db, p1)).toHaveLength(0);
  });

  it("BAN された人の未使用の合言葉は使えなくなる", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    const code = await createInvite(db, a.id);
    await banUser(db, admin, a.id, "x");
    await expect(registerWithInvite(db, { code, handle: "newbie", name: "N", password: pw })).rejects.toThrow(ServiceError);
  });

  it("追記も位の下の人のものだけ消せる", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    const p = await createPost(db, admin.id, { body: "x", sealed: false, answersPrompt: false });
    await addComment(db, a.id, p, "hi");
    const [c] = await getComments(db, p);
    await expect(moderateDeleteComment(db, a, c.id)).rejects.toThrow(ServiceError);
    await moderateDeleteComment(db, admin, c.id);
    expect(await getComments(db, p)).toHaveLength(0);
  });

  it("権限の付与と特別な称号は管理人だけ。自分の権限は変えられない", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    const b = await join("bobby", admin.id);
    await expect(setRole(db, a, b.id, "moderator")).rejects.toThrow(ServiceError);
    await expect(setCustomTitle(db, a, b.id, "名誉会員")).rejects.toThrow(ServiceError);
    await expect(setRole(db, admin, admin.id, "member")).rejects.toThrow(ServiceError);

    await setCustomTitle(db, admin, a.id, "名誉会員");
    expect((await getUserById(db, a.id))?.customTitle).toBe("名誉会員");
    await expect(setCustomTitle(db, admin, a.id, "あ".repeat(MAX_CUSTOM_TITLE + 1))).rejects.toThrow(ServiceError);
    await setCustomTitle(db, admin, a.id, "");
    expect((await getUserById(db, a.id))?.customTitle).toBeNull();

    await setRole(db, admin, a.id, "admin");
    const aNow = (await getUserById(db, a.id))!;
    expect(aNow.isAdmin).toBe(true);
    await setRole(db, aNow, b.id, "moderator");
    expect((await getUserById(db, b.id))?.isModerator).toBe(true);
    // 管理人にされると isModerator は外れる
    await setRole(db, admin, b.id, "admin");
    expect(await getUserById(db, b.id)).toMatchObject({ isAdmin: true, isModerator: false });
  });

  it("告示は管理人だけが出せ、最新の1件が見える", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    await expect(postAnnouncement(db, a, "hello")).rejects.toThrow(ServiceError);
    expect(await getLatestAnnouncement(db)).toBeNull();
    await postAnnouncement(db, admin, "古い告示");
    await new Promise((r) => setTimeout(r, 5));
    await postAnnouncement(db, admin, "新しい告示");
    expect((await getLatestAnnouncement(db))?.body).toBe("新しい告示");
    await clearAnnouncements(db, admin);
    expect(await getLatestAnnouncement(db)).toBeNull();
  });

  it("管理人は未使用の合言葉を上限なしで作れ、操作は記録に残る", async () => {
    const admin = await join("admin1");
    const a = await join("alice", admin.id);
    for (let i = 0; i < MAX_OPEN_INVITES + 2; i++) await createInvite(db, admin.id, true);
    await expect(createInvite(db, admin.id)).rejects.toThrow(ServiceError);
    await banUser(db, admin, a.id, "test");
    const logs = await listAdminLogs(db);
    expect(logs[0]).toMatchObject({ action: "ban", targetHandle: "alice", actorName: "ADMIN1" });
    expect((await getAdminOverview(db)).banned).toBe(1);
  });
});
