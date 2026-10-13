"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnDanger, btnSecondary } from "@/components/ui/styles";

export function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Could not cancel");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className={`${btnSecondary} !px-3 !py-1.5`} onClick={() => setConfirming(true)}>
        Cancel
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Cancel this booking?</span>
        <button type="button" disabled={busy} className={`${btnDanger} !px-3 !py-1.5`} onClick={cancel}>
          {busy ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" disabled={busy} className={`${btnSecondary} !px-3 !py-1.5`} onClick={() => setConfirming(false)}>
          Keep
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}