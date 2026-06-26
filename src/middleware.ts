/**
 * Edge middleware (Feature A.2.3 — wildcard subdomain routing).
 * Resolves the tenant slug from the Host (or dev override) and forwards it on a
 * request header `x-neyo-tenant-slug`, so server code reads it consistently.
 *
 * NOTE: runs on the Edge runtime — keep it dependency-light (no Prisma here).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantSlug } from "@/lib/core/subdomain";

export function middleware(req: NextRequest) {
  const slug = resolveTenantSlug({
    host: req.headers.get("host"),
    searchTenant: req.nextUrl.searchParams.get("tenant"),
    headerTenant: req.headers.get("x-neyo-tenant"),
  });

  const requestHeaders = new Headers(req.headers);
  if (slug) {
    requestHeaders.set("x-neyo-tenant-slug", slug);
  } else {
    requestHeaders.delete("x-neyo-tenant-slug");
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on app routes + API, skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
