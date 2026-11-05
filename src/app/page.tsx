import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { HOME_FOR } from "@/lib/auth/roles-home";
import { PublicChatWidget } from "@/components/PublicChatWidget";
import { SiteHeader, SiteFooter } from "@/components/marketing/SiteChrome";
import { ProofFrame, ProofAnatomy, ProofStrip } from "@/components/marketing/ProofFrame";
import { getMarketingData, VETTING_STEPS } from "@/lib/marketing/content";

// Reads cookies (auth) and search params (?code= from email confirmation), so
// it must be rendered per request, never statically.
export const dynamic = "force-dynamic";

/**
 * The front page.
 *
 * Still the destination for email confirmation links, which arrive with a
 * ?code=, and still sends a signed in visitor to their own dashboard. What is
 * new is what a stranger sees: the service list, the prices and the states all
 * come from the same rows the app sells from, so the site cannot go on
 * advertising something that has been retired.
 *
 * There are no statistics on this page. Not because none would be impressive,
 * but because none can be evidenced, and the ones that used to be here were
 * invented.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = params?.code;

  if (code) {
    const supabase = createClient();
    try { await supabase.auth.exchangeCodeForSession(code); } catch {}
    const profile = await getCurrentProfile();
    if (profile) redirect(HOME_FOR[(profile.role as keyof typeof HOME_FOR)] ?? "/client/dashboard");
    redirect("/login?confirmed=1");
  }

  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_FOR[(profile.role as keyof typeof HOME_FOR)] ?? "/client/dashboard");

  const { services, stateNames, stateCount, anyFixedPrice } = await getMarketingData();
  const monthly = services.filter((s) => /family|property/i.test(s.name));

  return (
    <div className="bg-white">
      <SiteHeader dark />

      {/* HERO — the artefact, not a slogan over a gradient. */}
      <section className="bg-bbb-charcoal">
        <div className="mx-auto grid max-w-container items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:pb-24 lg:pt-16">
          <div>
            <h1 className="max-w-[16ch] font-display text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.025em] text-white sm:text-[3rem] lg:text-[3.5rem]">
              Your cousin will do it for free. We will do it with receipts.
            </h1>
            <p className="mt-5 max-w-[48ch] text-base leading-7 text-white/70 sm:text-[1.0625rem]">
              Documents, property checks, bills paid and visits to your parents, done in Nigeria by someone we have
              vetted and photographed where and when it happened.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-bbb-strong px-6 py-3.5 text-sm font-bold text-white hover:bg-bbb-dark"
              >
                Start a task
              </Link>
              <Link
                href="/services"
                className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-bold text-white hover:border-white/50"
              >
                See what it costs
              </Link>
            </div>
            {stateCount > 0 && (
              <p className="mt-6 text-sm leading-6 text-white/45">
                Working in {stateCount} {stateCount === 1 ? "state" : "states"} across Nigeria.
              </p>
            )}
          </div>

          {/* The artefact gets the larger half of the hero, because it is the
              thing being bought and its strip has to be readable at a glance.
              On a phone it sits directly under the headline rather than below
              the fold, for the same reason. */}
          <div className="order-first lg:order-none">
            <ProofFrame variant="verified" className="w-full shadow-panel" />
            <p className="mt-3 hidden max-w-[52ch] text-sm leading-6 text-white/45 lg:block">
              Every photograph arrives stamped like this: when it was taken, where, and how accurate the reading was.
            </p>
          </div>
        </div>
      </section>

      {/* THE PROOF — the only question that actually matters to a stranger. */}
      <section className="mx-auto max-w-container px-6 py-16 lg:py-20">
        <h2 className="max-w-[26ch] font-display text-3xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[2.25rem]">
          How would you know it was not staged?
        </h2>
        <p className="mt-5 max-w-[66ch] text-[1.0625rem] leading-8 text-bbb-slate">
          This is the question everybody asks after they have been let down once, and it is the only one worth
          answering properly. Four things are true of every photograph you receive.
        </p>
        <div className="mt-10">
          <ProofAnatomy />
        </div>

        <div className="mt-11 grid gap-7 rounded-3xl bg-bbb-bg p-6 sm:grid-cols-2 sm:p-8">
          <ProofStrip
            variant="verified"
            label="Taken in the app. The time and the coordinates are part of the picture, and we record separately when it reached us."
          />
          <ProofStrip
            variant="uploaded"
            label="Sent from a gallery instead. It still counts as proof, and it still says plainly that it carries no location. You are always told which kind you got."
          />
        </div>
      </section>

      {/* WHAT WE DO — rows, from the database. A catalogue to scan, not six
          identical boxes, and nothing here that the app does not sell. */}
      {services.length > 0 && (
        <section className="border-y border-bbb-border bg-bbb-bg">
          <div className="mx-auto max-w-container px-6 py-16 lg:py-20">
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[2.25rem]">
              What we do
            </h2>
            {anyFixedPrice && (
              <p className="mt-5 max-w-[66ch] text-[1.0625rem] leading-8 text-bbb-slate">
                Where there is a price below, that is the price. Choose it, pay, and we start. No quote to wait for
                and nobody to chase.
              </p>
            )}

            <ul className="mt-10 divide-y divide-bbb-border border-t border-bbb-border">
              {services.map((s) => (
                <li key={s.id} className="grid gap-3 py-7 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-10">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="font-display text-xl font-extrabold tracking-[-0.01em]">{s.name}</h3>
                      {s.payNow && (
                        <span className="rounded-full bg-bbb-soft px-2.5 py-1 text-[11px] font-extrabold text-bbb-dark">
                          pay and start
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-2.5 max-w-[68ch] text-[15px] leading-7 text-bbb-slate">{s.description}</p>
                    )}
                    {s.handlesCash && (
                      <p className="mt-2.5 max-w-[68ch] text-[13px] leading-6 text-bbb-dark">
                        We pay the institution directly and photograph the receipt. Your buddy never holds the cash.
                      </p>
                    )}
                  </div>
                  <p className="font-display text-xl font-extrabold tabular-nums sm:text-right">{s.priceLabel}</p>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm leading-7 text-bbb-slate">
              Prices shown are for Lagos and Abuja. Other states carry a small uplift, shown to you the moment you
              pick your state, before you pay anything.
            </p>
          </div>
        </section>
      )}

      {/* MONTHLY — a different purchase shape, so a different band. */}
      {monthly.length > 0 && (
        <section className="mx-auto max-w-container px-6 py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <h2 className="max-w-[24ch] font-display text-3xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[2.25rem]">
                If it is every month, stop asking every month
              </h2>
              <p className="mt-5 max-w-[60ch] text-[1.0625rem] leading-8 text-bbb-slate">
                Somebody looks in on your mother on the same day each month. The bills get paid. Someone walks the
                land and sends you pictures. One price agreed once, a visit that arranges itself, and nothing to
                request or approve in between.
              </p>
              <p className="mt-5 max-w-[60ch] text-[15px] leading-7 text-bbb-slate">
                You can pause it or stop it yourself, from your own account, without emailing anybody. A month you
                paused is not charged.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-block rounded-xl bg-bbb-strong px-6 py-3.5 text-sm font-bold text-white hover:bg-bbb-dark"
              >
                Set up something monthly
              </Link>
            </div>
            <ul className="space-y-4 self-center">
              {monthly.map((s) => (
                <li key={s.id} className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
                  <h3 className="font-display text-base font-extrabold">{s.name}</h3>
                  <p className="mt-1.5 text-sm leading-7 text-bbb-slate">
                    {s.name.toLowerCase().includes("property")
                      ? "Tenant and caretaker checks, rent followed up, the place walked and photographed."
                      : "A visit, photographs, a written report, and a call with you afterwards. Hospital appointments included."}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* VETTING — genuinely a sequence, so numbering is information here. */}
      <section className="border-y border-bbb-border bg-bbb-charcoal">
        <div className="mx-auto max-w-container px-6 py-16 lg:py-20">
          <h2 className="max-w-[30ch] font-display text-3xl font-extrabold leading-tight tracking-[-0.01em] text-white sm:text-[2.25rem]">
            Before anyone is sent to your family, this happens
          </h2>
          <p className="mt-5 max-w-[66ch] text-[1.0625rem] leading-8 text-white/70">
            In this order, and the approval does not unlock until every step is done.
          </p>
          <ol className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {VETTING_STEPS.slice(0, 6).map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span className="mt-0.5 shrink-0 font-display text-sm font-extrabold tabular-nums text-bbb-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-extrabold leading-6 text-white">{step.title}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-sm leading-7 text-white/60">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/trust" className="mt-12 inline-block text-sm font-bold text-bbb-primary hover:text-white">
            The whole thing, in detail
          </Link>
        </div>
      </section>

      {/* RECOURSE — plain, undecorated, because confidence needs no box. */}
      <section className="mx-auto max-w-container px-6 py-16 lg:py-20">
        <h2 className="max-w-[24ch] font-display text-3xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[2.25rem]">
          And if it goes wrong
        </h2>
        <div className="mt-6 max-w-[68ch] space-y-5 text-[1.0625rem] leading-8 text-bbb-slate">
          <p>
            Your payment sits against your task. It is released to your buddy after the work is done and you have
            accepted what came back, not before.
          </p>
          <p>
            <strong className="text-bbb-charcoal">If the task failed because of us or because of the buddy, you get everything back.</strong>{" "}
            That is not a goodwill gesture decided case by case. It is a rule, it is written into the system, and the
            amount is worked out the same way every time.
          </p>
          <p>
            Before a buddy has been assigned, a cancellation is refunded in full. After that a stated portion covers
            the cost of somebody who has already turned down other work, and you are shown that figure before you
            confirm anything, never afterwards.
          </p>
        </div>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-xl bg-bbb-strong px-6 py-3.5 text-sm font-bold text-white hover:bg-bbb-dark">
            Start a task
          </Link>
          <Link href="/apply" className="rounded-xl border border-bbb-border px-6 py-3.5 text-sm font-bold hover:border-bbb-strong">
            Work with us as a buddy
          </Link>
        </div>
      </section>

      <SiteFooter stateNames={stateNames} />
      <PublicChatWidget />
    </div>
  );
}
