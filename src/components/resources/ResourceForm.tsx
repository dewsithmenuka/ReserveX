"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui/styles";

type Props = {
  resource?: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    location: string | null;
    capacity: number | null;
    isActive: boolean;
  };
};

export function ResourceForm({ resource }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(resource);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const capacity = text("capacity");

    const body: Record<string, unknown> = { name: text("name"), type: text("type") };
    if (editing || text("description")) body.description = text("description");
    if (editing || text("location")) body.location = text("location");
    if (capacity) body.capacity = Number(capacity);
    if (editing) body.isActive = f.get("isActive") === "on";

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/resources/${resource!.id}` : "/api/resources", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const d = data?.error?.details?.[0];
        setError(d ? `${d.path}: ${d.message}` : (data?.error?.message ?? "Something went wrong"));
        return;
      }
      router.push("/resources");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelCls}>Name</label>
          <input id="name" name="name" required maxLength={120} defaultValue={resource?.name} className={inputCls} />
        </div>
        <div>
          <label htmlFor="type" className={labelCls}>Type</label>
          <input id="type" name="type" required maxLength={60} list="types" defaultValue={resource?.type} className={inputCls} />
          <datalist id="types">
            <option value="room" />
            <option value="equipment" />
            <option value="vehicle" />
          </datalist>
        </div>
        <div>
          <label htmlFor="location" className={labelCls}>Location</label>
          <input id="location" name="location" maxLength={120} defaultValue={resource?.location ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="capacity" className={labelCls}>Capacity</label>
          <input id="capacity" name="capacity" type="number" min={1} max={100000} defaultValue={resource?.capacity ?? ""} className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="description" className={labelCls}>Description</label>
        <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={resource?.description ?? ""} className={inputCls} />
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={resource!.isActive} className="h-4 w-4 accent-indigo-600" />
          Active (uncheck to stop new bookings; history is kept)
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create resource"}
        </button>
        <Link href="/resources" className={btnSecondary}>Cancel</Link>
      </div>
    </form>
  );
}