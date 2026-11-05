import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/SiteChrome";
import { getMarketingData } from "@/lib/marketing/content";
import { PublicChatWidget } from "@/components/PublicChatWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What we do, and what it costs | Backhome Buddy",
  description:
    "Documents, family visits, property checks and bills paid on your behalf in Nigeria, with published prices and proof of every task.",
};

/**
 * The catalogue, read from the live service rows.
 *
 * Deliberately a list and not a grid of cards. Somebody arriving here is
 * comparing: what is on offer, what it costs, and whether they can pay without
 * a conversation. A list answers that down one column. Six identical boxes
 * make them scan in two directions to answer one question.
 */
export default async function ServicesPage() {
  const { services, stateNames, anyFixedPrice } = await getMarketingData();
  const payNow = services.filter((s) => s.payNow);
  const quoted = services.filter((s) => !s.payNow);

  return (
    <div className="bg-white">
      <SiteHeader />

      <section className="mx-auto max-w-container px-6 pb-16 pt-14 lg:pt-20">
        <h1 className="max-w-[28ch] font-display text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem]">
          What we do, and what it costs
        </h1>
        <p className="mt-6 max-w-[64ch] text-[1.0625rem] leading-8 text-bbb-slate">
          Five things, done properly, rather than everything done approximately. Every price here is for Lagos and
          Abuja; other states carry a small uplift that is shown to you when you pick your state.
        </p>
      </section>

      {payNow.length > 0 && (
        <section className="mx-auto max-w-container px-6 pb-16">
          <div className="border-t border-bbb-border pt-10">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.01em]">Pay and we start</h2>
            <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-bbb-slate">
              These have a set price. There is nothing to quote, so there is nothing to wait for.
            </p>
            <ul className="mt-8 divide-y divide-bbb-border border-t border-bbb-border">
              {payNow.map((s) => (
                <ServiceRow key={s.id} s={s} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {quoted.length > 0 && (
        <section className="mx-auto max-w-container px-6 pb-16">
          <div className="border-t border-bbb-border pt-10">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.01em]">Priced for the job</h2>
            <p className="mt-3 max-w-[64ch] text-[15px] leading-7 text-bbb-slate">
              These vary too much to publish one figure honestly. Tell us what you need and you get a written price
              with the costs itemised, free, before anything is agreed.
            </p>
            <ul className="mt-8 divide-y divide-bbb-border border-t border-bbb-border">
              {quoted.map((s) => (
                <ServiceRow key={s.id} s={s} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {services.length === 0 && (
        <section className="mx-auto max-w-container px-6 pb-16">
          <p className="rounded-2xl border border-dashed border-bbb-border bg-bbb-bg p-8 text-center text-sm text-bbb-slate">
            Our service list is being updated. Send us a message and we will tell you whether we can help.
          </p>
        </section>
      )}

      <section className="border-t border-bbb-border bg-bbb-bg">
        <div className="mx-auto max-w-container px-6 py-16">
          <h2 className="max-w-[30ch] font-display text-2xl font-extrabold tracking-[-0.01em]">
            Something not on the list
          </h2>
          <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-bbb-slate">
            Most of what people ask for is something we have not thought to name. If it can be done lawfully and
            safely, describe it and we will tell you honestly whether we can do it, what it would cost, and what
            evidence you would get back. If we cannot do it, we will say so rather than try.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-xl bg-bbb-strong px-6 py-3.5 text-sm font-bold text-white hover:bg-bbb-dark">
              Describe your task
            </Link>
            <Link href="/trust" className="rounded-xl border border-bbb-border bg-white px-6 py-3.5 text-sm font-bold hover:border-bbb-strong">
              See how we vet buddies
            </Link>
          </div>
          {anyFixedPrice && (
            <p className="mt-8 text-sm leading-7 text-bbb-slate">
              Anything above with a set price can be paid for the moment you have described it. Everything else is
              quoted first and you only pay once you have agreed the figure.
            </p>
          )}
        </div>
      </section>

      <SiteFooter stateNames={stateNames} />
      <PublicChatWidget />
    </div>
  );
}

function ServiceRow({ s }: { s: { id: string; name: string; description: string | null; priceLabel: string; handlesCash: boolean } }) {
  return (
    <li className="grid gap-3 py-7 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-10">
      <div>
        <h3 className="font-display text-xl font-extrabold tracking-[-0.01em]">{s.name}</h3>
        {s.description && (
          <p className="mt-2.5 max-w-[68ch] text-[15px] leading-7 text-bbb-slate">{s.description}</p>
        )}
        {s.handlesCash && (
          <p className="mt-2.5 max-w-[68ch] text-[13px] leading-6 text-bbb-dark">
            We pay the institution directly and photograph the receipt. Your buddy never holds the cash, so the money
            cannot end up anywhere other than where you sent it.
          </p>
        )}
      </div>
      <p className="font-display text-xl font-extrabold tabular-nums sm:text-right">{s.priceLabel}</p>
    </li>
  );
}
