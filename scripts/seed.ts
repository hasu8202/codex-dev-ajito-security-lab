// 画面確認用のお試しデータを入れる(手元専用)。全員のパスワードは seed-pass-1234
import { mkdirSync } from "node:fs";
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";
import {
  addComment,
  createGroupRoom,
  createInvite,
  createPost,
  createRootInvite,
  openDirectRoom,
  registerWithInvite,
  sendMessage,
  toggleLike,
} from "../src/server/services";

const url = process.env.DATABASE_URL || "file:./data/ajito-security-lab.db";
if (url !== "file:./data/ajito-security-lab.db") throw new Error("seed は演習室の専用DBにだけ使えます");
mkdirSync("data", { recursive: true });
const { db, client } = createDb(url);
await runMigrations(db);

const password = "seed-pass-1234";
const boss = await registerWithInvite(db, { code: await createRootInvite(db), handle: "kage", name: "影の番頭", password });
const mika = await registerWithInvite(db, { code: await createInvite(db, boss.id), handle: "mika", name: "ミカ", password });
const ren = await registerWithInvite(db, { code: await createInvite(db, boss.id), handle: "ren", name: "レン", password });
const sora = await registerWithInvite(db, { code: await createInvite(db, mika.id), handle: "sora", name: "そら", password });

const p1 = await createPost(db, mika.id, { body: "駅裏の古本屋、2階に喫茶スペースができてた。誰も知らないうちに通い詰めたい", sealed: false, answersPrompt: true });
const p2 = await createPost(db, ren.id, { body: "来週の小テスト、範囲は教科書の p.84 まで。担任が口を滑らせた", sealed: true, answersPrompt: false });
const p3 = await createPost(db, sora.id, { body: "新入りです。好きなものはカレーパンと深夜ラジオ。よろしく", sealed: false, answersPrompt: false });
await createPost(db, boss.id, { body: "アジトの決まり: ここで聞いた話は、ここだけの話。", sealed: false, answersPrompt: false });

await toggleLike(db, boss.id, p1);
await toggleLike(db, ren.id, p1);
await toggleLike(db, mika.id, p2);
await toggleLike(db, boss.id, p2);
await toggleLike(db, mika.id, p3);
await addComment(db, ren.id, p1, "それ本当?今度案内して");
await addComment(db, boss.id, p3, "ようこそ。カレーパンの情報は高く買う");

const dm = await openDirectRoom(db, mika.id, ren.id);
await sendMessage(db, ren.id, dm, "例の古本屋、土曜行ける?");
await sendMessage(db, mika.id, dm, "行ける。14時に駅裏で");
const group = await createGroupRoom(db, boss.id, "週末作戦会議", [mika.id, ren.id, sora.id]);
await sendMessage(db, boss.id, group, "次の集まりの場所、候補ある人");

client.close();
console.log("お試しデータを入れました。ID: kage / mika / ren / sora、パスワード: seed-pass-1234");
