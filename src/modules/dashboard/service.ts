import { db } from "@/lib/db";
import { dayBounds } from "@/lib/time";

export async function getDashboardSummary() {
  const now = new Date();
  const { start, end } = dayBounds(now);

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
    db.reservation.findMany({
      where: { status: "CONFIRMED", endAt: { gt: now } },
      orderBy: { startAt: "asc" },
      take: 5,
      include: { resource: { select: { id: true, name: true, type: true } } },
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