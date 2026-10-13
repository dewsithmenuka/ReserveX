import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw notFound("User");

  const [total, upcoming] = await Promise.all([
    db.reservation.count({ where: { userId } }),
    db.reservation.count({
      where: { userId, status: "CONFIRMED", endAt: { gt: new Date() } },
    }),
  ]);
  return { ...user, totalReservations: total, upcomingReservations: upcoming };
}

export function updateName(userId: string, name: string) {
  return db.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect");
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
}