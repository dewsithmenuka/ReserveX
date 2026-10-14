"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
} from "@/components/ui/styles";
import { formatMoney } from "@/lib/money";
import { parseColomboLocal } from "@/lib/time";

type Props = {
  resources: { id: string; name: string; type: string }[];
  defaultResourceId: string;
  user: { name: string; email: string };
};

type CheckState = "available" | "conflict" | "inactive" | "error";

type Check = {
  key: string;
  state: CheckState;
  amountCents?: number;
};

const BANNERS: Record<string, { cls: string; text: string }> = {
  checking: {
    cls: "bg-slate-100 text-slate-600",
    text: "Checking availability…",
  },
  available: {
    cls: "bg-emerald-50 text-emerald-700",
    text: "✓ This time slot is available.",
  },
  conflict: {
    cls: "bg-rose-50 text-rose-700",
    text: "✗ This resource is already booked for part of that time.",
  },
  inactive: {
    cls: "bg-rose-50 text-rose-700",
    text: "✗ This resource is not available for booking.",
  },
  error: {
    cls: "bg-slate-100 text-slate-600",
    text: "Could not check availability. You can still try to book.",
  },
  range: {
    cls: "bg-rose-50 text-rose-700",
    text: "The end time must be after the start time.",
  },
};

export function ReservationForm({
  resources,
  defaultResourceId,
  user,
}: Props) {
  const router = useRouter();
  const [resourceId, setResourceId] = useState(defaultResourceId);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startDate = parseColomboLocal(start);
  const endDate = parseColomboLocal(end);
  const datesValid = startDate !== null && endDate !== null;

  const rangeInvalid =
    datesValid && endDate.getTime() <= startDate.getTime();

  const key =
    resourceId && datesValid && !rangeInvalid
      ? `${resourceId}|${startDate.toISOString()}|${endDate.toISOString()}`
      : null;

  // Debounced availability check; state is only set inside the async callback.
  useEffect(() => {
    if (!key) return;

    const [rid, s, e] = key.split("|");
    const ctrl = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/availability?resourceId=${rid}&startAt=${encodeURIComponent(s)}&endAt=${encodeURIComponent(e)}`,
          { signal: ctrl.signal },
        );

        if (!res.ok) {
          setCheck({ key, state: "error" });
          return;
        }

        const data = await res.json();

        setCheck({
          key,
          state: !data.resourceActive
            ? "inactive"
            : data.available
              ? "available"
              : "conflict",
          amountCents: data.amountCents,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setCheck({ key, state: "error" });
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key]);

  const status = rangeInvalid
    ? "range"
    : !key
      ? "idle"
      : check?.key === key
        ? check.state
        : "checking";

  const banner = BANNERS[status];

  const blocked =
    status === "conflict" ||
    status === "inactive" ||
    status === "range";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!datesValid) return;

    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          reservedByName: text("reservedByName"),
          reservedByEmail: text("reservedByEmail"),
          purpose: text("purpose"),
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const d = data?.error?.details?.[0];

        setError(
          data?.error?.code === "VALIDATION_ERROR" && d
            ? `${d.path}: ${d.message}`
            : (data?.error?.message ?? "Something went wrong"),
        );

        if (data?.error?.code === "RESERVATION_CONFLICT" && key) {
          setCheck({ key, state: "conflict" });
        }

        return;
      }

      const created = await res.json();

      router.push(
        created.paymentStatus === "UNPAID"
          ? `/reservations/${created.id}/pay`
          : "/reservations",
      );

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="resourceId" className={labelCls}>
          Resource
        </label>

        <select
          id="resourceId"
          required
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          className={inputCls}
        >
          <option value="" disabled>
            Select a resource…
          </option>

          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.type})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startAt" className={labelCls}>
            Start (Sri Lanka time)
          </label>

          <input
            id="startAt"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="endAt" className={labelCls}>
            End (Sri Lanka time)
          </label>

          <input
            id="endAt"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {banner && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-3 py-2 text-sm ${banner.cls}`}
        >
          {banner.text}
        </p>
      )}

      {status === "available" && check?.amountCents ? (
        <p className="text-sm font-medium">
          Total: {formatMoney(check.amountCents)} (payable after booking)
        </p>
      ) : null}

      <div>
        <label htmlFor="purpose" className={labelCls}>
          Purpose
        </label>

        <input
          id="purpose"
          name="purpose"
          required
          maxLength={500}
          className={inputCls}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reservedByName" className={labelCls}>
            Booked for (name)
          </label>

          <input
            id="reservedByName"
            name="reservedByName"
            required
            maxLength={120}
            defaultValue={user.name}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="reservedByEmail" className={labelCls}>
            Contact email
          </label>

          <input
            id="reservedByEmail"
            name="reservedByEmail"
            type="email"
            required
            maxLength={254}
            defaultValue={user.email}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || blocked}
          className={btnPrimary}
        >
          {busy ? "Booking…" : "Confirm reservation"}
        </button>

        <Link href="/reservations" className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}