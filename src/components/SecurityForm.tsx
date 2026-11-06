"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import {
  changePasswordAction,
  logoutOtherSessionsAction,
  unblockUserAction,
  type FormState,
} from "@/server/actions";
import { ConfirmButton } from "./ConfirmButton";

const field = "field mt-1";

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

/** パスワードの変更と、ほかの端末からのログアウト */
export function SecurityForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await changePasswordAction(prev, fd);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, undefined);
  const [outState, outAction, outPending] = useActionState<FormState, FormData>(
    () => logoutOtherSessionsAction(),
    undefined,
  );

  return (
    <div className="space-y-6">
      <form ref={formRef} action={pwAction} className="space-y-3">
        <label className="block">
          <span className="text-sm text-cream-dim">今のパスワード</span>
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
        <label className="block">
          <span className="text-sm text-cream-dim">新しいパスワード(8〜72文字)</span>
          <input name="next" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
        <label className="block">
          <span className="text-sm text-cream-dim">新しいパスワード(確認)</span>
          <input name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pwPending} className="plate btn-brass px-5 py-2">
            {pwPending ? "変えています…" : "パスワードを変える"}
          </button>
          <Message state={pwState} okText="変えました。ほかの端末はログアウトされました" />
        </div>
      </form>

      <form action={outAction} className="space-y-2">
        <p className="text-sm text-cream-dim">
          心当たりのない端末で使われているかもしれないときは、この端末だけを残して、ほかをすべてログアウトできます。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={outPending} className="btn-ghost px-4 py-1.5 text-sm">
            {outPending ? "処理中…" : "ほかの端末からログアウト"}
          </button>
          <Message state={outState} okText="ほかの端末をログアウトしました" />
        </div>
      </form>
    </div>
  );
}

type Blocked = { id: string; handle: string; name: string };

/** ブロックしている相手の一覧と解除 */
export function BlockedList({ users }: { users: Blocked[] }) {
  if (users.length === 0) {
    return <p className="text-sm text-cream-dim">ブロックしている相手はいません。相手のページから「ブロックする」を選べます。</p>;
  }
  return (
    <ul className="divide-y divide-rule text-sm">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/u/${u.handle}`} className="min-w-0 truncate hover:text-brass-hi">
            {u.name} <span className="text-cream-dim">@{u.handle}</span>
          </Link>
          <ConfirmButton
            action={unblockUserAction.bind(null, u.id)}
            message={`${u.name}のブロックを解きます`}
            className="shrink-0 text-cream-dim underline decoration-rule-hi underline-offset-4 hover:text-brass-hi"
          >
            解除する
          </ConfirmButton>
        </li>
      ))}
    </ul>
  );
}
