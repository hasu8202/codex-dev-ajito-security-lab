/** アジトの紋章類(封蝋・ロゴ・勲章)。すべて SVG で、画像ファイルは使わない */

// 縁が少し波打った封蝋の輪郭(計算済みの固定値。描画ごとに計算するとサーバーとブラウザで小数がずれる)
const SEAL_EDGE =
  "M93.7 43.8Q95.0 50.0 94.9 56.6Q94.7 63.1 90.9 68.5Q87.2 73.9 84.0 79.8Q80.9 85.7 74.9 88.5Q68.9 91.3 62.5 92.3Q56.2 93.4 49.8 94.8Q43.3 96.3 37.4 93.4Q31.5 90.6 25.7 87.7Q19.9 84.8 15.0 80.2Q10.1 75.6 9.0 69.0Q7.8 62.4 6.1 56.2Q4.4 50.0 4.9 43.5Q5.5 36.9 9.1 31.5Q12.6 26.0 15.9 20.2Q19.2 14.5 25.2 11.7Q31.2 8.9 37.5 7.9Q43.8 6.8 50.2 5.6Q56.6 4.3 62.8 6.3Q69.0 8.3 74.2 12.2Q79.3 16.1 84.4 20.4Q89.4 24.7 90.8 31.1Q92.3 37.6 93.7 43.8Z";

const KEY = "M50 27a8 8 0 1 0 0.01 0M50 43v30M50 62h8M50 69h6";
const STAR = "M50 28l5.6 12.2 13.4 1.5-10 9.1 2.8 13.2L50 57.3 38.2 64l2.8-13.2-10-9.1 13.4-1.5z";

/** 封蝋。押された紋は鍵(既定)か星 */
export function WaxSeal({ className = "size-10", emblem = "key" }: { className?: string; emblem?: "key" | "star" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <SealBody emblem={emblem} />
    </svg>
  );
}

/**
 * ロゴタイプ。封蝋を鍵の握りに見立て、そこから伸びる鍵の軸が屋号の下線になる。
 * 文字は Web フォント(明朝・Cormorant)で組む。
 */
export function Logo({ className = "w-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 72" className={className} role="img" aria-label="情報屋アジト">
      {/* 鍵の軸と歯 */}
      <g stroke="var(--brass)" strokeWidth="1.6" fill="none" strokeLinecap="square">
        <path d="M46 64H214" />
        <path d="M54 60.5v7M58 60.5v7" strokeWidth="1" />
        <path d="M196 64v5.5h5V64M206 64v7.5h5V64" fill="var(--brass)" fillOpacity="0.15" />
      </g>
      <g transform="translate(-2 11) scale(0.56)">
        <SealBody emblem="key" />
      </g>
      <text
        x="62"
        y="14"
        fill="var(--brass)"
        style={{ fontFamily: "var(--font-mincho)", fontWeight: 600 }}
        fontSize="11.5"
        textLength="48"
        lengthAdjust="spacing"
      >
        情報屋
      </text>
      <text
        x="214"
        y="13"
        textAnchor="end"
        fill="var(--brass)"
        opacity="0.85"
        style={{ fontFamily: "var(--font-cormorant)", fontWeight: 600, letterSpacing: "0.18em" }}
        fontSize="8"
      >
        EST. MMXXVI
      </text>
      {/* 屋号は太く大きく。細い縁取りを重ねて、明朝の横画が夜の地に負けないようにする */}
      <text
        x="59"
        y="54"
        fill="var(--cream)"
        stroke="var(--cream)"
        strokeWidth="0.9"
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontFamily: "var(--font-mincho)", fontWeight: 700 }}
        fontSize="40"
        textLength="152"
        lengthAdjust="spacing"
      >
        アジト
      </text>
    </svg>
  );
}

/** 封蝋の中身(ロゴの svg に入れ子にせず埋め込めるよう、g 相当だけ返す) */
function SealBody({ emblem }: { emblem: "key" | "star" }) {
  const star = emblem === "star";
  const mark = star ? STAR : KEY;
  const line = star
    ? { strokeWidth: 1.5, strokeLinejoin: "round" as const }
    : { fill: "none", strokeWidth: 4.5, strokeLinecap: "round" as const };
  return (
    <>
      <path d={SEAL_EDGE} fill="#3b0e17" transform="translate(1.5 2.5)" />
      <path d={SEAL_EDGE} fill="#8a2b3c" />
      <circle cx="50" cy="50" r="31" fill="#701f2e" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#a9475a" strokeWidth="1.6" strokeDasharray="0.5 3.2" />
      <circle cx="50" cy="50" r="34.5" fill="none" stroke="#5a1824" strokeWidth="1.2" />
      <path d={mark} fill={star ? "#43111c" : "none"} {...line} stroke="#43111c" transform="translate(1.2 1.6)" />
      <path d={mark} fill={star ? "#b3586a" : "none"} {...line} stroke="#c4697a" />
      <ellipse cx="35" cy="27" rx="15" ry="7" fill="#fff" opacity="0.14" transform="rotate(-32 35 27)" />
    </>
  );
}

const METALS = [
  { face: "#e3c47c", edge: "#9c7a34", mark: "#6b5020" },
  { face: "#d2d4cd", edge: "#868d87", mark: "#555b56" },
  { face: "#cf9563", edge: "#8a5530", mark: "#5e3a20" },
] as const;

/** 番付の勲章。place は 0 始まり(0=金, 1=銀, 2=銅) */
export function Medal({ place, className = "w-12" }: { place: 0 | 1 | 2; className?: string }) {
  const m = METALS[place];
  const numeral = ["I", "II", "III"][place];
  return (
    <svg viewBox="0 0 48 64" className={className} aria-hidden>
      {/* 綬(リボン): ワインと黒緑の縞 */}
      <path d="M12 0h11l5 22H17z" fill="#7e2636" />
      <path d="M25 0h11l-5 22H20z" fill="#5e1b28" />
      <path d="M16 0h3l4.5 20h-3zM29 0h3l-4.5 20h-3z" fill="#0d1a16" opacity="0.55" />
      <circle cx="24" cy="42" r="17" fill={m.edge} />
      <circle cx="24" cy="42" r="15" fill={m.face} />
      <circle cx="24" cy="42" r="12" fill="none" stroke={m.edge} strokeWidth="0.8" strokeDasharray="1 1.6" />
      <ellipse cx="18" cy="35" rx="7" ry="3" fill="#fff" opacity="0.3" transform="rotate(-30 18 35)" />
      <text
        x="24"
        y="47.5"
        textAnchor="middle"
        fill={m.mark}
        fontSize="14"
        style={{ fontFamily: "var(--font-cormorant)", fontWeight: 700 }}
      >
        {numeral}
      </text>
    </svg>
  );
}
