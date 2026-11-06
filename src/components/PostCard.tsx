/* eslint-disable @next/next/no-img-element -- 会員だけが見られる自前配信の画像なので next/image を通さない */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fileNumber } from "@/lib/dossier";
import { deletePostAction, toggleLikeAction } from "@/server/actions";
import { Avatar } from "./Avatar";
import { WaxSeal } from "./Emblems";
import { ConfirmButton } from "./ConfirmButton";
import { MemberTags } from "./MemberTags";

export type PostView = {
  id: string;
  body: string;
  imageId: string | null;
  sealed: boolean;
  promptDate: string | null;
  timeLabel: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  author: {
    id: string;
    handle: string;
    name: string;
    avatarImageId: string | null;
    titleKey: string;
    customTitle: string | null;
    isAdmin: boolean;
    isModerator: boolean;
  };
  // 管理人・副管理人が、自分より下の位の人の情報を消せるとき
  canModerate: boolean;
};

// 封蝋が割れて蓋が開くまでの時間(globals.css の .envelope の動きに合わせる)
const OPENING_MS = 850;

/** 封をした情報。封蝋付きの封筒で、押すと封蝋が割れて開く */
function Envelope({ hasImage, opening, onOpen }: { hasImage: boolean; opening: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={opening}
      aria-label="封をされた情報を開封する"
      className={`envelope mt-3 text-left ${opening ? "is-opening" : ""}`}
    >
      <span aria-hidden className="envelope-flap" />
      <span aria-hidden className="envelope-seal">
        <span className="seal-half left">
          <WaxSeal className="size-full" />
        </span>
        <span className="seal-half right">
          <WaxSeal className="size-full" />
        </span>
      </span>
      <span className="absolute bottom-2.5 left-3.5 flex flex-col">
        <span className="eyebrow eyebrow-paper">Sealed{hasImage && " · Photograph enclosed"}</span>
        <span className="text-xs text-parch-dim">{opening ? "開封しています…" : "封蝋を押して開封する"}</span>
      </span>
      <span className="absolute right-3.5 bottom-2.5 font-display text-lg tracking-[0.3em] text-wine [writing-mode:vertical-rl]">親展</span>
    </button>
  );
}

export function PostCard({ post, detail = false }: { post: PostView; detail?: boolean }) {
  const [seal, setSeal] = useState<"closed" | "opening" | "open">(post.sealed ? "closed" : "open");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // 掲示板は再検証されないので、押した結果は手元で持つ(失敗したら戻す)
  const [like, setLike] = useState({ liked: post.likedByMe, count: post.likeCount });
  const [pending, setPending] = useState(false);

  function openSeal() {
    if (seal !== "closed") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setSeal("open");
    setSeal("opening");
    timer.current = setTimeout(() => setSeal("open"), OPENING_MS);
  }

  async function onLike() {
    if (pending) return;
    const before = like;
    setLike({ liked: !before.liked, count: before.count + (before.liked ? -1 : 1) });
    setPending(true);
    try {
      const liked = await toggleLikeAction(post.id);
      if (liked === before.liked) setLike(before);
    } catch {
      setLike(before);
    } finally {
      setPending(false);
    }
  }

  const open = seal === "open";
  const no = fileNumber(post.id);

  return (
    <article className="dossier on-paper fade-in mx-gutter mb-5 px-4 pt-3 pb-3 sm:px-5" aria-label={`調書 No.${no}`}>
      {/* 書類の頭: 整理番号と受付印 */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-latin text-[0.8rem] font-semibold tracking-[0.2em] text-parch-dim">
          FILE&nbsp;No.<span className="numeral text-parch-ink">{no}</span>
        </p>
        <span className="stamp" aria-hidden>
          Confidential
        </span>
      </div>
      <div aria-hidden className="double-rule mt-1.5 text-parch-rule" />

      <header className="mt-3 flex items-center gap-3">
        <Link href={`/u/${post.author.handle}`} className="group flex min-w-0 items-center gap-3">
          <Avatar name={post.author.name} imageId={post.author.avatarImageId} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate font-display text-[15px] font-bold tracking-[0.06em] group-hover:underline group-hover:decoration-parch-rule group-hover:underline-offset-4">
                {post.author.name}
              </span>
              <MemberTags tags={post.author} onPaper />
            </span>
            <span className="block text-xs text-parch-dim">
              <span className="font-latin tracking-[0.12em]">AGENT</span> @{post.author.handle}
              <span className="mx-1.5 text-parch-rule">/</span>
              <time>{post.timeLabel}</time>
            </span>
          </span>
        </Link>
      </header>

      {post.promptDate && (
        <p className="mt-3 inline-flex items-center gap-2 border-y border-parch-accent/40 py-px text-xs text-parch-accent">
          <span className="eyebrow eyebrow-paper">Re:</span>
          本日の指令への返答({post.promptDate.slice(5).replace("-", "/")})
        </p>
      )}

      {open ? (
        <div className={post.sealed ? "unsealed" : ""}>
          {post.sealed && (
            <p className="mt-3 flex items-center gap-2 text-xs text-parch-dim">
              <WaxSeal className="size-4" />
              開封済み
            </p>
          )}
          <p className="mt-2.5 text-[15px] leading-[1.95] whitespace-pre-wrap break-words">{post.body}</p>
          {post.imageId && (
            <figure className="mt-4 mb-1 px-2">
              <span className="photo">
                <img src={`/img/${post.imageId}`} alt="添付の写真" loading="lazy" />
              </span>
            </figure>
          )}
        </div>
      ) : (
        <Envelope hasImage={!!post.imageId} opening={seal === "opening"} onOpen={openSeal} />
      )}

      <footer className="mt-3 flex items-center gap-5 border-t border-dashed border-parch-rule pt-2 text-sm text-parch-dim">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={like.liked}
          className={`flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors ${like.liked ? "font-bold text-wine" : "hover:text-parch-ink"}`}
        >
          {/* 買う: 情報の代金の硬貨 */}
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <circle cx="12" cy="12" r="8" fill={like.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="5.6" fill="none" stroke={like.liked ? "var(--parch)" : "currentColor"} strokeWidth="0.9" strokeDasharray="0.8 1.4" />
            <path d="M12 8.6v6.8" stroke={like.liked ? "var(--parch)" : "currentColor"} strokeWidth="1.4" />
          </svg>
          {like.liked ? "買った" : "買う"}
          <span className="numeral text-base">{like.count}</span>
        </button>
        {detail ? (
          <span className="flex items-center gap-1.5">
            追記 <span className="numeral text-base">{post.commentCount}</span>
          </span>
        ) : (
          <Link href={`/posts/${post.id}`} className="flex items-center gap-1.5 transition-colors hover:text-parch-ink">
            追記 <span className="numeral text-base">{post.commentCount}</span>
          </Link>
        )}
        {post.canModerate && (
          <ConfirmButton
            action={deletePostAction.bind(null, post.id)}
            redirectTo={detail ? "/" : undefined}
            message="管理人の権限でこの情報を消します。本人に知らせが届きます。元に戻せません"
            className="rounded-sm px-1 py-0.5 text-xs text-wine hover:underline"
          >
            管理削除
          </ConfirmButton>
        )}
        {!detail && (
          <Link href={`/posts/${post.id}`} className="ml-auto font-latin text-xs font-semibold tracking-[0.18em] hover:text-parch-ink">
            READ FILE →
          </Link>
        )}
      </footer>
    </article>
  );
}
