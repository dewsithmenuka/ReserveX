"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui/styles";

export function PayForm({ reservationId, amountLabel }: { reservationId: string; amountLabel: string }) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardholder: String(f.get("cardholder") ?? ""),
          cardNumber: number,
          expiry,
          cvc: String(f.get("cvc") ?? ""),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const d = data?.error?.details?.[0];
        setError(d ? `${d.path}: ${d.message}` : (data?.error?.message ?? "Payment failed"));
        return;
      }
      router.push("/payments?paid=1");
      router.refresh();
    } catch {
      setError("Network error. You have not been charged twice; check Payments before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
      <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
        <p className="font-medium">Demo mode: no real money is charged. Use a test card:</p>
        <ul className="mt-1 space-y-0.5">
          <li>4242 4242 4242 4242: succeeds (Visa)</li>
          <li>5555 5555 5555 4444: succeeds (Mastercard)</li>
          <li>4000 0000 0000 0002: declined</li>
          <li>4000 0000 0000 9995: insufficient funds</li>
        </ul>
        <p className="mt-1">Any future expiry (e.g. 12/40) and any 3-digit code.</p>
      </div>

      <div>
        <label htmlFor="cardholder" className={labelCls}>Cardholder name</label>
        <input id="cardholder" name="cardholder" required maxLength={120} autoComplete="cc-name" className={inputCls} />
      </div>
      <div>
        <label htmlFor="cardNumber" className={labelCls}>Card number</label>
        <input
          id="cardNumber"
          inputMode="numeric"
          required
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={number}
          onChange={(e) =>
            setNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())
          }
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expiry" className={labelCls}>Expiry (MM/YY)</label>
          <input
            id="expiry"
            inputMode="numeric"
            required
            autoComplete="cc-exp"
            placeholder="12/40"
            value={expiry}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="cvc" className={labelCls}>Security code</label>
          <input id="cvc" name="cvc" inputMode="numeric" required maxLength={4} autoComplete="cc-csc" placeholder="123" className={inputCls} />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Processing…" : `Pay ${amountLabel}`}
        </button>
        <Link href="/reservations" className={btnSecondary}>Pay later</Link>
      </div>
    </form>
  );
}