import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";
import { MemberCard } from "@/components/MemberCard";

export const metadata: Metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <>
      <MemberCard note="おかえりなさい。IDとパスワードでお入りください。" />
      <LoginForm />
      <p className="mt-8 text-center text-sm text-cream-dim">
        紹介を受けた方は{" "}
        <Link href="/join" className="text-cream underline decoration-brass-lo underline-offset-4">
          入会する
        </Link>
      </p>
    </>
  );
}
