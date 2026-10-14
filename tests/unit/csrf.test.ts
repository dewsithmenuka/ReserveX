import { describe, expect, it } from "vitest";
import { isAllowedRequest } from "@/lib/csrf";

const base = { method: "POST", origin: null, host: "app.test", secFetchSite: null };

describe("isAllowedRequest (CSRF)", () => {
  it("never blocks safe methods", () => {
    expect(isAllowedRequest({ ...base, method: "GET", origin: "https://evil.test" })).toBe(true);
  });
  it("allows same-origin writes", () => {
    expect(isAllowedRequest({ ...base, origin: "https://app.test" })).toBe(true);
  });
  it("blocks cross-origin writes and the opaque 'null' origin", () => {
    expect(isAllowedRequest({ ...base, origin: "https://evil.test" })).toBe(false);
    expect(isAllowedRequest({ ...base, origin: "null" })).toBe(false);
    expect(isAllowedRequest({ ...base, origin: "not a url" })).toBe(false);
  });
  it("falls back to Sec-Fetch-Site when Origin is missing", () => {
    expect(isAllowedRequest({ ...base, secFetchSite: "cross-site" })).toBe(false);
    expect(isAllowedRequest({ ...base, secFetchSite: "same-site" })).toBe(false);
    expect(isAllowedRequest({ ...base, secFetchSite: "same-origin" })).toBe(true);
  });
  it("allows non-browser clients that send neither header", () => {
    expect(isAllowedRequest(base)).toBe(true);
  });
  it("honours an explicitly configured app origin", () => {
    expect(
      isAllowedRequest({ ...base, origin: "https://www.app.test", appOrigin: "https://www.app.test" }),
    ).toBe(true);
  });
});