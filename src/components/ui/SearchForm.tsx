import Link from "next/link";
import { btnSecondary, inputCls } from "@/components/ui/styles";
import { buildHref } from "@/lib/search";

export function SearchForm({
  action,
  q,
  placeholder,
  type,
  showType = false,
  hidden = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  type?: string;
  showType?: boolean;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex flex-wrap gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label="Search"
        maxLength={100}
        className={`${inputCls} min-w-0 flex-1`}
      />
      {showType && (
        <select name="type" defaultValue={type ?? ""} aria-label="Resource type" className={`${inputCls} !w-auto`}>
          <option value="">All types</option>
          <option value="room">Room</option>
          <option value="equipment">Equipment</option>
          <option value="vehicle">Vehicle</option>
        </select>
      )}
      <button type="submit" className={btnSecondary}>Search</button>
      {(q || type) && (
        <Link href={buildHref(action, hidden)} className={btnSecondary}>Clear</Link>
      )}
    </form>
  );
}