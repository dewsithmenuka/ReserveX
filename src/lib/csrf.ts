const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isAllowedRequest(input: {
  method: string;
  origin: string | null;
  host: string | null;
  secFetchSite: string | null;
  appOrigin?: string;
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;

  if (input.origin) {
    if (input.origin === "null") return false;
    try {
      const origin = new URL(input.origin);
      return origin.host === input.host || (!!input.appOrigin && origin.origin === input.appOrigin);
    } catch {
      return false;
    }
  }
  if (input.secFetchSite) {
    return input.secFetchSite === "same-origin" || input.secFetchSite === "none";
  }
  // Neither header: not a cross-site browser request (browsers always send one of them on POST).
  return true;
}