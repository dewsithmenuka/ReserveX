import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { badgeGray, badgeGreen, btnPrimary } from "@/components/ui/styles";

const badgeAmber =
  "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700";

type Props = {
  r: { id: string; status: string; paymentStatus: string; amountCents: number };
  canPay: boolean;
};

export function PaymentInfo({ r, canPay }: Props) {
  if (r.status === "CANCELLED" && r.paymentStatus !== "REFUNDED") return null;
  if (r.paymentStatus === "NOT_REQUIRED") {
    return <p className="mt-1 text-xs text-slate-500">Free</p>;
  }

  const badge =
    r.paymentStatus === "PAID"
      ? { cls: badgeGreen, text: "Paid" }
      : r.paymentStatus === "REFUNDED"
        ? { cls: badgeGray, text: "Refunded" }
        : { cls: badgeAmber, text: "Payment due" };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
      <span className={badge.cls}>{badge.text}</span>
      <span className="text-slate-700">{formatMoney(r.amountCents)}</span>
      {canPay && r.paymentStatus === "UNPAID" && (
        <Link href={`/reservations/${r.id}/pay`} className={`${btnPrimary} !px-3 !py-1`}>
          Pay now
        </Link>
      )}
    </div>
  );
}