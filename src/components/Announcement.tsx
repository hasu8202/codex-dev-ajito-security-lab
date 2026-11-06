/** 管理人からの告示。掲示板の一番上に出す */
export function Announcement({ body, dateLabel }: { body: string; dateLabel: string }) {
  return (
    <aside aria-label="管理人からの告示" className="card-frame fade-in relative mx-gutter mt-5 bg-panel px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Notice from the Management</p>
        <span className="font-latin text-xs tracking-[0.18em] text-cream-dim">{dateLabel}</span>
      </div>
      <h2 className="mt-0.5 font-display text-base tracking-[0.12em]">告示</h2>
      <div aria-hidden className="double-rule mt-2 mb-3 text-brass-lo/60" />
      <p className="text-[15px] leading-[1.9] break-words whitespace-pre-wrap">{body}</p>
    </aside>
  );
}
