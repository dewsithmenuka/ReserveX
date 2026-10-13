"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, inputCls, labelCls } from "@/components/ui/styles";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const d = body?.error?.details?.[0];
        setError(d ? `${d.path}: ${d.message}` : (body?.error?.message ?? "Something went wrong"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!isLogin && (
        <div>
          <label htmlFor="name" className={labelCls}>Full name</label>
          <input id="name" name="name" required maxLength={120} autoComplete="name" className={inputCls} />
        </div>
      )}
      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputCls} />
      </div>
      <div>
        <label htmlFor="password" className={labelCls}>Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={isLogin ? 1 : 8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          className={inputCls}
        />
        {!isLogin && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isLogin ? "New here? " : "Already registered? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-indigo-700 hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}