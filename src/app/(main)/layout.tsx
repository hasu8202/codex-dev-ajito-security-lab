import { Nav } from "@/components/Nav";
import { SidePanel } from "@/components/SidePanel";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { getBadges, getRanking, isStaff, listMembers, listNewcomers } from "@/server/services";

function weekAgo() {
  return new Date(Date.now() - 7 * 86_400_000);
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const [badges, leaders, members, newcomers] = await Promise.all([
    getBadges(db, me.id),
    getRanking(db, weekAgo()),
    listMembers(db),
    listNewcomers(db, 4),
  ]);
  return (
    // 左右の欄を同じ幅にして、本文が画面のまん中に来るようにする。スマホとタブレットは1列で下部ナビ
    <div className="mx-auto grid w-full max-w-[79rem] grid-cols-[minmax(0,40rem)] justify-center lg:grid-cols-[15rem_minmax(0,40rem)] lg:gap-x-8 lg:px-6 xl:grid-cols-[16rem_minmax(0,40rem)_16rem]">
      <Nav notifications={Number(badges.notifications)} rooms={Number(badges.rooms)} staff={isStaff(me)} />
      <main className="min-h-dvh w-full min-w-0 pb-28 lg:pb-12">{children}</main>
      <SidePanel
        leaders={leaders.slice(0, 3).map((r) => ({ ...r, received: Number(r.received) }))}
        newcomers={newcomers}
        memberCount={members.length}
      />
    </div>
  );
}
