import { Suspense } from "react";
import { ReservationsShell } from "@/components/reservations/ReservationsShell";
import { ReservationsView, type SearchParams } from "@/components/reservations/ReservationsView";

export const metadata = { title: "All reservations · ReserveX" };

export default function AllReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <ReservationsShell>
      <Suspense fallback={<p className="text-slate-500">Loading reservations…</p>}>
        <ReservationsView tab="all" searchParams={searchParams} />
      </Suspense>
    </ReservationsShell>
  );
}