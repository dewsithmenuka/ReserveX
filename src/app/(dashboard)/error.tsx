"use client";

import { btnPrimary } from "@/components/ui/styles";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 break-words text-sm text-slate-600">
  {process.env.NODE_ENV === "production"
    ? "An unexpected error occurred. Please try again."
    : error.message}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-slate-500">
            Reference: {error.digest}
          </p>
        )}
        <button type="button" onClick={reset} className={`${btnPrimary} mt-4`}>
        Try again
      </button>
    </div>
  );
}