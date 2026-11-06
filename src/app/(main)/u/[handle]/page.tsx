import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { MemberTags } from "@/components/MemberTags";
import { TitleTag } from "@/components/TitleTag";
import { db } from "@/db";
import { earnedTitleKeys, TITLES } from "@/lib/titles";
import { ConfirmButton } from "@/components/ConfirmButton";
import { blockUserAction, openDirectRoomAction, unblockUserAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import {
  canModerate,
  getFeed,
  getUserByHandle,
  getUserById,
  getUserStats,
  isBlocking,
  isStaff,
} from "@/server/services";
import { toPostView } from "@/server/views";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const me = await requireUser();
  const user = await getUserByHandle(db, decodeURIComponent((await params).handle));
  if (!user) notFound();

  const isMe = user.id === me.id;
  const [stats, inviter, feed, blocking] = await Promise.all([
    getUserStats(db, user.id),
    user.invitedBy ? getUserById(db, user.invitedBy) : null,
    getFeed(db, me.id, { authorId: user.id, limit: 30 }),
    isMe ? false : isBlocking(db, me.id, user.id),
  ]);
  const earned = new Set(earnedTitleKeys(stats));
  const now = new Date();
  const joined = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long" }).format(
    user.createdAt,
  );

  return (
    <>
      <PageHeader title={user.name} en="Dossier" back="/">
        {isMe ? (
          <Link href="/me" className="btn-ghost px-3 py-1 text-sm">
            編集
          </Link>
        ) : (
          <>
            {canModerate(me, user) && (
              <Link href={`/admin#m-${user.handle}`} className="btn-ghost px-3 py-1 text-sm">
                管理
              </Link>
            )}
            {/* 相手からのブロックは見た目に出さない(押すと一般的な文言で断られる) */}
            {!blocking && !user.bannedAt && (
              <form action={openDirectRoomAction.bind(null, user.id)}>
                <button type="submit" className="plate btn-brass px-4 py-1 text-sm">
                  密談する
                </button>
              </form>
            )}
          </>
        )}
      </PageHeader>

      {/* 身上書: 会員証の二重罫と地紋 */}
      <section className="card-frame guilloche fade-in relative mx-gutter mt-7 mb-8 bg-panel px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">Particulars</p>
          <span className="font-latin text-xs tracking-[0.2em] whitespace-nowrap text-cream-dim">AGENT @{user.handle}</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className="rounded-full p-1 shadow-[0_0_0_1px_var(--brass-lo)]">
            <Avatar name={user.name} imageId={user.avatarImageId} size="lg" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-tight tracking-[0.08em] break-words">{user.name}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <MemberTags tags={user} />
            </p>
          </div>
        </div>
        {user.bannedAt && (
          <p role="status" className="mt-4 border border-wine-hi/60 bg-wine/20 px-3 py-2 text-sm text-wine-hi">
            このアカウントは停止中です{isStaff(me) && user.banReason ? `(理由: ${user.banReason})` : ""}
          </p>
        )}
        {user.bio && <p className="mt-4 border-l-2 border-brass-lo/60 pl-3 whitespace-pre-wrap">{user.bio}</p>}
        <p className="mt-3 text-sm text-cream-dim">
          {joined}に入会
          {inviter && (
            <>
              (紹介:
              <Link href={`/u/${inviter.handle}`} className="text-brass-hi underline decoration-brass-lo underline-offset-4">
                {inviter.name}
              </Link>
              )
            </>
          )}
        </p>

        {!isMe && (
          <div className="mt-2 text-sm">
            {blocking ? (
              <p className="flex flex-wrap items-center gap-x-3 text-cream-dim">
                ブロック中です(密談の開始・1対1での発言・会合への招待を断っています)
                <ConfirmButton
                  action={unblockUserAction.bind(null, user.id)}
                  message={`${user.name}のブロックを解きます`}
                  className="text-brass-hi underline decoration-brass-lo underline-offset-4"
                >
                  解除する
                </ConfirmButton>
              </p>
            ) : (
              <ConfirmButton
                action={blockUserAction.bind(null, user.id)}
                message={`${user.name}をブロックします。この人とは密談できなくなり、会合にも誘われなくなります(相手には知らせません)`}
                className="text-cream-dim underline decoration-rule-hi underline-offset-4 hover:text-wine-hi"
              >
                ブロックする
              </ConfirmButton>
            )}
          </div>
        )}

        <dl className="mt-5 grid grid-cols-3 border-y border-rule text-center">
          {[
            ["流した", stats.posts],
            ["買われた", stats.likesReceived],
            ["買った", stats.likesGiven],
          ].map(([label, n]) => (
            <div key={label} className="flex flex-col-reverse border-l border-rule py-2 first:border-l-0">
              <dt className="text-xs text-cream-dim">{label}</dt>
              <dd className="numeral text-2xl leading-tight text-brass-hi">{n}</dd>
            </div>
          ))}
        </dl>

        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-cream-dim hover:text-cream">
            <span aria-hidden className="transition-transform group-open:rotate-90">▸</span>
            称号の記録({earned.size}/{TITLES.length})
          </summary>
          <ul className="mt-3 grid gap-2 text-sm">
            {TITLES.map((t) => (
              <li key={t.key} className={`flex items-center justify-between gap-3 ${earned.has(t.key) ? "" : "opacity-55"}`}>
                {earned.has(t.key) ? <TitleTag titleKey={t.key} /> : <span className="font-latin tracking-[0.3em] text-cream-dim">???</span>}
                <span className="text-right text-xs text-cream-dim">{t.how}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {feed.length === 0 ? (
        <p className="px-gutter py-12 text-center text-cream-dim">まだ情報を流していません</p>
      ) : (
        feed.map((p) => <PostCard key={p.id} post={toPostView(p, now, me)} />)
      )}
    </>
  );
}
