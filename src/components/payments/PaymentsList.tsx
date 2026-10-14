import Link from "next/link";
import { buildHref } from "@/lib/search";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { badgeGray, badgeGreen, card } from "@/components/ui/styles";

type Item = {
  id: string;
  kind: "CHARGE" | "REFUND";
  result: "SUCCEEDED" | "FAILED";
  amountCents: number;
  cardBrand: string | null;
  cardLast4: string | null;
  failureReason: string | null;
  createdAt: Date;
  reservation: {
    purpose: string;
    reservedByEmail: string;
    resource: { name: string };
  };
};

const badgeRose =
  "rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700";

export function PaymentsList({
  items,
  total,
  page,
  pageSize,
  basePath,
  q = "",
  showEmail = false,
}: {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  q?: string;
  showEmail?: boolean;
}) {
  return (
    <>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {q ? "No payments match your search." : "No payments yet."}
        </p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {items.map((p) => {
            const refund = p.kind === "REFUND";

            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {p.reservation.resource.name}
                    </p>

                    <span
                      className={
                        p.result === "FAILED"
                          ? badgeRose
                          : refund
                            ? badgeGray
                            : badgeGreen
                      }
                    >
                      {p.result === "FAILED"
                        ? "Failed"
                        : refund
                          ? "Refund"
                          : "Paid"}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500">
                    {p.reservation.purpose}
                    {showEmail ? ` · ${p.reservation.reservedByEmail}` : ""}
                  </p>

                  <p className="text-xs text-slate-500">
                    {formatDateTime(p.createdAt)}
                    {p.cardLast4
                      ? ` · ${p.cardBrand} •••• ${p.cardLast4}`
                      : ""}
                    {p.failureReason ? ` · ${p.failureReason}` : ""}
                  </p>
                </div>

                <p
                  className={`text-lg font-semibold ${
                    p.result === "FAILED"
                      ? "text-slate-500 line-through"
                      : ""
                  }`}
                >
                  {refund ? "−" : ""}
                  {formatMoney(p.amountCents)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} record{total === 1 ? "" : "s"}
        </span>

        <div className="flex gap-4">
          {page > 1 && (
            <Link
              href={buildHref(basePath, { q, page: page - 1 })}
              className="font-medium text-indigo-700 hover:underline"
            >
              ← Previous
            </Link>
          )}

          {total > page * pageSize && (
            <Link
              href={buildHref(basePath, { q, page: page + 1 })}
              className="font-medium text-indigo-700 hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}