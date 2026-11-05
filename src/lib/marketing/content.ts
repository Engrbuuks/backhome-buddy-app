/**
 * What the public pages say, read from the live database.
 *
 * WHY THIS IS NOT A LIST OF STRINGS IN A FILE
 *
 * The marketing site and the app drifted apart, and it cost real credibility:
 * the site went on advertising eight services, two of which had been retired,
 * and carried invented figures for tasks completed and client satisfaction
 * that nothing in the system had ever produced.
 *
 * That cannot happen again if the page reads the same rows the app sells from.
 * Deactivate a service in the admin and it leaves this page. Change a price
 * and this page changes. There is nowhere left for a claim to hide.
 *
 * Server only, by virtue of importing the server client.
 */
import { createClient } from "@/lib/supabase/server";
import { computeInstantPrice } from "@/lib/money/instant-price";

export type MarketingService = {
  id: string;
  name: string;
  description: string | null;
  /** "$80", "From $80", or "Quoted per task" — already decided. */
  priceLabel: string;
  /** True where a client can pay and start without waiting for anybody. */
  payNow: boolean;
  handlesCash: boolean;
};

export type MarketingData = {
  services: MarketingService[];
  stateNames: string[];
  /** Pages must never state a count we cannot evidence; this is a real count
   *  of rows, which is a different thing from a marketing statistic. */
  stateCount: number;
  anyFixedPrice: boolean;
};

/** The policy pages live on the existing site. One constant, so moving them
 *  later is a one line change rather than a hunt. */
export const POLICY = {
  privacy: "https://backhomebuddy.ng/privacy-policy/",
  terms: "https://backhomebuddy.ng/terms-of-service/",
};

export async function getMarketingData(): Promise<MarketingData> {
  const empty: MarketingData = { services: [], stateNames: [], stateCount: 0, anyFixedPrice: false };
  try {
    const supabase = createClient();
    const [{ data: services }, { data: regions }, { data: upliftRow }] = await Promise.all([
      supabase
        .from("service_types")
        .select("id, name, description, pricing_mode, from_price_usd, handles_cash")
        .eq("active", true)
        .order("sort_order"),
      supabase.from("regions").select("name, zone").eq("active", true).order("name"),
      supabase.from("app_settings").select("value").eq("key", "pricing_zone_b_uplift_pct").maybeSingle(),
    ]);

    const upliftPct = Number((upliftRow?.value as any)?.pct ?? 25);

    const mapped: MarketingService[] = (services ?? []).map((s: any) => {
      // Quote the base zone price, which is the lowest honest figure. A client
      // in a Zone B state sees their own figure the moment they pick a state
      // on the request form, computed by the same function.
      const p = computeInstantPrice({
        fromPriceUsd: Number(s.from_price_usd ?? 0),
        zone: "A",
        zoneBUpliftPct: upliftPct,
        urgent: false,
        urgentSurchargePct: 0,
      });
      const hasPrice = p.totalUsd > 0;
      const fixed = s.pricing_mode === "fixed" && hasPrice;
      return {
        id: s.id,
        name: s.name,
        description: s.description ?? null,
        priceLabel: fixed
          ? `$${Math.round(p.totalUsd)}`
          : hasPrice
            ? `From $${Math.round(p.totalUsd)}`
            : "Quoted per task",
        payNow: fixed,
        handlesCash: Boolean(s.handles_cash),
      };
    });

    const stateNames = (regions ?? []).map((r: any) => r.name);
    return {
      services: mapped,
      stateNames,
      stateCount: stateNames.length,
      anyFixedPrice: mapped.some((s) => s.payNow),
    };
  } catch {
    // A database that cannot be reached must not take the front page down.
    return empty;
  }
}

/**
 * The vetting sequence, in the order it actually happens.
 *
 * Every line here is something the code genuinely enforces, which is why this
 * one is hard coded rather than read from the database: it describes
 * src/lib/admin/vetting-checks.ts, and if that file changes this text must be
 * changed with it deliberately.
 *
 * Note what is absent. No claim of a criminal record check, because the Police
 * Character Certificate is collected where a buddy has one and does not block
 * approval. Saying otherwise was the second worst thing on the old site.
 */
export const VETTING_STEPS: { title: string; body: string }[] = [
  {
    title: "They prove who they are",
    body: "A government ID and a National Identification Number, plus proof of the address they live at. Not a photograph of a form: the document itself, stored and checked.",
  },
  {
    title: "Their bank confirms it",
    body: "We look up their account number with their bank and compare the name the bank holds against the name on their application. To open that account they already passed the bank's own checks, which means BVN, which means fingerprints taken at a branch. If the names do not match, they do not proceed.",
  },
  {
    title: "Two people vouch for them",
    body: "Two guarantors with names, numbers and addresses we can call. Not references on paper.",
  },
  {
    title: "They sign a confidentiality agreement",
    body: "Binding, recorded, and tied to their name. What they see in your family's home is not theirs to repeat.",
  },
  {
    title: "They sit an interview and are scored",
    body: "Conduct, judgement, reliability and how they handle an awkward situation, marked against a written rubric rather than a feeling.",
  },
  {
    title: "They do a trial task first",
    body: "A real task, with real proof, graded before they are allowed near yours.",
  },
  {
    title: "Harder work needs more",
    body: "A task involving a vulnerable person requires that we have met the buddy face to face. A high value task requires their identity verified against a government record. The checks scale with what could go wrong, rather than being the same for a parcel and a parent.",
  },
];
