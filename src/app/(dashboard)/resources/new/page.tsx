import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/guards";
import { ResourceForm } from "@/components/resources/ResourceForm";
import { card } from "@/components/ui/styles";

export const metadata = { title: "New resource · ReserveX" };

async function Content() {
  await connection();
  await requirePageAdmin();
  return <ResourceForm />;
}

export default function NewResourcePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New resource</h1>
      <div className={`${card} p-6`}>
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Content />
        </Suspense>
      </div>
    </div>
  );
}