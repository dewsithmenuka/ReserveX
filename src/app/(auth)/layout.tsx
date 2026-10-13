import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center bg-gradient-to-br from-indigo-50 via-slate-50 to-slate-100 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">R</span>
          ReserveX
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">{children}</div>
      </div>
    </div>
  );
}