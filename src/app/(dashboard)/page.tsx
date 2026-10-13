import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDashboardSummary } from "@/modules/dashboard/service";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Dashboard · ReserveX" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

async function DashboardContent() {
  await connection();
  const s = await getDashboardSummary();

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active resources" value={s.activeResources} />
        <Stat label="Upcoming reservations" value={s.upcomingReservations} />
        <Stat label="Reservations today" value={s.reservationsToday} />
        <Stat label="Available right now" value={s.availableNow} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Next reservations</h2>
        {s.nextReservations.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-white p-6 text-center text-slate-500">
            No upcoming reservations.{" "}
            <Link href="/reservations/new" className="font-medium text-indigo-700 underline">
              Create one
            </Link>
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {s.nextReservations.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between">
                <div>
                  <p className="font-medium">{r.resource.name}</p>
                  <p className="text-sm text-slate-500">
                    {r.purpose} · {r.reservedByName}
                  </p>
                </div>
                <p className="text-sm text-slate-700">
                  {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/resources/new" className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">
            New resource
          </Link>
          <Link href="/reservations/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            New reservation
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-slate-500">Loading dashboard…</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}