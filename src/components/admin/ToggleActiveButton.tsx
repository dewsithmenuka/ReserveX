"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnSecondary } from "@/components/ui/styles";

export function ToggleActiveButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Could not update");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={toggle} disabled={busy} className={`${btnSecondary} !px-3 !py-1.5`}>
        {busy ? "Saving…" : isActive ? "Deactivate" : "Activate"}
      </button>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}