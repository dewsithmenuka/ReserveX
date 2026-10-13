"use client";

import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui/styles";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className={`${btnSecondary} !px-3 !py-1.5`}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}