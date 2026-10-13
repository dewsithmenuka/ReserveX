import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/guards";
import { listResourcesSchema } from "@/lib/validations/resource";
import { listResources } from "@/modules/resources/service";
import { ToggleActiveButton } from "@/components/admin/ToggleActiveButton";
import { badgeGray, badgeGreen, btnPrimary, btnSecondary, card } from "@/components/ui/styles";

export const metadata = { title: "Admin · Resources · ReserveX" };

async function AdminResources() {
  await connection();
  await requirePageAdmin();
  const { items, total } = await listResources(listResourcesSchema.parse({ pageSize: "100" }));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">{total} resource{total === 1 ? "" : "s"}</p>
        <Link href="/resources/new" className={btnPrimary}>New resource</Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No resources yet.
        </p>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.name}</p>
                  <span className={r.isActive ? badgeGreen : badgeGray}>{r.isActive ? "Active" : "Inactive"}</span>
                </div>
                <p className="text-sm text-slate-500">
                  {r.type}
                  {r.location ? ` · ${r.location}` : ""}
                  {r.capacity ? ` · Capacity ${r.capacity}` : ""}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Link href={`/resources/${r.id}/edit`} className={`${btnSecondary} !px-3 !py-1.5`}>Edit</Link>
                <ToggleActiveButton id={r.id} isActive={r.isActive} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminResourcesPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <AdminResources />
    </Suspense>
  );
}