import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePageAdmin } from "@/lib/guards";
import { parseId } from "@/lib/http";
import { getResource } from "@/modules/resources/service";
import { ResourceForm } from "@/components/resources/ResourceForm";
import { card } from "@/components/ui/styles";

export const metadata = { title: "Edit resource · ReserveX" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requirePageAdmin();
  const { id } = await params;
  let resource = null;
  try {
    resource = await getResource(parseId(id));
  } catch {
    // invalid or missing id
  }
  if (!resource) notFound();
  return <ResourceForm resource={resource} />;
}

export default function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit resource</h1>
      <div className={`${card} p-6`}>
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}