import type { Metadata } from "next";
import Link from "next/link";
import { InviteBox } from "@/components/InviteBox";
import { PageHeader } from "@/components/PageHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { BlockedList, SecurityForm } from "@/components/SecurityForm";
import { db } from "@/db";
import { earnedTitleKeys, TITLES } from "@/lib/titles";
import { logoutAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import { getUserStats, listBlocked, listInvites, MAX_INVITES_PER_DAY, MAX_OPEN_INVITES } from "@/server/services";

export const metadata: Metadata = { title: "自分" };

export default async function MePage() {
  const me = await requireUser();
  const [stats, invites, blocked] = await Promise.all([
    getUserStats(db, me.id),
    listInvites(db, me.id),
    listBlocked(db, me.id),
  ]);
  const earned = earnedTitleKeys(stats);

  return (
    <>
      <PageHeader title="自分" en="Member’s Record">
        <Link href={`/u/${me.handle}`} className="btn-ghost px-3 py-1 text-sm">
          自分のページを見る
        </Link>
      </PageHeader>

      <section aria-labelledby="profile-h" className="panel mx-gutter mt-6 px-5 py-5">
        <p className="eyebrow">Particulars</p>
        <h2 id="profile-h" className="font-display text-lg">
          プロフィール
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-4 text-brass-lo/60" />
        <ProfileForm
          user={{ name: me.name, bio: me.bio, titleKey: me.titleKey, avatarImageId: me.avatarImageId }}
          titles={TITLES.filter((t) => earned.includes(t.key)).map((t) => ({ key: t.key, name: t.name }))}
        />
      </section>

      <section aria-labelledby="invite-h" className="panel mx-gutter mt-5 px-5 py-5">
        <p className="eyebrow">Letters of Introduction</p>
        <h2 id="invite-h" className="font-display text-lg">
          合言葉を渡す
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
        <p className="mt-1 text-sm text-cream-dim">
          友達を招くときは、合言葉か入会リンクを直接渡してください。1つの合言葉で入れるのは1人だけ。{me.isAdmin ? "管理人は未使用の合言葉をいくつでも持てます。" : `未使用のものは${MAX_OPEN_INVITES}つまで、作れるのは1日${MAX_INVITES_PER_DAY}つまでです。`}
        </p>
        <InviteBox
          invites={invites.map((i) => ({
            code: i.code,
            usedByName: i.usedByName,
            usedByHandle: i.usedByHandle,
          }))}
        />
      </section>

      <section aria-labelledby="security-h" className="panel mx-gutter mt-5 px-5 py-5">
        <p className="eyebrow">Lock &amp; Key</p>
        <h2 id="security-h" className="font-display text-lg">
          鍵の管理
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-4 text-brass-lo/60" />
        <SecurityForm />
      </section>

      <section aria-labelledby="blocked-h" className="panel mx-gutter mt-5 px-5 py-5">
        <p className="eyebrow">Closed Doors</p>
        <h2 id="blocked-h" className="font-display text-lg">
          ブロックしている相手
        </h2>
        <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
        <BlockedList users={blocked} />
      </section>

      {(me.isAdmin || me.isModerator) && (
        <section className="panel mx-gutter mt-5 px-5 py-5">
          <p className="eyebrow">Management</p>
          <h2 className="font-display text-lg">{me.isAdmin ? "管理人の部屋" : "副管理人の部屋"}</h2>
          <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
          <p className="text-sm text-cream-dim">会員の管理、BAN、告示、権限の付与はこちらから。</p>
          <Link href="/admin" className="plate btn-brass mt-3 inline-block px-5 py-2">
            管理室へ入る
          </Link>
        </section>
      )}

      <section className="px-gutter py-8 text-center">
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-cream-dim underline decoration-rule-hi underline-offset-4 hover:text-wine-hi">
            ログアウト
          </button>
        </form>
      </section>
    </>
  );
}
