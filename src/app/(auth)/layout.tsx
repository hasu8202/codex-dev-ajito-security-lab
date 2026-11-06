import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
