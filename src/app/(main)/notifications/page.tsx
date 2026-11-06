import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { WaxSeal } from "@/components/Emblems";
import { MarkRead } from "@/components/MarkRead";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { relativeTime } from "@/lib/time";
import { titleName } from "@/lib/titles";
import { requireUser } from "@/server/auth";
import { listNotifications } from "@/server/services";

export const metadata: Metadata = { title: "知らせ" };

// 電報の種別を英字で添える
const kindLabel: Record<string, string> = {
  like: "Purchase",
  comment: "Annotation",
  joined: "New Member",
  title: "Distinction",
  notice: "Notice",
};

export default async function NotificationsPage() {
  const me = await requireUser();
  const list = await listNotifications(db, me.id);
  const now = new Date();
  const hasUnread = list.some((n) => !n.readAt);

  return (
    <>
      <PageHeader title="知らせ" en="Telegrams Received" />
      {hasUnread && <MarkRead />}
      {list.length === 0 ? (
        <p className="px-gutter py-16 text-center text-cream-dim">まだ知らせはありません。情報を流すと、ここに反応が届きます</p>
      ) : (
        <ul className="mx-gutter mt-4 space-y-2">
          {list.map((n) => {
            const who = n.actor?.name ?? "誰か";
            const text =
              n.kind === "like"
                ? `${who}があなたの情報を買いました`
                : n.kind === "comment"
                  ? `${who}が追記しました: ${n.detail ?? ""}`
                  : n.kind === "joined"
                    ? `あなたの合言葉で${who}が入会しました`
                    : n.kind === "notice"
                      ? (n.detail ?? "管理人からのお知らせです")
                      : `称号「${titleName(n.detail ?? "")}」を手に入れました。自分のページで名乗れます`;
            const href =
              n.kind === "title" || n.kind === "notice" ? "/me" : n.kind === "joined" && n.actor ? `/u/${n.actor.handle}` : n.postId ? `/posts/${n.postId}` : "/";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={`group relative flex items-start gap-3 rounded-sm border px-3.5 py-3 transition-colors ${
                    n.readAt
                      ? "border-rule bg-panel/50 hover:border-rule-hi hover:bg-panel"
                      : "border-brass/45 bg-[linear-gradient(90deg,rgb(201_165_92/0.13),rgb(201_165_92/0.03))] hover:border-brass"
                  }`}
                >
                  {n.kind === "title" || n.kind === "notice" ? (
                    <WaxSeal emblem="star" className="size-11 shrink-0" />
                  ) : (
                    <Avatar name={who} imageId={n.actor?.avatarImageId} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block">
                      {kindLabel[n.kind] ?? "Notice"}
                      {!n.readAt && <span className="ml-2 text-wine-hi">· New</span>}
                    </span>
                    <span className="block break-words text-[15px]">{text}</span>
                    <span className="text-xs text-cream-dim">{relativeTime(n.createdAt, now)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
