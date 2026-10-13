import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { listResourcesSchema } from "@/lib/validations/resource";
import { listResources } from "@/modules/resources/service";
import { ReservationForm } from "@/components/reservations/ReservationForm";
import { card } from "@/components/ui/styles";

export const metadata = { title: "New reservation · ReserveX" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Content({ searchParams }: Props) {
  await connection();
  const user = await requirePageUser();
  const sp = await searchParams;
  const { items } = await listResources(
    listResourcesSchema.parse({ isActive: "true", pageSize: "100" }),
  );

  if (items.length === 0) {
    return <p className="text-slate-500">No active resources to book yet.</p>;
  }

  const wanted = typeof sp.resourceId === "string" ? sp.resourceId : undefined;
  const preselected = wanted && items.some((r) => r.id === wanted) ? wanted : "";

  return (
    <ReservationForm
      resources={items.map((r) => ({ id: r.id, name: r.name, type: r.type }))}
      defaultResourceId={preselected}
      user={{ name: user.name, email: user.email }}
    />
  );
}

export default function NewReservationPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New reservation</h1>
      <div className={`${card} p-6`}>
        <Suspense fallback={<p className="text-slate-500">Loading form…</p>}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}