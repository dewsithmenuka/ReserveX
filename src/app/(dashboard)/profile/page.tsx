import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { formatDateTime } from "@/lib/time";
import { getProfile } from "@/modules/users/service";
import { NameForm, PasswordForm } from "@/components/profile/ProfileForms";
import { badgeGray, badgeGreen, btnSecondary, card } from "@/components/ui/styles";

export const metadata = { title: "Profile · ReserveX" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-indigo-700">{value}</p>
    </div>
  );
}

async function ProfileContent() {
  await connection();
  const session = await requirePageUser();
  const p = await getProfile(session.id);

  return (
    <div className="space-y-6">
      <section className={`${card} flex flex-wrap items-center gap-4 p-6`}>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
          {p.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <span className={p.role === "ADMIN" ? badgeGreen : badgeGray}>{p.role === "ADMIN" ? "Admin" : "Member"}</span>
          </div>
          <p className="truncate text-sm text-slate-500">{p.email}</p>
          <p className="text-xs text-slate-500">Joined {formatDateTime(p.createdAt)}</p>
        </div>
        <Link href="/reservations" className={btnSecondary}>My reservations</Link>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total reservations" value={p.totalReservations} />
        <Stat label="Upcoming" value={p.upcomingReservations} />
      </div>

      <section className={`${card} p-6`}>
        <h2 className="mb-4 font-semibold">Edit profile</h2>
        <NameForm name={p.name} />
      </section>

      <section className={`${card} p-6`}>
        <h2 className="mb-4 font-semibold">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Profile</h1>
      <Suspense fallback={<p className="text-slate-500">Loading profile…</p>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}