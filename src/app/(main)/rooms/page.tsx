import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { WaxSeal } from "@/components/Emblems";
import { GroupForm } from "@/components/GroupForm";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { relativeTime } from "@/lib/time";
import { requireUser } from "@/server/auth";
import { listMembers, listRooms } from "@/server/services";

export const metadata: Metadata = { title: "密談" };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ unavailable?: string }> }) {
  const me = await requireUser();
  const { unavailable } = await searchParams;
  const [rooms, members] = await Promise.all([listRooms(db, me.id), listMembers(db)]);
  const now = new Date();

  return (
    <>
      <PageHeader title="密談" en="Private Correspondence" />
      <p className="px-gutter pt-4 text-sm text-cream-dim">
        ここだけの話をする場所です。既読は付きません。1対1は相手のページの「密談する」から始められます。
      </p>
      {unavailable && (
        <p role="alert" className="px-gutter pt-2 text-sm text-wine-hi">
          この相手とは密談できません
        </p>
      )}

      {rooms.length === 0 ? (
        <p className="px-gutter py-12 text-center text-cream-dim">
          まだ密談はありません。
          <Link href="/members" className="text-brass-hi underline underline-offset-4">
            名簿
          </Link>
          から相手を選んでください
        </p>
      ) : (
        <ul className="mx-gutter mt-5 space-y-3">
          {rooms.map((r) => (
            <li key={r.id}>
              {/* 封筒の表書き: 切手(相手の肖像)・宛名・消印 */}
              <Link
                href={`/rooms/${r.id}`}
                className="dossier on-paper fade-in group flex items-center gap-4 py-2.5 pr-4 pl-3 transition-transform hover:-translate-y-0.5"
              >
                <span className="postage shrink-0 shadow-sm">
                  {r.isGroup ? (
                    <span className="grid size-11 place-items-center bg-[radial-gradient(circle_at_35%_30%,#2c4a3f,#13241e_70%)] font-display text-lg text-brass-hi">
                      {r.others.length + 1}
                    </span>
                  ) : (
                    <span className="block size-11 [&>*]:size-11! [&>*]:rounded-none! [&>*]:shadow-none!">
                      <Avatar name={r.title} imageId={r.others[0]?.avatarImageId} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow eyebrow-paper block">{r.isGroup ? "Assembly" : "Private"}</span>
                  <span className={`block truncate font-display text-[15px] tracking-[0.06em] ${r.unread ? "font-bold" : ""}`}>
                    {r.title} <span className="text-sm font-normal text-parch-dim">{r.isGroup ? "御一同様" : "様"}</span>
                  </span>
                  <span className="text-xs text-parch-dim">
                    {r.isGroup ? `会合・${r.others.length + 1}人` : "1対1"}
                    {r.lastMessageAt && `/${relativeTime(r.lastMessageAt, now)}`}
                  </span>
                </span>
                {r.unread ? (
                  <span className="flex flex-col items-center gap-0.5 text-xs font-bold text-wine">
                    <WaxSeal className="size-7" />
                    新着
                  </span>
                ) : (
                  <span aria-hidden className="font-latin text-xs tracking-[0.2em] text-parch-dim group-hover:text-parch-dim">
                    OPEN →
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="panel group mx-gutter my-8 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-display tracking-[0.1em] text-brass-hi">
          <span aria-hidden className="transition-transform group-open:rotate-90">▸</span>
          会合(グループ)を作る
        </summary>
        <GroupForm members={members.filter((m) => m.id !== me.id).map((m) => ({ id: m.id, name: m.name, handle: m.handle }))} />
      </details>
    </>
  );
}
