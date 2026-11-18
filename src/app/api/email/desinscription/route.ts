import { NextResponse, type NextRequest } from "next/server";
import { unsubscribe } from "@/lib/email/unsubscribe-service";

/**
 * One-click unsubscribe (RFC 8058), called by the mail client from the
 * List-Unsubscribe header: POST with the body "List-Unsubscribe=One-Click".
 */
export async function POST(request: NextRequest) {
  const body = (await request.text()).slice(0, 200);
  if (!body.includes("List-Unsubscribe=One-Click")) return new NextResponse(null, { status: 400 });
  const result = await unsubscribe(request.nextUrl.searchParams.get("token"), "one-click");
  const status = { done: 200, invalid: 400, rate_limited: 429, unavailable: 503 }[result];
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

/** A GET (link prefetch, scanner) never unsubscribes: it opens the confirmation page. */
export async function GET(request: NextRequest) {
  const url = new URL("/desinscription", request.nextUrl.origin);
  const token = request.nextUrl.searchParams.get("token");
  if (token) url.searchParams.set("token", token.slice(0, 600));
  return NextResponse.redirect(url, 303);
}
