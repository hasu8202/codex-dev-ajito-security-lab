import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/AuthForms";
import { MemberCard } from "@/components/MemberCard";

export const metadata: Metadata = { title: "入会" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return (
    <>
      <MemberCard note="紹介された方だけの情報交換所です。紹介者から届いた合言葉で入会できます。" />
      <JoinForm code={code} />
      <p className="mt-8 text-center text-sm text-cream-dim">
        入会済みの方は{" "}
        <Link href="/login" className="text-cream underline decoration-brass-lo underline-offset-4">
          ログイン
        </Link>
      </p>
    </>
  );
}
