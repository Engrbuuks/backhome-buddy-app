import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { locationByCode } from "@/lib/testimonials/locations";
import { signProofUrls } from "@/lib/storage/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*", // public read of approved testimonials
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/** Public: approved testimonials for the WordPress marketing site.
 *  GET /api/testimonials?limit=20
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const db = createAdminClient();
  const { data, error } = await db
    .from("testimonials")
    .select("id, author_name, location_code, location_label, rating, body, media_url, media_kind, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

  // Sign any media so the WP site can render it (URLs expire; WP should cache the JSON short-term).
  const rows = data ?? [];
  const withMedia = rows.filter((r) => r.media_url).map((r) => ({ id: r.id, file_url: r.media_url, kind: r.media_kind }));
  let mediaMap = new Map<string, string>();
  try {
    const signed = await signProofUrls(withMedia as any[]);
    mediaMap = new Map(signed.map((s: any) => [s.id, s.signedUrl]));
  } catch {}

  const testimonials = rows.map((r) => {
    const loc = locationByCode(r.location_code);
    return {
      id: r.id,
      name: r.author_name,
      location: r.location_label || loc?.label || null,
      flag: loc?.flag || null,
      rating: r.rating,
      body: r.body,
      media: mediaMap.get(r.id) || null,
      media_kind: r.media_kind || null,
      date: r.approved_at,
    };
  });

  return NextResponse.json({ testimonials }, { headers: CORS });
}
