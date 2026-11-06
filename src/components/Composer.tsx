/* eslint-disable @next/next/no-img-element -- 選んだ画像のプレビュー(blob URL)なので next/image を通さない */
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { resizeImage } from "@/lib/resize-image";
import { createPostAction, type FormState } from "@/server/actions";
import { WaxSeal } from "./Emblems";

const MAX = 500;

const tick = (
  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 投稿欄。便箋に書いて、真鍮の「流す」で出す */
export function Composer({ prompt, answerByDefault = false }: { prompt: string; answerByDefault?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await createPostAction(prev, fd);
    if (result?.ok) {
      formRef.current?.reset();
      setText("");
      setImage(null);
      setSealed(false);
      setPreview(null);
    }
    return result;
  }, undefined);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const small = await resizeImage(file);
      setImage(small);
      setPreview(URL.createObjectURL(small));
    } finally {
      setBusy(false);
    }
  }

  function submit(fd: FormData) {
    fd.delete("image");
    if (image) fd.set("image", image);
    formAction(fd);
  }

  const used = [...text].length;
  const left = MAX - used;
  // 8割で真鍮、残り25字でワインに変えて知らせる
  const level = left <= 25 ? "full" : used >= MAX * 0.8 ? "near" : "ok";

  return (
    <form ref={formRef} action={submit} className="dossier on-paper mx-gutter mb-8 px-4 pt-3 pb-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-[15px] font-bold tracking-[0.14em]">報告書を起こす</p>
        <p className="eyebrow eyebrow-paper">Memorandum</p>
      </div>
      <div aria-hidden className="double-rule mt-1.5 text-parch-rule" />

      <label htmlFor="post-body" className="sr-only">
        情報の本文
      </label>
      <div className={`relative mt-2 border-l pl-3 transition-colors ${sealed ? "border-wine/70" : "border-wine/25"}`}>
        <textarea
          id="post-body"
          name="body"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={MAX}
          placeholder="仕入れた情報を書き留める…"
          className="letter-paper block min-h-24 w-full resize-y bg-transparent text-[15px] text-parch-ink placeholder:text-parch-dim/80 focus:outline-none"
        />
      </div>
      {sealed && <p className="mt-1 text-xs text-wine">封をして流します。読む人が封蝋を割るまで中身は見えません。</p>}

      {preview && (
        <div className="relative mt-4 ml-2 w-fit">
          <span className="photo">
            <img src={preview} alt="添付する画像" className="max-h-40!" />
          </span>
          <button
            type="button"
            onClick={() => {
              setImage(null);
              setPreview(null);
            }}
            className="absolute -top-2 -right-3 rounded-full bg-parch-ink px-2.5 text-xs leading-6 text-parch-hi shadow"
          >
            外す
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5 text-parch-dim transition-colors hover:text-parch-ink">
          <input type="file" accept="image/*" className="peer sr-only" onChange={onPick} />
          {/* クリップ */}
          <svg viewBox="0 0 24 24" className="size-[18px] rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-wine" aria-hidden>
            <path
              d="M8 12.5V6.8a3.3 3.3 0 0 1 6.6 0v9.4a2 2 0 0 1-4 0V7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {busy ? "写真を縮小中…" : "写真を添える"}
        </label>
        <label className={`flex cursor-pointer items-center gap-2 transition-colors ${sealed ? "text-wine" : ""}`}>
          <input type="checkbox" name="sealed" checked={sealed} onChange={(e) => setSealed(e.target.checked)} className="peer sr-only" />
          <span className="seal-switch" aria-hidden>
            <WaxSeal />
          </span>
          封をする
          <span className="font-latin text-xs font-semibold tracking-[0.18em]" aria-hidden>
            {sealed ? "SEALED" : "OPEN"}
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2" title={prompt}>
          <input type="checkbox" name="answersPrompt" defaultChecked={answerByDefault} className="peer sr-only" />
          <span className="check-box" aria-hidden>
            {tick}
          </span>
          今日の依頼に応える
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-dashed border-parch-rule pt-3 sm:gap-4">
        <p className={`shrink-0 text-xs transition-colors ${level === "full" ? "text-wine" : "text-parch-dim"}`} aria-live="polite">
          <span className={`numeral text-base ${level === "ok" ? "text-parch-ink" : level === "near" ? "text-parch-accent" : "text-wine"}`}>{used}</span>
          <span className="numeral mx-0.5">/</span>
          <span className="numeral">{MAX}</span> 字{level !== "ok" && <span className="ml-1.5">(残り {Math.max(0, left)})</span>}
        </p>
        <span aria-hidden className="meter min-w-12 flex-1" data-level={level}>
          <span style={{ width: `${Math.min(100, (used / MAX) * 100)}%` }} />
        </span>
        <button type="submit" disabled={pending || busy || text.trim().length === 0} className="plate btn-brass ml-auto shrink-0 px-7 py-2 text-[15px]">
          {pending ? "流しています…" : "流す"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-wine">
          {state.error}
        </p>
      )}
    </form>
  );
}
