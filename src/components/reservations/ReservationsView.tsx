import Link from "next/link";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { buildHref, parsePage, parseQuery } from "@/lib/search";
import { formatDateTime } from "@/lib/time";
import { listReservations } from "@/modules/reservations/service";
import { CancelButton } from "@/components/reservations/CancelButton";
import { PaymentInfo } from "@/components/payments/PaymentInfo";
import { SearchForm } from "@/components/ui/SearchForm";
import { badgeGray, badgeGreen, card } from "@/components/ui/styles";

export type ReservationTab = "upcoming" | "cancelled" | "all";
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BASE_PATH: Record<ReservationTab, string> = {
  upcoming: "/reservations",
  cancelled: "/reservations/cancelled",
  all: "/reservations/all",
};

const EMPTY_TEXT: Record<ReservationTab, string> = {
  upcoming: "No upcoming reservations.",
  cancelled: "No cancelled reservations.",
  all: "No reservations yet.",
};

const TYPES = ["room", "equipment", "vehicle"];

export async function ReservationsView({
  tab,
  searchParams,
}: {
  tab: ReservationTab;
  searchParams: SearchParams;
}) {
  await connection();
  const user = await requirePageUser();
  const sp = await searchParams;

  const q = parseQuery(sp.q);
  const type = typeof sp.type === "string" && TYPES.includes(sp.type) ? sp.type : "";
  const page = parsePage(sp.page);
  const isAdmin = user.role === "ADMIN";
  const now = new Date();
  const base = BASE_PATH[tab];

  const { items, total, pageSize } = await listReservations({
    page,
    pageSize: 10,
    q: q || undefined,
    resourceType: type || undefined,
    ...(!isAdmin && { userId: user.id }),
    ...(tab === "upcoming" && { status: "CONFIRMED" as const, from: now }),
    ...(tab === "cancelled" && { status: "CANCELLED" as const }),
  });

  return (
    <>
      <SearchForm
        action={base}
        q={q}
        type={type}
        showType
        placeholder="Search by resource, purpose, name or email…"
      />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {q || type ? "No reservations match your search." : EMPTY_TEXT[tab]}{" "}
          <Link href="/reservations/new" className="font-medium text-indigo-700 underline">
            Make a reservation
          </Link>
        </p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.resource.name}</p>
                  <span className={r.status === "CONFIRMED" ? badgeGreen : badgeGray}>
                    {r.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {r.purpose}
                  {isAdmin ? ` · ${r.reservedByName}` : ""}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                </p>
                <PaymentInfo r={r} canPay={r.userId === user.id} />
              </div>
              {r.status === "CONFIRMED" && r.endAt > now && (
                <CancelButton id={r.id} paid={r.paymentStatus === "PAID"} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} reservation{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-4">
          {page > 1 && (
            <Link href={buildHref(base, { q, type, page: page - 1 })} className="font-medium text-indigo-700 hover:underline">
              ← Previous
            </Link>
          )}
          {total > page * pageSize && (
            <Link href={buildHref(base, { q, type, page: page + 1 })} className="font-medium text-indigo-700 hover:underline">
              Next →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}