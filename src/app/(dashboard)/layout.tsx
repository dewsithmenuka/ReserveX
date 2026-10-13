import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/40 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
              R
            </span>
            ReserveX
          </Link>

          <Suspense
            fallback={<div className="h-9" aria-hidden="true" />}
          >
            <NavLinks />
          </Suspense>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Suspense fallback={<div className="h-8 w-24" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}