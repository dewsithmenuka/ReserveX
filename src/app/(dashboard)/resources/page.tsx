import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { listResourcesSchema } from "@/lib/validations/resource";
import { listResources } from "@/modules/resources/service";
import { badgeGray, badgeGreen, btnPrimary, btnSecondary, card, inputCls } from "@/components/ui/styles";

export const metadata = { title: "Resources · ReserveX" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function ResourceList({ searchParams }: Props) {
  await connection();
  const user = await requirePageUser();
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === "string" && v !== ""),
  );
  const parsed = listResourcesSchema.safeParse(flat);
  const q = parsed.success ? parsed.data : listResourcesSchema.parse({});
  const { items, total } = await listResources(q);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams(flat as Record<string, string>);
    sp.set("page", String(p));
    return `/resources?${sp.toString()}`;
  };

  return (
    <>
      <form className={`${card} mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]`} role="search">
        <input name="q" defaultValue={q.q} placeholder="Search name, location, description…" aria-label="Search" className={inputCls} />
        <select name="type" defaultValue={q.type ?? ""} aria-label="Type" className={inputCls}>
          <option value="">All types</option>
          <option value="room">Room</option>
          <option value="equipment">Equipment</option>
          <option value="vehicle">Vehicle</option>
        </select>
        <select name="isActive" defaultValue={q.isActive ?? ""} aria-label="Status" className={inputCls}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button className={btnSecondary}>Filter</button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No resources match your search.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <li key={r.id} className={`${card} flex flex-col p-5`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{r.name}</h2>
                <span className={r.isActive ? badgeGreen : badgeGray}>{r.isActive ? "Active" : "Inactive"}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-indigo-600">{r.type}</p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{r.description ?? "No description."}</p>
              <p className="mt-3 text-xs text-slate-500">
                {r.location ?? "No location"}
                {r.capacity ? ` · Capacity ${r.capacity}` : ""}
              </p>
              <div className="mt-4 flex gap-2">
                {r.isActive ? (
                  <Link href={`/reservations/new?resourceId=${r.id}`} className={btnPrimary}>Reserve</Link>
                ) : (
                  <span className={`${btnSecondary} cursor-not-allowed opacity-60`} aria-disabled>Unavailable</span>
                )}
                {user.role === "ADMIN" && (
                  <Link href={`/resources/${r.id}/edit`} className={btnSecondary}>Edit</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
        <span>{total} resource{total === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          {q.page > 1 && <Link href={pageHref(q.page - 1)} className={btnSecondary}>Previous</Link>}
          {total > q.page * q.pageSize && <Link href={pageHref(q.page + 1)} className={btnSecondary}>Next</Link>}
        </div>
      </div>
    </>
  );
}

async function NewButton() {
  await connection();
  const user = await requirePageUser();
  return user.role === "ADMIN" ? (
    <Link href="/resources/new" className={btnPrimary}>New resource</Link>
  ) : null;
}

export default function ResourcesPage({ searchParams }: Props) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
        <Suspense><NewButton /></Suspense>
      </div>
      <Suspense fallback={<p className="text-slate-500">Loading resources…</p>}>
        <ResourceList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}