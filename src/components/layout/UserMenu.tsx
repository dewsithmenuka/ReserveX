import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { btnPrimary, btnSecondary } from "@/components/ui/styles";
import { LogoutButton } from "./LogoutButton";

export async function UserMenu() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link href="/login" className={btnSecondary}>Sign in</Link>
        <Link href="/register" className={btnPrimary}>Register</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.role === "ADMIN" && (
        <Link href="/admin" className="text-sm font-medium text-indigo-700 hover:underline">
          Admin
        </Link>
      )}
      <Link href="/profile" className="flex items-center gap-2 text-sm font-medium">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-indigo-700">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
      </Link>
      <LogoutButton />
    </div>
  );
}