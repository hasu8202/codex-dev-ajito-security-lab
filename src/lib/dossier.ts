/** 見た目のための番号や日付の書き方。DB には保存しない */

/** 投稿IDから調書の整理番号(4桁)を作る。同じIDなら毎回同じ番号 */
export function fileNumber(id: string): string {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 10000).padStart(4, "0");
}

/** 「本日の指令」の号数。2026-01-01 を第1号として日ごとに1つ進む */
export function issueNumber(date: string): number {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse("2026-01-01T00:00:00Z")) / 86_400_000);
  return Math.max(1, days + 1);
}

/** YYYY-MM-DD(日本時間の日付)を「Thursday, 5 November 2026」と「令和8年11月5日」に */
export function gazetteDates(date: string): { en: string; ja: string } {
  const d = new Date(`${date}T12:00:00+09:00`);
  const tz = { timeZone: "Asia/Tokyo" } as const;
  return {
    en: new Intl.DateTimeFormat("en-GB", { ...tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    ja: new Intl.DateTimeFormat("ja-JP-u-ca-japanese", { ...tz, era: "long", year: "numeric", month: "long", day: "numeric" }).format(d),
  };
}
