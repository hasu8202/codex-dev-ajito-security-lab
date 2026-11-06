"use client";

import { useActionState } from "react";
import {
  banUserAction,
  clearAnnouncementsAction,
  postAnnouncementAction,
  setCustomTitleAction,
  setRoleAction,
  unbanUserAction,
  type FormState,
} from "@/server/actions";
import type { Role } from "@/server/services";
import { ConfirmButton } from "./ConfirmButton";

const smallBtn = "btn-ghost px-3 py-1 text-sm";

function Message({ state, okText }: { state: FormState; okText: string }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-wine-hi">
        {state.error}
      </p>
    );
  }
  return state?.ok ? <p className="text-sm text-brass-hi">{okText}</p> : null;
}

export type ControlTarget = {
  id: string;
  name: string;
  isAdmin: boolean;
  isModerator: boolean;
  customTitle: string | null;
  banned: boolean;
};

/** 1人の会員への操作。viewer が管理人のときだけ権限と称号、自分より下の位の相手にだけ BAN を出す */
export function MemberControls({
  target,
  viewerIsAdmin,
  canBan,
  isSelf,
}: {
  target: ControlTarget;
  viewerIsAdmin: boolean;
  canBan: boolean;
  isSelf: boolean;
}) {
  const [banState, banAction, banPending] = useActionState<FormState, FormData>(
    banUserAction.bind(null, target.id),
    undefined,
  );
  const [titleState, titleAction, titlePending] = useActionState<FormState, FormData>(
    setCustomTitleAction.bind(null, target.id),
    undefined,
  );

  if (isSelf) return <p className="text-sm text-cream-dim">自分自身の権限や状態は、ここからは変えられません。</p>;

  const role: Role = target.isAdmin ? "admin" : target.isModerator ? "moderator" : "member";
  const roleButtons: { to: Role; label: string }[] = [
    { to: "member", label: "会員に戻す" },
    { to: "moderator", label: "副管理人にする" },
    { to: "admin", label: "管理人にする" },
  ];

  return (
    <div className="space-y-5">
      {viewerIsAdmin && (
        <section aria-label="権限">
          <p className="eyebrow">Authority · 権限</p>
          <p className="mt-1 text-xs text-cream-dim">
            副管理人は情報や追記の削除とBANができます。管理人はそれに加えて、権限の付与・称号・告示もできます。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roleButtons
              .filter((b) => b.to !== role)
              .map((b) => (
                <ConfirmButton
                  key={b.to}
                  action={setRoleAction.bind(null, target.id, b.to)}
                  message={
                    b.to === "admin"
                      ? `${target.name}を管理人にします。管理人は他の人の権限も変えられます。よろしいですか?`
                      : `${target.name}を「${b.label.replace("にする", "").replace("に戻す", "")}」にします`
                  }
                  className={smallBtn}
                >
                  {b.label}
                </ConfirmButton>
              ))}
          </div>
        </section>
      )}

      {viewerIsAdmin && (
        <section aria-label="特別な称号">
          <p className="eyebrow">Distinction · 特別な称号</p>
          <form action={titleAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input
              name="title"
              defaultValue={target.customTitle ?? ""}
              maxLength={12}
              placeholder="例: 名誉会員(空にすると取り上げ)"
              aria-label="特別な称号"
              className="field min-w-0 flex-1 py-1.5 text-sm"
            />
            <button type="submit" disabled={titlePending} className={smallBtn}>
              {titlePending ? "保存中…" : "贈る / 変える"}
            </button>
          </form>
          <div className="mt-1">
            <Message state={titleState} okText="称号を更新しました" />
          </div>
        </section>
      )}

      {canBan && (
        <section aria-label="BAN">
          <p className="eyebrow">Suspension · BAN</p>
          {target.banned ? (
            <div className="mt-2">
              <ConfirmButton
                action={unbanUserAction.bind(null, target.id)}
                message={`${target.name}のBANを解きます`}
                className={smallBtn}
              >
                BANを解く
              </ConfirmButton>
            </div>
          ) : (
            <form
              action={banAction}
              onSubmit={(e) => {
                if (!window.confirm(`${target.name}をBANします。すぐにログアウトされ、入れなくなります。よろしいですか?`)) {
                  e.preventDefault();
                }
              }}
              className="mt-2 space-y-2"
            >
              <input name="reason" maxLength={100} placeholder="理由(本人がログインしようとしたときに表示されます)" aria-label="BANの理由" className="field py-1.5 text-sm" />
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="deleteContent" className="peer sr-only" />
                <span className="check-box on-night" aria-hidden>
                  <svg viewBox="0 0 16 16" className="size-3.5">
                    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                この人の情報と追記もすべて消す
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="withInvitees" className="peer sr-only" />
                <span className="check-box on-night" aria-hidden>
                  <svg viewBox="0 0 16 16" className="size-3.5">
                    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                この人の紹介で入った会員もまとめて止める(捨てアカウント対策)
              </label>
              <button type="submit" disabled={banPending} className="rounded-sm bg-wine px-4 py-1.5 text-sm text-cream hover:brightness-110 disabled:opacity-60">
                {banPending ? "処理中…" : "BANする"}
              </button>
              <Message state={banState} okText="BANしました" />
            </form>
          )}
        </section>
      )}
    </div>
  );
}

/** 告示(掲示板の上に出るお知らせ)の投稿と取り下げ */
export function AnnouncementForm({ hasCurrent }: { hasCurrent: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await postAnnouncementAction(prev, fd);
    return result;
  }, undefined);
  return (
    <div className="mt-3 space-y-2">
      <form action={action} className="space-y-2">
        <textarea
          name="body"
          required
          maxLength={300}
          rows={3}
          placeholder="全員に向けた告示を書く(300文字まで)。新しく出すと前の告示と入れ替わります"
          aria-label="告示の本文"
          className="field text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="plate btn-brass px-5 py-1.5 text-sm">
            {pending ? "掲示しています…" : "告示を出す"}
          </button>
          <Message state={state} okText="掲示しました" />
        </div>
      </form>
      {hasCurrent && (
        <ConfirmButton
          action={clearAnnouncementsAction}
          message="いまの告示を取り下げます"
          className="text-sm text-cream-dim underline decoration-rule-hi underline-offset-4 hover:text-wine-hi"
        >
          いまの告示を取り下げる
        </ConfirmButton>
      )}
    </div>
  );
}
