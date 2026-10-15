import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { parseQuery } from "@/lib/search";
import { formatMoney } from "@/lib/money";
import { listResourcesSchema } from "@/lib/validations/resource";
import { listResources } from "@/modules/resources/service";
import { SearchForm } from "@/components/ui/SearchForm";
import {
  btnPrimary,
  card,
} from "@/components/ui/styles";

export const metadata = {
  title: "Resources · ReserveX",
};

type Props = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

async function ResourcesContent({ searchParams }: Props) {
  await connection();
  await requirePageUser();

  const sp = await searchParams;
  const q = parseQuery(sp.q);
  const type =
    typeof sp.type === "string" ? sp.type.slice(0, 60) : "";

  const { items, total } = await listResources(
    listResourcesSchema.parse({
      pageSize: "100",
      isActive: "true",
      ...(q && { q }),
      ...(type && { type }),
    }),
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Browse resources
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Find an active resource for your next reservation.
          </p>
        </div>

        <Link href="/reservations/new" className={btnPrimary}>
          Make a reservation
        </Link>
      </div>

      <p className="mb-4 text-sm text-slate-600">
        {total} active resource{total === 1 ? "" : "s"}
      </p>

      <SearchForm
        action="/resources"
        q={q}
        type={type}
        showType
        placeholder="Search by name, location or description…"
      />

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {q || type
            ? "No active resources match your search."
            : "No active resources are available yet."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((resource) => (
            <li key={resource.id} className={`${card} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {resource.name}
                </h2>
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Active
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                {resource.type}
              </p>

              {resource.description && (
                <p className="mt-3 text-sm text-slate-600">
                  {resource.description}
                </p>
              )}

              {resource.location && (
                <p className="mt-3 text-sm text-slate-600">
                  Location: {resource.location}
                </p>
              )}

              {resource.capacity != null && (
                <p className="mt-1 text-sm text-slate-600">
                  Capacity: {resource.capacity}
                </p>
              )}

              <p className="mt-4 font-semibold">
                {resource.pricePerHourCents > 0
                  ? `${formatMoney(resource.pricePerHourCents)} / hour`
                  : "Free"}
              </p>

              <Link
                href="/reservations/new"
                className={`${btnPrimary} mt-5 w-full`}
              >
                Reserve a resource
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ResourcesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading resources…</p>}>
      <ResourcesContent searchParams={searchParams} />
    </Suspense>
  );
}