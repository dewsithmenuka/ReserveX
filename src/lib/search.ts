export function parseQuery(v: string | string[] | undefined) {
  return typeof v === "string" ? v.trim().slice(0, 100) : "";
}

export function parsePage(v: string | string[] | undefined) {
  const n = typeof v === "string" ? Number(v) : 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function buildHref(base: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}