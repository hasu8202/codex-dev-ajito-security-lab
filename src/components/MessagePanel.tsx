"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clockTime } from "@/lib/time";
import { fetchMessagesAction, sendMessageAction } from "@/server/actions";
import { Avatar } from "./Avatar";
import { BADGES_EVENT } from "./Nav";

type Msg = {
  id: string;
  body: string;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

const POLL_MS = 4000;

export function MessagePanel({ roomId, meId, initial }: { roomId: string; meId: string; initial: Msg[] }) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLLIElement>(null);
  // 開いた時点で既読になったので、ナビの「新着」の数を取り直す
  useEffect(() => {
    window.dispatchEvent(new Event(BADGES_EVENT));
  }, [roomId]);

  const lastAtRef = useRef(initial.at(-1)?.createdAt ?? 0);
  function append(fresh: Msg[]) {
    if (fresh.length === 0) return;
    lastAtRef.current = Math.max(lastAtRef.current, ...fresh.map((m) => m.createdAt));
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      return [...cur, ...fresh.filter((m) => !seen.has(m.id))];
    });
  }

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const fresh = await fetchMessagesAction(roomId, lastAtRef.current);
        if (alive) append(fresh);
      } catch {
        // 通信が切れたときは次の回に任せる
      }
    };
    const t = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [roomId]);

  const lastId = msgs.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function send(e: { preventDefault(): void }) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await sendMessageAction(roomId, body);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setError(undefined);
      setText("");
      append(await fetchMessagesAction(roomId, lastAtRef.current));
    });
  }

  return (
    <>
      <ol className="min-h-[calc(100dvh-14rem)] px-gutter py-5 lg:min-h-[calc(100dvh-9.5rem)]" aria-live="polite">
        {msgs.length === 0 && <li className="py-10 text-center text-cream-dim">最初の一報を打ってください</li>}
        {msgs.map((m, i) => {
          const mine = m.authorId === meId;
          const sameAsPrev = msgs[i - 1]?.authorId === m.authorId && m.createdAt - msgs[i - 1].createdAt < 5 * 60_000;
          return (
            <li key={m.id} className={`flex gap-3 ${sameAsPrev ? "mt-1" : "mt-5"}`}>
              <span className="w-8 shrink-0 pt-1">{!sameAsPrev && <Avatar name={m.authorName} imageId={m.authorAvatar} size="sm" />}</span>
              {/* 電報の用紙。自分の控えは少し濃い紙 */}
              <div
                className={`on-paper min-w-0 flex-1 rounded-sm px-3.5 py-2 text-parch-ink shadow-[0_6px_14px_-8px_rgb(0_0_0/0.8)] ${
                  mine ? "bg-parch-lo" : "bg-parch"
                } ${sameAsPrev ? "" : "border-t-[3px] border-wine/70"}`}
              >
                {!sameAsPrev && (
                  <p className="mb-1 flex items-baseline justify-between gap-3 border-b border-dashed border-parch-rule pb-1 text-xs text-parch-dim">
                    <span>
                      <span className="font-latin font-semibold tracking-[0.2em]">{mine ? "COPY · " : "FROM · "}</span>
                      <span className="font-display font-bold text-parch-ink">{mine ? "あなた" : m.authorName}</span>
                    </span>
                    <span className="numeral text-xs">{clockTime(new Date(m.createdAt))}</span>
                  </p>
                )}
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
        <li ref={endRef} aria-hidden />
      </ol>

      <form
        onSubmit={send}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] border-t border-brass-lo/50 bg-night-deep/95 px-gutter py-3 backdrop-blur lg:bottom-0"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="msg" className="sr-only">
            電文
          </label>
          <textarea
            id="msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
            }}
            rows={1}
            maxLength={1000}
            placeholder="ここだけの話を書く"
            className="field max-h-40 min-w-0 flex-1 resize-none field-sizing-content"
          />
          <button type="submit" disabled={pending || !text.trim()} className="plate btn-brass px-5 py-2">
            送る
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-wine-hi">
            {error}
          </p>
        )}
      </form>
    </>
  );
}
