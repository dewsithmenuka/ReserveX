import { db } from "@/lib/db";

export async function getAdminStats() {
  const [users, confirmed, cancelled, activeResources, inactiveResources] = await Promise.all([
    db.user.count(),
    db.reservation.count({ where: { status: "CONFIRMED" } }),
    db.reservation.count({ where: { status: "CANCELLED" } }),
    db.resource.count({ where: { isActive: true } }),
    db.resource.count({ where: { isActive: false } }),
  ]);
  return { users, confirmed, cancelled, activeResources, inactiveResources };
}