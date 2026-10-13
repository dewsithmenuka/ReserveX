import Link from "next/link";
import { btnPrimary } from "@/components/ui/styles";
import { ReservationTabs } from "./ReservationTabs";

export function ReservationsShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
        <Link href="/reservations/new" className={btnPrimary}>
          New reservation
        </Link>
      </div>
      <ReservationTabs />
      {children}
    </div>
  );
}