import { Logo } from "./Emblems";

/** 入口に置く会員証。屋号(封蝋と鍵のロゴ)だけで、会員制であることを伝える */
export function MemberCard({ note }: { note: string }) {
  return (
    <div className="card-frame guilloche fade-in relative mb-10 bg-panel px-6 pt-5 pb-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">Membership Card</p>
        <p className="font-latin text-xs tracking-[0.2em] text-cream-dim">No. ——</p>
      </div>
      <Logo className="mx-auto mt-4 w-60" />
      <div aria-hidden className="double-rule mt-5 mb-3 text-brass-lo/60" />
      <p className="text-sm leading-relaxed text-cream-dim">{note}</p>
      <p className="mt-3 text-right font-latin text-sm text-cream-dim italic">— by introduction only</p>
    </div>
  );
}
