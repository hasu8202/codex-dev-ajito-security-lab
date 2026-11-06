import Link from "next/link";
import { Composer } from "@/components/Composer";
import { DailyDispatch } from "@/components/DailyDispatch";
import { Logo } from "@/components/Emblems";
import { PostCard } from "@/components/PostCard";
import { db } from "@/db";
import { jstDate, promptFor } from "@/lib/prompts";
import { requireUser } from "@/server/auth";
import { getFeed, getLatestAnnouncement } from "@/server/services";
import { Announcement } from "@/components/Announcement";
import { relativeTime } from "@/lib/time";
import { toPostView } from "@/server/views";

const PAGE = 30;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ tab?: string; before?: string }> }) {
  const me = await requireUser();
  const { tab, before } = await searchParams;
  const today = jstDate();
  const prompt = promptFor(today);
  const onlyPrompt = tab === "prompt";
  const beforeDate = before && /^\d+$/.test(before) ? new Date(Number(before)) : undefined;

  const announcement = await getLatestAnnouncement(db);
  const feed = await getFeed(db, me.id, {
    promptDate: onlyPrompt ? today : undefined,
    before: beforeDate,
    limit: PAGE,
  });
  const now = new Date();
  const last = feed.at(-1);

  return (
    <>
      <header className="flex items-center justify-between px-gutter pt-5 lg:hidden">
        <Logo className="w-40" />
        <span className="eyebrow">Members Only</span>
      </header>

      {announcement && <Announcement body={announcement.body} dateLabel={relativeTime(announcement.createdAt)} />}

      <DailyDispatch date={today} prompt={prompt} onlyPrompt={onlyPrompt} />

      <Composer prompt={prompt} answerByDefault={onlyPrompt} />

      <div className="ornament-rule mx-gutter mb-5">
        <span className="eyebrow">{onlyPrompt ? "Replies to the Orders" : "Files on the Desk"}</span>
      </div>

      {feed.length === 0 ? (
        <p className="px-gutter py-16 text-center text-cream-dim">
          {onlyPrompt ? "まだ誰も依頼に応えていません。最初の返答を流してみましょう" : "まだ情報がありません。最初の情報を流してみましょう"}
        </p>
      ) : (
        feed.map((p) => <PostCard key={p.id} post={toPostView(p, now, me)} />)
      )}

      {feed.length === PAGE && last && (
        <div className="py-6 text-center">
          <Link
            href={`/?${new URLSearchParams({ ...(onlyPrompt ? { tab: "prompt" } : {}), before: String(last.createdAt.getTime()) })}`}
            className="btn-ghost px-5 py-1.5 text-sm"
          >
            もっと前の情報
          </Link>
        </div>
      )}
    </>
  );
}
