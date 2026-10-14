import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/guards";
import { buildHref, parsePage, parseQuery } from "@/lib/search";
import { formatDateTime } from "@/lib/time";
import { getAdminStats } from "@/modules/admin/service";
import { listReservations } from "@/modules/reservations/service";
import { CancelButton } from "@/components/reservations/CancelButton";
import { PaymentInfo } from "@/components/payments/PaymentInfo";
import { SearchForm } from "@/components/ui/SearchForm";
import { badgeGray, badgeGreen, card } from "@/components/ui/styles";

export const metadata = { title: "Admin · Reservations · ReserveX" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FILTERS = [
  { key: "all", label: "All", href: "/admin" },
  { key: "CONFIRMED", label: "Confirmed", href: "/admin?status=CONFIRMED" },
  { key: "CANCELLED", label: "Cancelled", href: "/admin?status=CANCELLED" },
] as const;

const TYPES = ["room", "equipment", "vehicle"];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-indigo-700">{value}</p>
    </div>
  );
}

async function AdminReservations({ searchParams }: Props) {
  await connection();
  await requirePageAdmin();
  const sp = await searchParams;

  const status = sp.status === "CONFIRMED" || sp.status === "CANCELLED" ? sp.status : undefined;
  const q = parseQuery(sp.q);
  const type = typeof sp.type === "string" && TYPES.includes(sp.type) ? sp.type : "";
  const page = parsePage(sp.page);
  const now = new Date();

  const [stats, { items, total, pageSize }] = await Promise.all([
    getAdminStats(),
    listReservations({
      page,
      pageSize: 15,
      q: q || undefined,
      resourceType: type || undefined,
      ...(status && { status }),
    }),
  ]);

  const activeKey = status ?? "all";

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={stats.users} />
        <Stat label="Confirmed bookings" value={stats.confirmed} />
        <Stat label="Cancelled bookings" value={stats.cancelled} />
        <Stat label="Active resources" value={stats.activeResources} />
      </div>

      <div className="mb-4 flex gap-1" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            aria-current={activeKey === f.key ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              activeKey === f.key ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <SearchForm
        action="/admin"
        q={q}
        type={type}
        showType
        hidden={status ? { status } : {}}
        placeholder="Search by resource, purpose, name or email…"
      />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {q || type ? "No reservations match your search." : "No reservations found."}
        </p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.resource.name}</p>
                  <span className={r.status === "CONFIRMED" ? badgeGreen : badgeGray}>
                    {r.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {r.purpose} · {r.reservedByName} ({r.reservedByEmail})
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                </p>
                <PaymentInfo r={r} canPay={false} />
              </div>
              {r.status === "CONFIRMED" && r.endAt > now && (
                <CancelButton id={r.id} paid={r.paymentStatus === "PAID"} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <span>{total} reservation{total === 1 ? "" : "s"}</span>
        <div className="flex gap-4">
          {page > 1 && (
            <Link href={buildHref("/admin", { status, q, type, page: page - 1 })} className="font-medium text-indigo-700 hover:underline">
              ← Previous
            </Link>
          )}
          {total > page * pageSize && (
            <Link href={buildHref("/admin", { status, q, type, page: page + 1 })} className="font-medium text-indigo-700 hover:underline">
              Next →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminReservationsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <AdminReservations searchParams={searchParams} />
    </Suspense>
  );
}