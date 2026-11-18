import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/config";

/**
 * Optimistic check only: no session cookie at all -> sign-in page.
 * The real check (signature, expiry, revocation, role) is done by the DAL on the server.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/connexion") return NextResponse.next();
  const hasCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (hasCookie) return NextResponse.next();

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const url = request.nextUrl.clone();
  url.search = "";
  if (isAdmin) {
    url.pathname = "/admin/connexion";
  } else {
    url.pathname = "/connexion";
    url.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/mon-compte", "/mon-compte/:path*", "/admin", "/admin/:path*"],
};
