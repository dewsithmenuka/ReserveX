import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/guards";
import { formatMoney } from "@/lib/money";
import { parsePage, parseQuery } from "@/lib/search";
import { getPaymentStats, listPayments } from "@/modules/payments/service";
import { PaymentsList } from "@/components/payments/PaymentsList";
import { SearchForm } from "@/components/ui/SearchForm";

export const metadata = { title: "Admin · Payments · ReserveX" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-indigo-700">{value}</p>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  await connection();
  await requirePageAdmin();
  const sp = await searchParams;
  const q = parseQuery(sp.q);
  const page = parsePage(sp.page);
  const [stats, data] = await Promise.all([
    getPaymentStats(),
    listPayments({ q: q || undefined, page, pageSize: 15 }),
  ]);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net collected" value={formatMoney(stats.collectedCents)} />
        <Stat label="Refunded" value={formatMoney(stats.refundedCents)} />
        <Stat label={`Outstanding (${stats.outstandingCount})`} value={formatMoney(stats.outstandingCents)} />
        <Stat label="Failed attempts" value={String(stats.failedAttempts)} />
      </div>
      <SearchForm
        action="/admin/payments"
        q={q}
        placeholder="Search by resource, purpose, email or card last 4…"
      />
      <PaymentsList {...data} q={q} basePath="/admin/payments" showEmail />
    </>
  );
}

export default function AdminPaymentsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}