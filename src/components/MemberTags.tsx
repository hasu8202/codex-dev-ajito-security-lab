import { TitleTag } from "./TitleTag";

export type TagInfo = {
  titleKey: string;
  customTitle?: string | null;
  isAdmin?: boolean;
  isModerator?: boolean;
};

/** 管理側の肩書き。管理人は葡萄酒色の封蝋の札、副管理人は真鍮の縁取り */
export function RoleTag({ isAdmin, isModerator, onPaper = false }: { isAdmin?: boolean; isModerator?: boolean; onPaper?: boolean }) {
  if (!isAdmin && !isModerator) return null;
  const star = (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3 shrink-0" fill="currentColor">
      <path d="M12 2.5l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.5 6.2 19.8l1.5-6.4L2.8 9.1l6.5-.6z" />
    </svg>
  );
  if (isAdmin) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-px font-display text-xs leading-4 tracking-[0.14em] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.25)] ${
          onPaper ? "bg-wine text-parch-hi" : "bg-wine text-cream"
        }`}
      >
        {star}
        管理人
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px font-display text-xs leading-4 tracking-[0.14em] ${
        onPaper ? "border-wine/70 text-wine" : "border-wine-hi/70 text-wine-hi"
      }`}
    >
      {star}
      副管理人
    </span>
  );
}

/** 管理人が贈る特別な称号。あれば通常の称号の代わりに出す */
export function CustomTitleTag({ title, onPaper = false }: { title: string; onPaper?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px font-display text-xs leading-4 tracking-[0.1em] ${
        onPaper
          ? "border-parch-accent bg-parch-accent/12 text-parch-accent"
          : "border-brass bg-brass/15 text-brass-hi shadow-[0_0_10px_-2px_rgb(201_165_92/0.45)]"
      }`}
    >
      <span aria-hidden className="text-[0.7rem]">
        ✦
      </span>
      {title}
    </span>
  );
}

/** 肩書き一式: 管理側の札 + (特別な称号 か 名乗っている称号)。管理人は「管理人」自体が称号なので通常の称号は出さない */
export function MemberTags({ tags, onPaper = false }: { tags: TagInfo; onPaper?: boolean }) {
  return (
    <>
      <RoleTag isAdmin={tags.isAdmin} isModerator={tags.isModerator} onPaper={onPaper} />
      {tags.isAdmin && !tags.customTitle ? null : tags.customTitle ? (
        <CustomTitleTag title={tags.customTitle} onPaper={onPaper} />
      ) : (
        <TitleTag titleKey={tags.titleKey} onPaper={onPaper} />
      )}
    </>
  );
}
