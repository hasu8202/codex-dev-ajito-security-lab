import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementForm, MemberControls } from "@/components/AdminControls";
import { Avatar } from "@/components/Avatar";
import { MemberTags } from "@/components/MemberTags";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/db";
import { relativeTime } from "@/lib/time";
import { requireStaff } from "@/server/auth";
import {
  canModerate,
  getAdminOverview,
  getLatestAnnouncement,
  listAdminLogs,
  listMembersForAdmin,
} from "@/server/services";

export const metadata: Metadata = { title: "管理室" };

const ACTION_LABEL: Record<string, string> = {
  "post.delete": "情報を削除",
  "comment.delete": "追記を削除",
  ban: "BAN",
  unban: "BAN解除",
  role: "権限を変更",
  title: "特別な称号",
  announce: "告示を出した",
  "announce.clear": "告示を取り下げた",
};

function megabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

export default async function AdminPage() {
  const me = await requireStaff();
  const [overview, members, logs, announcement] = await Promise.all([
    getAdminOverview(db),
    listMembersForAdmin(db),
    listAdminLogs(db, 40),
    getLatestAnnouncement(db),
  ]);
  const now = new Date();
  const stats: [string, number | string][] = [
    ["会員", Number(overview.members)],
    ["BAN中", Number(overview.banned)],
    ["情報", Number(overview.posts)],
    ["追記", Number(overview.comments)],
    ["未使用の合言葉", Number(overview.openInvites)],
    ["画像の容量", megabytes(Number(overview.imageBytes))],
  ];

  return (
    <>
      <PageHeader title="管理室" en={me.isAdmin ? "Management Office" : "Moderator’s Office"} back="/me" />

      <section aria-label="状況" className="panel mx-gutter mt-6 px-5 py-4">
        <p className="eyebrow">Ledger</p>
        <dl className="mt-2 grid grid-cols-3 gap-y-3 text-center">
          {stats.map(([label, n]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-cream-dim">{label}</dt>
              <dd className="numeral text-2xl leading-tight text-brass-hi">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-rule pt-3 text-xs text-cream-dim">
          投稿の削除は、掲示板や調書のページにある「管理削除」から行えます。削除された人には知らせが届きます。
        </p>
      </section>

      {me.isAdmin && (
        <section aria-labelledby="announce-h" className="panel mx-gutter mt-5 px-5 py-5">
          <p className="eyebrow">Notice</p>
          <h2 id="announce-h" className="font-display text-lg">
            告示
          </h2>
          <div aria-hidden className="double-rule mt-2 mb-1 text-brass-lo/60" />
          {announcement ? (
            <p className="mt-3 border-l-2 border-brass-lo/60 pl-3 text-sm whitespace-pre-wrap">{announcement.body}</p>
          ) : (
            <p className="mt-3 text-sm text-cream-dim">いまの告示はありません。</p>
          )}
          <AnnouncementForm hasCurrent={!!announcement} />
        </section>
      )}

      <section aria-labelledby="members-h" className="mx-gutter mt-5">
        <div className="ornament-rule mb-3">
          <h2 id="members-h" className="eyebrow">
            Register · 会員の管理
          </h2>
        </div>
        <ul>
          {members.map((m) => {
            const isSelf = m.id === me.id;
            const canBan = canModerate(me, m);
            const hasControls = !isSelf && (me.isAdmin || canBan);
            return (
              <li key={m.id} id={`m-${m.handle}`} className="border-b border-rule scroll-mt-24">
                <details className="group" open={undefined}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-1 py-3 hover:bg-panel/60 sm:px-2">
                    <Avatar name={m.name} imageId={null} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate font-display tracking-[0.06em]">{m.name}</span>
                        <MemberTags tags={m} />
                        {m.bannedAt && (
                          <span className="rounded-sm border border-wine-hi/70 px-1.5 py-px text-xs leading-4 text-wine-hi">BAN中</span>
                        )}
                      </span>
                      <span className="text-xs text-cream-dim">
                        <span className="font-latin tracking-[0.12em]">AGENT</span> @{m.handle}
                        <span className="mx-1.5 text-rule-hi">/</span>
                        情報 {Number(m.postCount)}件
                        <span className="mx-1.5 text-rule-hi">/</span>
                        {relativeTime(m.createdAt, now)}に入会
                      </span>
                    </span>
                    <span aria-hidden className="text-cream-dim transition-transform group-open:rotate-90">
                      ▸
                    </span>
                  </summary>
                  <div className="space-y-4 px-2 pt-1 pb-5 sm:px-3">
                    {m.bannedAt && m.banReason && <p className="text-sm text-wine-hi">BANの理由: {m.banReason}</p>}
                    {hasControls || isSelf ? (
                      <MemberControls
                        target={{
                          id: m.id,
                          name: m.name,
                          isAdmin: m.isAdmin,
                          isModerator: m.isModerator,
                          customTitle: m.customTitle,
                          banned: !!m.bannedAt,
                        }}
                        viewerIsAdmin={me.isAdmin}
                        canBan={canBan}
                        isSelf={isSelf}
                      />
                    ) : (
                      <p className="text-sm text-cream-dim">同じか上の位の人なので、ここでは操作できません。</p>
                    )}
                    <Link href={`/u/${m.handle}`} className="inline-block text-sm text-brass-hi underline decoration-brass-lo underline-offset-4">
                      ページを見る
                    </Link>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="log-h" className="mx-gutter mt-8">
        <div className="ornament-rule mb-3">
          <h2 id="log-h" className="eyebrow">
            Record · 管理の記録
          </h2>
        </div>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-cream-dim">まだ記録はありません。</p>
        ) : (
          <ol className="space-y-px text-sm">
            {logs.map((l) => (
              <li key={l.id} className="border-l-2 border-brass-lo/50 py-1.5 pl-3">
                <p>
                  <span className="font-display">{l.actorName ?? "(退会した人)"}</span>
                  <span className="mx-1.5 text-cream-dim">が</span>
                  {l.targetName && (
                    <>
                      <Link href={`/u/${l.targetHandle}`} className="font-display hover:text-brass-hi">
                        {l.targetName}
                      </Link>
                      <span className="mx-1.5 text-cream-dim">に</span>
                    </>
                  )}
                  <span className="text-brass-hi">{ACTION_LABEL[l.action] ?? l.action}</span>
                </p>
                <p className="text-xs break-words text-cream-dim">
                  {l.detail && <>{l.detail}<span className="mx-1.5">·</span></>}
                  {relativeTime(l.createdAt, now)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="h-8" />
    </>
  );
}
