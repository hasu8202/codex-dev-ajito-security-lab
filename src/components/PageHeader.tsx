import Link from "next/link";

/** 各画面の見出し。和文の題に、英字の小見出しを添える */
export function PageHeader({ title, en, back, children }: { title: string; en?: string; back?: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-night/88 backdrop-blur-md lg:pt-5">
      <div className="flex min-h-16 items-center gap-3 px-gutter">
        {back && (
          <Link href={back} aria-label="戻る" className="-ml-1.5 rounded-sm p-1.5 text-cream-dim transition-colors hover:text-brass-hi">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
        )}
        <div className="min-w-0">
          {en && <p className="eyebrow">{en}</p>}
          <h1 className="truncate font-display text-xl leading-tight tracking-[0.14em]">{title}</h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">{children}</div>
      </div>
      <div aria-hidden className="double-rule mx-gutter text-brass-lo/55" />
    </header>
  );
}
