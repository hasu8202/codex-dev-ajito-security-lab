import Link from "next/link";
import { gazetteDates, issueNumber } from "@/lib/dossier";

/** 「今日の依頼」を新聞の一面(本日の指令)として載せる */
export function DailyDispatch({ date, prompt, onlyPrompt }: { date: string; prompt: string; onlyPrompt: boolean }) {
  const { en, ja } = gazetteDates(date);
  return (
    <section aria-labelledby="prompt-title" className="newsprint on-paper fade-in mx-gutter mt-5 mb-7 px-5 pt-4 pb-5 sm:px-7 lg:mt-8">
      {/* 題字 */}
      <div className="text-center">
        <p className="eyebrow eyebrow-paper">Printed for Members Only</p>
        <p className="mt-1 font-latin text-[1.65rem] leading-none font-bold tracking-[0.08em] sm:text-[2.1rem]">The Daily Dispatch</p>
      </div>
      <div aria-hidden className="mt-3 h-[5px] border-y-2 border-parch-ink/80" />
      <div className="flex items-center justify-between gap-3 border-b border-parch-ink/40 py-1 text-[0.75rem] text-parch-dim">
        <span className="font-latin font-semibold tracking-[0.12em]">No. {issueNumber(date)}</span>
        <span className="hidden font-latin font-semibold tracking-[0.08em] italic sm:inline">{en}</span>
        <span className="tracking-[0.08em]">{ja}</span>
      </div>

      <h2 id="prompt-title" className="mt-4 flex items-center gap-3 text-parch-accent">
        <span aria-hidden className="h-px flex-1 bg-parch-accent/50" />
        <span className="font-display text-sm tracking-[0.3em]">本日の指令</span>
        <span className="eyebrow eyebrow-paper">Orders of the Day</span>
        <span aria-hidden className="h-px flex-1 bg-parch-accent/50" />
      </h2>
      <p className="mt-3 text-center font-display text-[1.45rem] leading-snug font-bold tracking-[0.06em] text-balance sm:text-[1.75rem]">
        {prompt}
      </p>

      <div aria-hidden className="double-rule mt-4 text-parch-ink/50" />
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <p className="text-[0.8125rem] leading-snug text-parch-dim">返答は「今日の依頼に応える」を付けて流してください。</p>
        <Link
          href={onlyPrompt ? "/" : "/?tab=prompt"}
          className="shrink-0 font-display font-bold tracking-[0.1em] text-wine underline decoration-wine/40 underline-offset-4 hover:decoration-wine"
        >
          {onlyPrompt ? "すべての情報へ" : "みんなの返答 →"}
        </Link>
      </div>
    </section>
  );
}
