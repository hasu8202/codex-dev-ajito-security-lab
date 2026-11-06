import { describe, expect, it } from "vitest";
import { fileNumber, gazetteDates, issueNumber } from "@/lib/dossier";
import { newInviteCode, normalizeInviteCode } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/password";
import { jstDate, PROMPTS, promptFor } from "@/lib/prompts";
import { earnedTitleKeys, type UserStats } from "@/lib/titles";
import { jstHour, relativeTime } from "@/lib/time";
import { handleSchema, signupSchema } from "@/lib/validation";

describe("パスワード", () => {
  it("同じパスワードだけ一致する", async () => {
    const h = await hashPassword("correct horse");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong horse", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("合言葉", () => {
  it("XXXX-XXXX 形式で、紛らわしい文字を含まない", () => {
    for (let i = 0; i < 50; i++) expect(newInviteCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });
  it("入力ゆれを直す", () => {
    expect(normalizeInviteCode(" k7qm r2xh ")).toBe("K7QM-R2XH");
    expect(normalizeInviteCode("K7QMR2XH")).toBe("K7QM-R2XH");
  });
});

describe("今日の依頼", () => {
  it("日本時間で日付が変わる", () => {
    expect(jstDate(new Date("2026-11-04T14:59:00Z"))).toBe("2026-11-04");
    expect(jstDate(new Date("2026-11-04T15:00:00Z"))).toBe("2026-11-05");
  });
  it("日ごとに決まった依頼が出て、一巡するまで重ならない", () => {
    const seen = new Set<string>();
    const start = Date.parse("2026-01-01T00:00:00Z");
    for (let i = 0; i < PROMPTS.length; i++) {
      seen.add(promptFor(new Date(start + i * 86_400_000).toISOString().slice(0, 10)));
    }
    expect(seen.size).toBe(PROMPTS.length);
    expect(promptFor("2026-11-04")).toBe(promptFor("2026-11-04"));
  });
});

describe("称号", () => {
  const zero: UserStats = {
    posts: 0, likesGiven: 0, likesReceived: 0, comments: 0,
    promptAnswers: 0, invitesUsed: 0, sealedPosts: 0, nightPosts: 0,
  };
  it("最初は新入りだけ", () => {
    expect(earnedTitleKeys(zero)).toEqual(["newcomer"]);
  });
  it("条件に応じて増える", () => {
    const keys = earnedTitleKeys({ ...zero, posts: 50, likesReceived: 30 });
    expect(keys).toEqual(expect.arrayContaining(["informant", "veteran", "popular"]));
    expect(keys).not.toContain("legend");
  });
});

describe("時刻表示", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("相対表示", () => {
    expect(relativeTime(new Date(now.getTime() - 30_000), now)).toBe("たった今");
    expect(relativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5分前");
    expect(relativeTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3時間前");
  });
  it("日本時間の時", () => {
    expect(jstHour(new Date("2026-11-04T16:30:00Z"))).toBe(1);
  });
});

describe("入力チェック", () => {
  it("IDは英小文字・数字・_ のみ", () => {
    expect(handleSchema.parse("Agent_7")).toBe("agent_7");
    expect(handleSchema.safeParse("ab").success).toBe(false);
    expect(handleSchema.safeParse("日本語").success).toBe(false);
  });
  it("パスワードは8文字以上", () => {
    const r = signupSchema.safeParse({ code: "x", handle: "abc", name: "a", password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("書類の番号と日付", () => {
  it("整理番号は4桁で、同じIDなら同じ番号", () => {
    expect(fileNumber("abc")).toMatch(/^\d{4}$/);
    expect(fileNumber("abc")).toBe(fileNumber("abc"));
    expect(fileNumber("abc")).not.toBe(fileNumber("abd"));
  });

  it("号数は元日が第1号で、それより前も1号にする", () => {
    expect(issueNumber("2026-01-01")).toBe(1);
    expect(issueNumber("2026-11-05")).toBe(309);
    expect(issueNumber("2025-12-31")).toBe(1);
  });

  it("日付を英語と和暦で書く", () => {
    expect(gazetteDates("2026-11-05")).toEqual({ en: "Thursday, 5 November 2026", ja: "令和8年11月5日" });
  });
});
