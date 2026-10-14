import { db } from "@/lib/db";
import { dayBounds } from "@/lib/time";

export async function getDashboardSummary(viewer: { id: string; role: string }) {
  const now = new Date();
  const { start, end } = dayBounds(now);
  const isAdmin = viewer.role === "ADMIN";

  const [activeResources, upcoming, today, inUse, next] = await Promise.all([
    db.resource.count({ where: { isActive: true } }),
    db.reservation.count({ where: { status: "CONFIRMED", startAt: { gt: now } } }),
    db.reservation.count({
      where: { status: "CONFIRMED", startAt: { lt: end }, endAt: { gt: start } },
    }),
    db.reservation.findMany({
      where: {
        status: "CONFIRMED",
        startAt: { lte: now },
        endAt: { gt: now },
        resource: { isActive: true },
      },
      distinct: ["resourceId"],
      select: { resourceId: true },
    }),
    // Users only see their own bookings; no emails are ever selected.
    db.reservation.findMany({
      where: { status: "CONFIRMED", endAt: { gt: now }, ...(!isAdmin && { userId: viewer.id }) },
      orderBy: { startAt: "asc" },
      take: 5,
      select: {
        id: true,
        purpose: true,
        reservedByName: true,
        startAt: true,
        endAt: true,
        resource: { select: { id: true, name: true, type: true } },
      },
    }),
  ]);

  return {
    activeResources,
    upcomingReservations: upcoming,
    reservationsToday: today,
    inUseNow: inUse.length,
    availableNow: activeResources - inUse.length,
    nextReservations: next,
  };
}