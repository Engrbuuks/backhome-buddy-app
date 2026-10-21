import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request so server components
 * never act on an expired token. Standard @supabase/ssr pattern, with two
 * guards added after a production timeout.
 *
 * WHY THE TIMEOUT EXISTS
 *
 * `supabase.auth.getUser()` is a network round trip to Supabase, and it runs
 * before every page in the app. If Supabase is slow or asleep — a free tier
 * project pauses itself after about a week with no traffic — this call hangs,
 * Vercel kills the middleware, and EVERY page returns "Routing Middleware for
 * this page took too long to respond." The whole site goes dark because one
 * upstream was unreachable.
 *
 * Racing it against a short timer turns that into something survivable: the
 * request continues without a refreshed session, the page's own auth check
 * sends the visitor to the login screen, and the site stays up. It is a worse
 * experience than normal and a far better one than a blank error page. The
 * cause is logged so the real problem is still visible.
 */

/** How long to wait for Supabase before giving up on the refresh. Vercel's own
 *  middleware limit is much higher; the point is to fail well before it. */
const AUTH_TIMEOUT_MS = 3500;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without configuration there is nothing to refresh, and throwing here would
  // take down every route rather than just the ones that need a session.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    const timed = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("supabase auth refresh timed out")), AUTH_TIMEOUT_MS),
    );
    await Promise.race([supabase.auth.getUser(), timed]);
  } catch (e) {
    // Deliberately not fatal. Log it so a sleeping or struggling Supabase is
    // visible in the Vercel logs instead of appearing as a mystery timeout.
    console.error("middleware: auth refresh skipped —", e instanceof Error ? e.message : e);
  }

  return response;
}

export const config = {
  matcher: [
    // Static assets, the service worker, the manifest and the icons need no
    // session. They used to each trigger their own Supabase round trip, which
    // is pure latency on every page load and extra load on the one upstream
    // that can take the site down.
    "/((?!_next/static|_next/image|favicon.ico|images|icons|sw\\.js|manifest\\.webmanifest|apple-touch-icon\\.png|api/webhooks|api/cron).*)",
  ],
};
