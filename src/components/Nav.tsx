"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchBadgesAction } from "@/server/actions";
import { Logo } from "./Emblems";

/** 既読にしたあとなどにナビの数を取り直させる */
export const BADGES_EVENT = "ajito:badges";

type Item = { href: string; label: string; badge?: number; icon: React.ReactNode; wideOnly?: boolean };

// アイコンは 24 の枠の 3〜21 に収め、線は 1.5 にそろえる。キーの粒などの点は塗りの円で描く
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const iconClass = "size-6 shrink-0";

const dots = (points: [number, number][]) =>
  points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.85" fill="currentColor" stroke="none" />);

// 汎用アイコンを使わず、情報屋の道具で描く
const icons = {
  // タイプライター: 紙を挟んだ胴と、キーの並び
  board: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <path d="M8 9V3.5h8V9" />
      <path d="M10 6.2h4" />
      <rect x="3" y="9" width="18" height="2.6" rx="1.3" />
      <path d="M4.5 11.6h15L21 20H3z" />
      {dots([[7.4, 14.4], [10.2, 14.4], [13, 14.4], [15.8, 14.4], [8.8, 16.8], [11.6, 16.8], [14.4, 16.8]])}
    </svg>
  ),
  // 勲章: 綬と星
  rank: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <path d="M7.5 3h3.2l2 5.2M16.5 3h-3.2l-1.1 3" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 11.8l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" />
    </svg>
  ),
  // 封筒と封蝋
  rooms: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <rect x="3" y="5.5" width="18" height="13" rx="1" />
      <path d="M3.4 6.2L12 13l8.6-6.8" />
      <circle cx="12" cy="13" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 電報: 用紙に貼られた電文のテープ
  bell: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M7 6.8h4.5M15 6.8h2" />
      <path d="M7 10h10v2.4H7zM7 14.6h7.5V17H7z" />
    </svg>
  ),
  // 管理室: 台帳と、表紙の封蝋
  admin: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <path d="M5 3.5h11.5a2 2 0 012 2v15H7a2 2 0 01-2-2z" />
      <path d="M5 18.5a2 2 0 012-2h11.5" />
      <path d="M9 7.5h6M9 10.5h4" />
      <circle cx="13.5" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 会員の鍵
  me: (
    <svg viewBox="0 0 24 24" className={iconClass} {...stroke}>
      <circle cx="8" cy="8" r="4.8" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="M11.4 11.4L20.5 20.5M16.6 16.6l-2.2 2.2M19 19l-1.7 1.7" />
    </svg>
  ),
};

export function Nav({ staff = false, ...initial }: { notifications: number; rooms: number; staff?: boolean }) {
  const pathname = usePathname();
  // レイアウトは画面遷移で再描画されないので、遷移のたびと定期的に数を取り直す
  const [{ notifications, rooms }, setBadges] = useState(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchBadgesAction()
        .then((b) => alive && setBadges(b))
        .catch(() => {});
    const first = setTimeout(load, 300);
    const timer = setInterval(() => !document.hidden && load(), 30_000);
    window.addEventListener(BADGES_EVENT, load);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener(BADGES_EVENT, load);
    };
  }, [pathname]);
  const items: Item[] = [
    { href: "/", label: "掲示板", icon: icons.board },
    { href: "/ranking", label: "番付", icon: icons.rank },
    { href: "/rooms", label: "密談", badge: rooms, icon: icons.rooms },
    { href: "/notifications", label: "知らせ", badge: notifications, icon: icons.bell },
    { href: "/training", label: "演習", icon: icons.admin, wideOnly: true },
    { href: "/me", label: "自分", icon: icons.me },
    // 画面が狭いときは「自分」の画面から入る(下部ナビは5つまで)
    ...(staff ? [{ href: "/admin", label: "管理室", icon: icons.admin, wideOnly: true }] : []),
  ];

  return (
    <nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-brass-lo/60 bg-night-deep/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(0_0_0/0.5)] backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:border-t-0 lg:bg-transparent lg:pb-0 lg:shadow-none lg:backdrop-blur-none"
    >
      <div className="hidden lg:block lg:px-3 lg:pt-7 lg:pb-8">
        <Link href="/" className="block text-cream" aria-label="情報屋アジト 掲示板へ">
          <Logo className="w-full max-w-[13rem]" />
        </Link>
        <p className="eyebrow mt-2.5 text-[0.6875rem]! tracking-[0.2em]! whitespace-nowrap">Private Informants&rsquo; Club</p>
      </div>
      <ul className="mx-auto grid h-16 max-w-[40rem] grid-cols-5 items-center px-1 lg:mx-0 lg:flex lg:h-auto lg:max-w-none lg:flex-col lg:items-stretch lg:gap-1.5 lg:px-0">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/posts") : pathname.startsWith(item.href);
          return (
            <li key={item.href} className={`${item.wideOnly ? "hidden" : "flex"} justify-center lg:block`}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex w-[4.5rem] flex-col items-center gap-1 px-1 py-1.5 text-xs leading-tight transition-colors lg:w-full lg:flex-row lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px] ${
                  active ? "plate" : "rounded-sm text-cream-dim hover:bg-panel/70 hover:text-cream"
                }`}
              >
                <span className="relative grid size-6 place-items-center">
                  {item.icon}
                  {!!item.badge && (
                    <span className="numeral absolute -top-1.5 -right-2.5 min-w-[1.15rem] rounded-full bg-wine px-1 text-center text-[11px] leading-[1.15rem] text-cream shadow-[0_0_0_2px_var(--night-deep)]">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="font-display tracking-[0.12em]">{item.label}</span>
                {/* プレートを留める鋲 */}
                {active && (
                  <>
                    <span aria-hidden className="absolute top-1 left-1 size-[3px] rounded-full bg-[#6b5020]/70 lg:top-1/2 lg:left-1.5 lg:-translate-y-1/2" />
                    <span aria-hidden className="absolute top-1 right-1 size-[3px] rounded-full bg-[#6b5020]/70 lg:top-1/2 lg:right-1.5 lg:-translate-y-1/2" />
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
