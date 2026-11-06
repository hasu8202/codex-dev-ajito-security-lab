import "server-only";
import { LAB_DATABASE_URL } from "@/lib/lab-safety";
import { createDb, type Db } from "./client";

export type { Db } from "./client";

const g = globalThis as unknown as { __ajitoSecurityLabDb?: Db };

function resolveDb(): Db {
  const databaseUrl = process.env.DATABASE_URL || LAB_DATABASE_URL;
  if (databaseUrl !== LAB_DATABASE_URL) throw new Error("演習室は専用データベースでのみ実行できます。");
  return (g.__ajitoSecurityLabDb ??= createDb(databaseUrl).db);
}

// D1 はリクエストの中でしか取れないので、使う瞬間に本物の接続へ振り向ける
export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    const real = resolveDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
