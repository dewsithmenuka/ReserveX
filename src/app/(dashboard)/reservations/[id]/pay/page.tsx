import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { parseId } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { getReservation } from "@/modules/reservations/service";
import { PayForm } from "@/components/payments/PayForm";
import { btnSecondary, card } from "@/components/ui/styles";

export const metadata = { title: "Pay · ReserveX" };

type Props = { params: Promise<{ id: string }> };

async function Content({ params }: Props) {
  await connection();
  const user = await requirePageUser();
  const { id } = await params;

  let r = null;
  try {
    r = await getReservation(parseId(id));
  } catch {
    // invalid or missing id
  }
  if (!r || r.userId !== user.id) notFound();

  const message =
    r.status === "CANCELLED"
      ? "This reservation was cancelled, so nothing is due."
      : r.paymentStatus === "PAID"
        ? "This reservation is already paid. Thank you!"
        : r.paymentStatus !== "UNPAID"
          ? "No payment is due for this reservation."
          : r.endAt <= new Date()
            ? "This reservation has already ended."
            : null;

  return (
    <>
      <div className="mb-6 rounded-xl bg-slate-100 p-4 text-sm">
        <p className="font-medium">{r.resource.name}</p>
        <p className="text-slate-600">{r.purpose}</p>
        <p className="text-slate-600">
          {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
        </p>
        <p className="mt-2 text-lg font-bold text-indigo-700">{formatMoney(r.amountCents)}</p>
      </div>
      {message ? (
        <div>
          <p className="mb-4 text-slate-600">{message}</p>
          <Link href="/reservations" className={btnSecondary}>Back to reservations</Link>
        </div>
      ) : (
        <PayForm reservationId={r.id} amountLabel={formatMoney(r.amountCents)} />
      )}
    </>
  );
}

export default function PayPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Payment</h1>
      <div className={`${card} p-6`}>
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}