import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { getDashboardSummary } from "@/modules/dashboard/service";
import { formatDateTime } from "@/lib/time";
import {
  btnPrimary,
  btnSecondary,
  card,
} from "@/components/ui/styles";

export const metadata = { title: "Dashboard · ReserveX" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-indigo-700">
        {value}
      </p>
    </div>
  );
}

async function DashboardContent() {
  await connection();

  const user = await requirePageUser();
  const s = await getDashboardSummary(user);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active resources" value={s.activeResources} />
        <Stat
          label="Upcoming reservations"
          value={s.upcomingReservations}
        />
        <Stat label="Reservations today" value={s.reservationsToday} />
        <Stat label="Available right now" value={s.availableNow} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          {user.role === "ADMIN"
            ? "Next reservations"
            : "Your next reservations"}
        </h2>

        {s.nextReservations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            No upcoming reservations.{" "}
            <Link
              href="/reservations/new"
              className="font-medium text-indigo-700 underline"
            >
              Create one
            </Link>
          </p>
        ) : (
          <ul className={`${card} divide-y divide-slate-100`}>
            {s.nextReservations.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between"
              >
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
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

        <div className="flex gap-2">
          <Link href="/resources/new" className={btnSecondary}>
            New resource
          </Link>

          <Link href="/reservations/new" className={btnPrimary}>
            New reservation
          </Link>
        </div>
      </div>

      <Suspense
        fallback={<p className="text-slate-500">Loading dashboard…</p>}
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}