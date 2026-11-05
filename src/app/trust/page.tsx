import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/marketing/SiteChrome";
import { ProofFrame } from "@/components/marketing/ProofFrame";
import { getMarketingData, VETTING_STEPS } from "@/lib/marketing/content";
import { PublicChatWidget } from "@/components/PublicChatWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How we vet the people we send | Backhome Buddy",
  description:
    "Every step a buddy passes before they are sent to anybody's family, and the one check we do not claim to do.",
};

/**
 * The page the business most needed and did not have.
 *
 * The vetting here is better than most of this industry and was completely
 * invisible: a stranger abroad could see no company details, no reviews they
 * had not read on our own site, and nothing about what we actually check.
 * Meanwhile the chat widget was claiming "background checks", which is the one
 * thing on this list we do not do.
 *
 * So this page says exactly what happens, in order, and then says plainly what
 * it does not cover. The admission is the reason to believe the rest.
 */
export default async function TrustPage() {
  const { stateNames } = await getMarketingData();

  return (
    <div className="bg-white">
      <SiteHeader />

      <section className="mx-auto max-w-container px-6 pb-14 pt-14 lg:pt-20">
        <h1 className="max-w-[30ch] font-display text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem]">
          You are sending a stranger to your mother's house
        </h1>
        <p className="mt-6 max-w-[66ch] text-[1.0625rem] leading-8 text-bbb-slate">
          That is the actual decision, and no amount of friendly copy should make it feel smaller than it is. Here is
          every step somebody passes before we will send them, written out so you can judge it rather than trust it.
        </p>
      </section>

      <section className="mx-auto max-w-container px-6 pb-20">
        <ol className="divide-y divide-bbb-border border-y border-bbb-border">
          {VETTING_STEPS.map((step, i) => (
            <li key={step.title} className="grid gap-3 py-8 sm:grid-cols-[2.5rem_1fr] sm:gap-8">
              <span className="font-display text-sm font-extrabold tabular-nums text-bbb-strong">{i + 1}</span>
              <div>
                <h2 className="font-display text-lg font-extrabold leading-7 tracking-[-0.01em]">{step.title}</h2>
                <p className="mt-2 max-w-[68ch] text-[15px] leading-7 text-bbb-slate">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The admission. This is the most important block on the page. */}
      <section className="border-y border-bbb-border bg-bbb-bg">
        <div className="mx-auto max-w-container px-6 py-20">
          <h2 className="max-w-[32ch] font-display text-2xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[1.75rem]">
            What we do not claim
          </h2>
          <div className="mt-6 max-w-[68ch] space-y-5 text-[1.0625rem] leading-8 text-bbb-slate">
            <p>
              <strong className="text-bbb-charcoal">We do not run a criminal record check on every buddy.</strong>{" "}
              We collect a Police Character Certificate where somebody already has one, and it is not required. In
              Nigeria that document is slow, inconsistently issued and easy to buy, so requiring it would have
              filtered for patience and money rather than for character, while letting us say a word we had not
              earned.
            </p>
            <p>
              What we rely on instead is harder to fake than a certificate: an identity a bank has already verified
              with fingerprints, two guarantors we can telephone, a signed agreement, a scored interview and a trial
              task done under observation. For work involving a vulnerable person we also meet the buddy in person,
              and for high value work we verify their identity against a government record.
            </p>
            <p>
              If a criminal record check matters to you for a particular task, say so when you describe it. We will
              arrange it, tell you what it costs and how long it will take, and we will not pretend it was already
              done.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-container px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-16">
          <div>
            <h2 className="max-w-[28ch] font-display text-2xl font-extrabold leading-tight tracking-[-0.01em] sm:text-[1.75rem]">
              Vetting is the start. Evidence is the rest
            </h2>
            <div className="mt-6 max-w-[62ch] space-y-5 text-[1.0625rem] leading-8 text-bbb-slate">
              <p>
                Checks tell you who somebody is. They cannot tell you what happened on the day. That is what the
                photographs are for, and why each one carries the time it was taken, the coordinates it was taken at,
                and a separate record of when it reached us that the person holding the phone cannot alter.
              </p>
              <p>
                When a picture comes from a gallery instead of the camera, it says so on your screen, in those words.
                We would rather show you a weaker piece of evidence honestly labelled than a strong looking one you
                cannot check.
              </p>
            </div>
            <Link
              href="/signup"
              className="mt-9 inline-block rounded-xl bg-bbb-strong px-6 py-3.5 text-sm font-bold text-white hover:bg-bbb-dark"
            >
              Start a task
            </Link>
          </div>
          <ProofFrame
            variant="verified"
            label="What arrives when a task is done."
            className="self-start"
          />
        </div>
      </section>

      <section className="border-t border-bbb-border bg-bbb-charcoal">
        <div className="mx-auto max-w-container px-6 py-16">
          <h2 className="max-w-[34ch] font-display text-xl font-extrabold leading-8 text-white sm:text-2xl">
            If you are the person we would be sending, the same standard applies to you
          </h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-white/60">
            Buddies are paid per task, and more as they earn trust. The vetting above is what you would go through.
            It takes a little while and it is the reason clients let us into their families' homes.
          </p>
          <Link
            href="/apply"
            className="mt-7 inline-block rounded-xl border border-white/20 px-6 py-3.5 text-sm font-bold text-white hover:border-white/50"
          >
            Apply to be a buddy
          </Link>
        </div>
      </section>

      <SiteFooter stateNames={stateNames} />
      <PublicChatWidget />
    </div>
  );
}
