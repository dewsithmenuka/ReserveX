import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/guards";
import { parsePage, parseQuery } from "@/lib/search";
import { listPayments } from "@/modules/payments/service";
import { PaymentsList } from "@/components/payments/PaymentsList";
import { SearchForm } from "@/components/ui/SearchForm";

export const metadata = { title: "Payments · ReserveX" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Content({ searchParams }: Props) {
  await connection();
  const user = await requirePageUser();
  const sp = await searchParams;
  const q = parseQuery(sp.q);
  const page = parsePage(sp.page);
  const isAdmin = user.role === "ADMIN";
  const data = await listPayments({
    ...(!isAdmin && { userId: user.id }),
    q: q || undefined,
    page,
    pageSize: 10,
  });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{isAdmin ? "All payments" : "My payments"}</h1>
      {sp.paid === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ Payment successful. Your reservation is paid.
        </p>
      )}
      <SearchForm
        action="/payments"
        q={q}
        placeholder="Search by resource, purpose, email or card last 4…"
      />
      <PaymentsList {...data} q={q} basePath="/payments" showEmail={isAdmin} />
    </>
  );
}

export default function PaymentsPage({ searchParams }: Props) {
  return (
    <div>
      <Suspense fallback={<p className="text-slate-500">Loading payments…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}