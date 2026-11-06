import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="eyebrow">File Not Found</p>
        <p className="mt-2 font-display text-4xl">該当なし</p>
        <p className="mt-3 text-cream-dim">その情報は見つかりません。消されたか、最初から無かったようです。</p>
        <Link href="/" className="plate btn-brass mt-6 px-6 py-2">
          掲示板に戻る
        </Link>
      </div>
    </main>
  );
}
