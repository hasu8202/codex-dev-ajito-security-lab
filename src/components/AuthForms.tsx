"use client";

import { useActionState } from "react";
import { loginAction, signupAction, type FormState } from "@/server/actions";

const input = "field py-2.5 text-base";

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="font-display text-sm tracking-[0.12em] text-brass-hi">{label}</span>
      <input {...props} className={`${input} mt-1`} />
      {hint && <span className="mt-1 block text-xs text-cream-dim">{hint}</span>}
    </label>
  );
}

function ErrorText({ state }: { state: FormState }) {
  return state?.error ? (
    <p role="alert" className="text-sm text-wine-hi">
      {state.error}
    </p>
  ) : null;
}

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="合言葉" name="code" defaultValue={code} required autoComplete="off" placeholder="XXXX-XXXX" className="tracking-widest" />
      <Field label="ID" name="handle" required autoComplete="username" placeholder="kage_7" hint="半角の英小文字・数字・_ で3〜16文字。あとから変えられません" />
      <Field label="通り名" name="name" required maxLength={20} placeholder="夜更かしの猫" hint="アジトでの呼び名。あとから変えられます" />
      <Field label="パスワード" name="password" type="password" required minLength={8} autoComplete="new-password" hint="8文字以上" />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className="plate btn-brass w-full px-4 py-3">
        {pending ? "確かめています…" : "入会する"}
      </button>
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="ID" name="handle" required autoComplete="username" />
      <Field label="パスワード" name="password" type="password" required autoComplete="current-password" />
      <ErrorText state={state} />
      <button type="submit" disabled={pending} className="plate btn-brass w-full px-4 py-3">
        {pending ? "確かめています…" : "ログイン"}
      </button>
    </form>
  );
}
