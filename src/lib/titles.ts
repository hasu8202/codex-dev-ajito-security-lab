export type UserStats = {
  posts: number;
  likesGiven: number;
  likesReceived: number;
  comments: number;
  promptAnswers: number;
  invitesUsed: number;
  sealedPosts: number;
  nightPosts: number;
};

export type Title = {
  key: string;
  name: string;
  how: string;
  earned: (s: UserStats) => boolean;
};

// 並び順はおおむね取りやすい順
export const TITLES: Title[] = [
  { key: "newcomer", name: "新入り", how: "アジトに入る", earned: () => true },
  { key: "informant", name: "見習い情報屋", how: "情報を5件流す", earned: (s) => s.posts >= 5 },
  { key: "connoisseur", name: "目利き", how: "情報を20件買う", earned: (s) => s.likesGiven >= 20 },
  { key: "talker", name: "口利き", how: "コメントを20件書く", earned: (s) => s.comments >= 20 },
  { key: "fixer", name: "依頼請負人", how: "今日の依頼に5回応える", earned: (s) => s.promptAnswers >= 5 },
  { key: "shadow", name: "封書の名手", how: "封をした情報を5件流す", earned: (s) => s.sealedPosts >= 5 },
  { key: "owl", name: "夜の住人", how: "深夜0〜4時に情報を3件流す", earned: (s) => s.nightPosts >= 3 },
  { key: "recruiter", name: "スカウト", how: "合言葉で2人を招く", earned: (s) => s.invitesUsed >= 2 },
  { key: "popular", name: "売れっ子", how: "情報を合計30回買われる", earned: (s) => s.likesReceived >= 30 },
  { key: "veteran", name: "古株", how: "情報を50件流す", earned: (s) => s.posts >= 50 },
  { key: "legend", name: "伝説の情報屋", how: "情報を合計150回買われる", earned: (s) => s.likesReceived >= 150 },
];

export function titleName(key: string): string {
  return TITLES.find((t) => t.key === key)?.name ?? "新入り";
}

export function earnedTitleKeys(stats: UserStats): string[] {
  return TITLES.filter((t) => t.earned(stats)).map((t) => t.key);
}
