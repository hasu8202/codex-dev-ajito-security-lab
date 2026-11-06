import Link from "next/link";
import { Avatar } from "./Avatar";
import { relativeTime } from "@/lib/time";

type Person = { id: string; handle: string; name: string; avatarImageId: string | null };
type Newcomer = Person & { joinedAt: Date; lastPostAt: number | null };

const DAY = 86_400_000;

/** PC の右側の補助欄。既存の番付と名簿から出せる範囲だけを載せる */
export function SidePanel({
  leaders,
  newcomers,
  memberCount,
}: {
  leaders: (Person & { received: number })[];
  newcomers: Newcomer[];
  memberCount: number;
}) {
  const now = new Date();
  return (
    <aside aria-label="補助欄" className="sticky top-0 hidden h-dvh space-y-6 overflow-y-auto py-8 xl:block">
      <section aria-labelledby="side-trend" className="panel px-5 py-4">
        <p className="eyebrow">Today&rsquo;s Movements</p>
        <h2 id="side-trend" className="mt-0.5 font-display text-base">
          本日の動向
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
        {leaders.length === 0 ? (
          <p className="text-sm text-cream-dim">この7日はまだ静かです。</p>
        ) : (
          <ol className="space-y-2.5">
            {leaders.map((r, i) => (
              <li key={r.id}>
                <Link href={`/u/${r.handle}`} className="group flex items-center gap-3">
                  <span className="numeral w-4 text-center text-lg text-brass">{["I", "II", "III"][i]}</span>
                  <Avatar name={r.name} imageId={r.avatarImageId} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm group-hover:text-brass-hi">{r.name}</span>
                  <span className="text-xs text-cream-dim">
                    <span className="numeral text-base text-cream">{r.received}</span> 買
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <Link href="/ranking" className="mt-3 inline-block text-xs text-brass underline-offset-4 hover:underline">
          番付をすべて見る →
        </Link>
      </section>

      <section aria-labelledby="side-new" className="panel px-5 py-4">
        <p className="eyebrow">New Agents</p>
        <h2 id="side-new" className="mt-0.5 font-display text-base">
          新入りエージェント
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
        <ul className="space-y-3">
          {newcomers.map((m) => (
            <li key={m.id}>
              <Link href={`/u/${m.handle}`} className="group flex items-center gap-3">
                <Avatar name={m.name} imageId={m.avatarImageId} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm group-hover:text-brass-hi">{m.name}</span>
                  <span className="block truncate text-xs leading-5 text-cream-dim">
                    入会<span className="numeral mx-0.5 text-[0.8125rem] text-cream">{Math.floor((now.getTime() - m.joinedAt.getTime()) / DAY) + 1}</span>日目
                    <span aria-hidden className="mx-1.5 text-brass-lo">·</span>
                    {m.lastPostAt ? `報告 ${relativeTime(new Date(m.lastPostAt), now)}` : "報告はまだ"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/members" className="mt-3 inline-block text-xs text-brass underline-offset-4 hover:underline">
          名簿を開く({memberCount}名在籍)→
        </Link>
      </section>

      <footer className="px-1 text-center">
        <div className="ornament-rule text-xs">◆</div>
        <p className="mt-2 font-latin text-[0.9375rem] leading-snug text-cream-dim italic">Discretion is the better part of valour.</p>
        <p className="mt-1 text-xs text-cream-dim">情報屋アジト · 会員制</p>
      </footer>
    </aside>
  );
}
