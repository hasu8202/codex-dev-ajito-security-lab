import { PageHeader } from "@/components/PageHeader";

const exercises = [
  ["第一課題", "認可", "他人の情報・投稿・操作を、画面の表示だけでなくサーバー側でも守れているかを確かめる。"],
  ["第二課題", "入力", "URL・フォーム・ヘッダーを信頼せず、意図しない値でも安全に処理できるかを確かめる。"],
  ["第三課題", "セッション", "ログイン状態と権限が各操作で再確認されているかを確かめる。"],
] as const;

export default function TrainingPage() {
  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <PageHeader en="LOCAL ONLY" title="防衛演習室">この教材は架空データだけを使う、localhost限定の演習環境です。</PageHeader>
      <section className="newsprint on-paper p-5 text-sm leading-7">
        <p className="font-display text-lg text-parch-ink">演習の規則</p>
        <p>実アプリ、公開URL、ほかのサービスには試さないこと。各課題を見つけたら、なぜ起きるかを説明し、修正後に同じ確認が失敗することまで確かめる。</p>
      </section>
      <div className="space-y-3">
        {exercises.map(([number, title, detail]) => (
          <article key={number} className="dossier p-5">
            <p className="eyebrow">{number}</p>
            <h2 className="mt-1 font-display text-xl text-cream">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-cream-dim">{detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
