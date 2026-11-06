// DB の表を最新にする。npm run dev / build の前に自動で走る
import { mkdirSync } from "node:fs";
import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";

const url = process.env.DATABASE_URL || "file:./data/ajito-security-lab.db";
if (url !== "file:./data/ajito-security-lab.db") throw new Error("演習室は専用DBでのみ実行できます");
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });

const { db, client } = createDb(url);
await runMigrations(db);
client.close();
console.log("DB ready:", url.startsWith("file:") ? url : "(remote)");
