"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createInviteAction, revokeInviteAction } from "@/server/actions";

type Invite = { code: string; usedByName: string | null; usedByHandle: string | null };

export function InviteBox({ invites }: { invites: Invite[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<string>();

  async function copy(code: string) {
    const link = `${window.location.origin}/join?code=${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "情報屋アジトへの招待", text: `合言葉: ${code}`, url: link });
        return;
      }
      await navigator.clipboard.writeText(`情報屋アジトへの招待\n合言葉: ${code}\n${link}`);
      setCopied(code);
      setTimeout(() => setCopied(undefined), 2000);
    } catch {
      // 共有を閉じたときなど。何もしない
    }
  }

  const open = invites.filter((i) => !i.usedByHandle);
  const used = invites.filter((i) => i.usedByHandle);

  return (
    <div className="mt-3 space-y-3">
      {open.map((i) => (
        <div key={i.code} className="relative my-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-dashed border-parch-rule bg-parch px-5 py-2.5 text-parch-ink shadow-[0_6px_14px_-8px_rgb(0_0_0/0.8)] on-paper [mask:radial-gradient(circle_7px_at_0_50%,#0000_96%,#000)_left/51%_100%_no-repeat,radial-gradient(circle_7px_at_100%_50%,#0000_96%,#000)_right/51%_100%_no-repeat]">
          <span className="eyebrow eyebrow-paper">Pass</span>
          <span className="numeral text-xl tracking-[0.22em]">{i.code}</span>
          <span className="ml-auto flex gap-3 text-sm">
            <button type="button" onClick={() => copy(i.code)} className="font-bold text-wine">
              {copied === i.code ? "コピーしました" : "リンクを渡す"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => revokeInviteAction(i.code))}
              className="text-parch-dim hover:text-wine"
            >
              取り消す
            </button>
          </span>
        </div>
      ))}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await createInviteAction();
            setError(r?.error);
          })
        }
        className="plate btn-brass px-4 py-2 text-sm"
      >
        合言葉を作る
      </button>
      {error && (
        <p role="alert" className="text-sm text-wine-hi">
          {error}
        </p>
      )}

      {used.length > 0 && (
        <div className="text-sm text-cream-dim">
          <p>使われた合言葉</p>
          <ul className="mt-1 space-y-0.5">
            {used.map((i) => (
              <li key={i.code}>
                <span className="tracking-widest line-through">{i.code}</span> →{" "}
                <Link href={`/u/${i.usedByHandle}`} className="text-cream underline underline-offset-4">
                  {i.usedByName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
