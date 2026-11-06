"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ConfirmButton({
  action,
  message,
  redirectTo,
  className,
  children,
}: {
  action: () => Promise<void>;
  message: string;
  redirectTo?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (!window.confirm(message)) return;
        startTransition(async () => {
          await action();
          if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      {children}
    </button>
  );
}
