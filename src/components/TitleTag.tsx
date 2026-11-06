import { TITLES, titleName } from "@/lib/titles";

/** 称号の位(1〜3)。TITLES はおおむね取りにくい順に並んでいるので、その位置で決める */
function grade(key: string): number {
  const i = TITLES.findIndex((t) => t.key === key);
  return i <= 0 ? 0 : i <= 3 ? 1 : i <= 6 ? 2 : 3;
}

/**
 * 名乗っている称号を階級章として出す。
 * 新入りは荷札、それ以外は位の数だけ菱形を打った真鍮の章。
 */
export function TitleTag({ titleKey, onPaper = false }: { titleKey: string; onPaper?: boolean }) {
  const name = titleName(titleKey);
  const g = grade(titleKey);

  if (g === 0) {
    return (
      <span
        className={`relative inline-flex shrink-0 items-center gap-1 py-px pr-1.5 pl-3 font-display text-xs leading-4 tracking-[0.12em] [clip-path:polygon(0.45rem_0,100%_0,100%_100%,0.45rem_100%,0_50%)] ${
          onPaper ? "bg-parch-ink/85 text-parch-hi" : "bg-cream-dim/90 text-night"
        }`}
      >
        <span aria-hidden className={`absolute left-[0.4rem] size-1 rounded-full ${onPaper ? "bg-parch" : "bg-night"}`} />
        {name}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px font-display text-xs leading-4 tracking-[0.1em] ${
        onPaper ? "border-parch-accent/60 bg-parch-accent/8 text-parch-accent" : "border-brass/50 bg-brass/8 text-brass-hi"
      }`}
    >
      <span aria-hidden className="flex gap-[2px]">
        {Array.from({ length: g }, (_, i) => (
          <span key={i} className="size-[5px] rotate-45 bg-current" />
        ))}
      </span>
      {name}
    </span>
  );
}
