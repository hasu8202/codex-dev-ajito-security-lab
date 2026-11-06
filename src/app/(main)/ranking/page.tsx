import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Medal } from "@/components/Emblems";
import { PageHeader } from "@/components/PageHeader";
import { MemberTags } from "@/components/MemberTags";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { getRanking } from "@/server/services";

export const metadata: Metadata = { title: "番付" };

function weekAgo() {
  return new Date(Date.now() - 7 * 86_400_000);
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ span?: string }> }) {
  await requireUser();
  const { span } = await searchParams;
  const weekly = span !== "all";
  const rows = await getRanking(db, weekly ? weekAgo() : undefined);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const tab = (on: boolean) => `px-4 py-1 text-sm font-display tracking-[0.14em] ${on ? "plate" : "btn-ghost text-cream-dim!"}`;

  return (
    <>
      <PageHeader title="情報屋番付" en="Order of Merit">
        <Link href="/members" className="btn-ghost px-3 py-1 text-sm">
          名簿
        </Link>
      </PageHeader>

      <div className="flex items-center gap-2 px-gutter pt-5">
        <Link href="/ranking" className={tab(weekly)} aria-current={weekly ? "page" : undefined}>
          この7日
        </Link>
        <Link href="/ranking?span=all" className={tab(!weekly)} aria-current={!weekly ? "page" : undefined}>
          これまで
        </Link>
      </div>
      <p className="px-gutter pt-3 pb-5 text-xs text-cream-dim">情報が買われた数の順。同じ数なら、多く流した人が上です。</p>

      {rows.length === 0 ? (
        <p className="px-gutter py-16 text-center text-cream-dim">この期間はまだ動きがありません</p>
      ) : (
        <>
          {/* 上位3人: 勲章を授けられた者 */}
          <ol className="mx-gutter grid gap-3 sm:grid-cols-3">
            {podium.map((r, i) => (
              <li key={r.id} className={i === 0 ? "sm:order-2" : i === 1 ? "sm:order-1 sm:mt-6" : "sm:order-3 sm:mt-10"}>
                <Link
                  href={`/u/${r.handle}`}
                  className="dossier on-paper fade-in group flex items-center gap-4 px-4 py-3 transition-transform hover:-translate-y-0.5 sm:flex-col sm:gap-1.5 sm:px-3 sm:pt-0 sm:pb-4 sm:text-center"
                >
                  <Medal place={i as 0 | 1 | 2} className="w-11 shrink-0 sm:-mt-1 sm:w-14" />
                  <span className="min-w-0 flex-1 sm:flex sm:flex-col sm:items-center">
                    <span className="eyebrow eyebrow-paper block">{["First", "Second", "Third"][i]} Class</span>
                    <span className="mt-0.5 flex items-center gap-2 sm:flex-col sm:gap-1.5">
                      <Avatar name={r.name} imageId={r.avatarImageId} size="sm" />
                      <span className="truncate font-display font-bold tracking-[0.06em] group-hover:underline group-hover:decoration-parch-rule group-hover:underline-offset-4">
                        {r.name}
                      </span>
                    </span>
                    <span className="mt-1 block">
                      <MemberTags tags={r} onPaper />
                    </span>
                  </span>
                  <span className="text-right sm:mt-1 sm:text-center">
                    <span className="numeral block text-3xl leading-none">{r.received}</span>
                    <span className="block text-xs text-parch-dim">買われた</span>
                    <span className="block text-xs text-parch-dim">流した {r.posted}件</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {rest.length > 0 && (
            <>
              <div className="ornament-rule mx-gutter mt-8 mb-2">
                <span className="eyebrow">Honourable Mentions</span>
              </div>
              <ol start={4} className="mx-gutter">
                {rest.map((r, i) => (
                  <li key={r.id} className="border-b border-rule">
                    <Link href={`/u/${r.handle}`} className="group flex items-center gap-3 py-3 transition-colors hover:bg-panel/60">
                      <span className="numeral w-8 text-center text-xl text-cream-dim">{i + 4}</span>
                      <Avatar name={r.name} imageId={r.avatarImageId} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate font-display group-hover:text-brass-hi">{r.name}</span>
                          <MemberTags tags={r} />
                        </span>
                        <span className="text-xs text-cream-dim">流した情報 {r.posted}件</span>
                      </span>
                      <span className="pr-1 text-right">
                        <span className="numeral block text-xl text-brass-hi">{r.received}</span>
                        <span className="text-xs text-cream-dim">買われた</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </>
  );
}
