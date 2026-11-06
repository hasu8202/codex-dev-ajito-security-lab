/* eslint-disable @next/next/no-img-element -- 会員だけが見られる自前配信の画像なので next/image を通さない */

const sizes = { sm: "size-8 text-sm", md: "size-11 text-lg", lg: "size-20 text-3xl" } as const;

/** 肖像。真鍮の細い輪で縁取り、写真はセピアに寄せる。紙の上でも夜の地の上でも同じ見た目 */
export function Avatar({
  name,
  imageId,
  size = "md",
}: {
  name: string;
  imageId?: string | null;
  size?: keyof typeof sizes;
}) {
  const cls = `${sizes[size]} shrink-0 rounded-full object-cover shadow-[0_0_0_1.5px_var(--brass-lo),0_0_0_3px_rgb(0_0_0/0.25)]`;
  if (imageId) return <img src={`/img/${imageId}`} alt="" className={`${cls} sepia-[0.35] saturate-[0.8]`} />;
  return (
    <span
      aria-hidden
      className={`${cls} grid place-items-center bg-[radial-gradient(circle_at_35%_30%,#2c4a3f,#13241e_70%)] font-display font-bold text-brass-hi`}
    >
      {[...name][0] ?? "?"}
    </span>
  );
}
