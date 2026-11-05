import { NextResponse } from "next/server";
import { getMarketingData, VETTING_STEPS } from "@/lib/marketing/content";

export const dynamic = "force-dynamic";

/**
 * The public catalogue, for the WordPress site to render.
 *
 * WHY THIS EXISTS
 *
 * backhomebuddy.ng is WordPress and cannot run the app's pages, so without
 * this the marketing site would once again be a hand maintained copy of the
 * catalogue — which is exactly how it came to be advertising two services that
 * had been retired, and quoting figures nothing had produced.
 *
 * The WordPress plugin reads this and caches it. Deactivate a service in the
 * admin and it leaves the website within hours, without anybody editing a
 * page.
 *
 * SAFE TO BE PUBLIC: every field here is already on the public pages. Service
 * names, descriptions, published prices and the states worked in. No client,
 * no buddy, no request, no money movement, and nothing that is not already
 * printed on /services for anyone to read.
 */
export async function GET() {
  const data = await getMarketingData();

  return NextResponse.json(
    {
      updated_at: new Date().toISOString(),
      services: data.services.map((s) => ({
        name: s.name,
        description: s.description,
        price_label: s.priceLabel,
        pay_now: s.payNow,
        handles_cash: s.handlesCash,
      })),
      states: data.stateNames,
      state_count: data.stateCount,
      any_fixed_price: data.anyFixedPrice,
      vetting: VETTING_STEPS,
    },
    {
      headers: {
        // The plugin caches for hours anyway; this keeps a direct hit cheap.
        "cache-control": "public, s-maxage=900, stale-while-revalidate=86400",
        "access-control-allow-origin": "*",
      },
    },
  );
}
