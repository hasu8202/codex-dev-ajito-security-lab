"use client";

import { useActionState } from "react";
import { createGroupAction, type FormState } from "@/server/actions";

export function GroupForm({ members }: { members: { id: string; name: string; handle: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGroupAction, undefined);
  if (members.length < 2) {
    return <p className="mt-2 text-sm text-cream-dim">会合を作るには、自分以外に2人以上のメンバーが必要です。</p>;
  }
  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="block">
        <span className="text-sm text-cream-dim">会合の名前</span>
        <input
          name="name"
          required
          maxLength={24}
          placeholder="週末作戦会議"
          className="field mt-1"
        />
      </label>
      <fieldset>
        <legend className="text-sm text-cream-dim">呼ぶ人(2人以上)</legend>
        <div className="mt-1 grid max-h-56 gap-1 overflow-y-auto">
          {members.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 py-0.5">
              <input type="checkbox" name="memberIds" value={m.id} className="peer sr-only" />
              <span className="check-box on-night" aria-hidden>
                <svg viewBox="0 0 16 16" className="size-3.5">
                  <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {m.name} <span className="text-xs text-cream-dim">@{m.handle}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && (
        <p role="alert" className="text-sm text-wine-hi">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="plate btn-brass px-4 py-2 text-sm">
        会合を作る
      </button>
    </form>
  );
}
