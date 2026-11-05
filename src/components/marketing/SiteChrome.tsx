import Link from "next/link";
import { POLICY } from "@/lib/marketing/content";

/**
 * Header and footer for the public pages.
 *
 * Left aligned, quiet, and deliberately not centred: the pages read as a
 * dossier rather than a brochure, and centred marketing copy is the default
 * that makes every such page look like every other.
 */

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const text = dark ? "text-white/80" : "text-bbb-slate";
  const hover = dark ? "hover:text-white" : "hover:text-bbb-charcoal";
  return (
    <header className={dark ? "bg-bbb-charcoal" : "border-b border-bbb-border bg-white"}>
      <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-5 py-4 sm:gap-6 sm:px-6 sm:py-5">
        {/* shrink-0: without it the flex row squeezes the logo and clips the
            wordmark on a narrow screen, which it was doing on a phone. */}
        <Link href="/" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dark ? "/images/logo-white.png" : "/images/logo.png"}
            alt="Backhome Buddy"
            className="h-7 w-auto max-w-[150px] object-contain object-left sm:h-8 sm:max-w-[190px]"
          />
        </Link>
        <nav className={`hidden items-center gap-7 text-sm font-semibold sm:flex ${text}`}>
          <Link href="/services" className={hover}>What we do</Link>
          <Link href="/trust" className={hover}>How we vet</Link>
          <Link href="/apply" className={hover}>Become a buddy</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={`hidden rounded-xl px-4 py-2.5 text-sm font-bold sm:block ${dark ? "text-white/80 hover:text-white" : "text-bbb-slate hover:text-bbb-charcoal"}`}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark"
            prefetch={false}
          >
            Start a task
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ stateNames = [] }: { stateNames?: string[] }) {
  return (
    <footer className="border-t border-bbb-border bg-white">
      <div className="mx-auto max-w-container px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Backhome Buddy" className="h-8 w-auto" />
            <p className="mt-4 max-w-sm text-sm leading-7 text-bbb-slate">
              Things done in Nigeria for people who are not in Nigeria, with evidence you can check and a refund
              policy written down before you pay.
            </p>
            {stateNames.length > 0 && (
              <p className="mt-4 text-xs leading-6 text-bbb-slate">
                Working in {stateNames.join(", ")}.
              </p>
            )}
          </div>

          <div className="text-sm">
            <p className="font-display font-extrabold text-bbb-charcoal">Pages</p>
            <ul className="mt-3 space-y-2 text-bbb-slate">
              <li><Link href="/services" className="hover:text-bbb-charcoal">What we do</Link></li>
              <li><Link href="/trust" className="hover:text-bbb-charcoal">How we vet buddies</Link></li>
              <li><Link href="/signup" className="hover:text-bbb-charcoal">Start a task</Link></li>
              <li><Link href="/apply" className="hover:text-bbb-charcoal">Become a buddy</Link></li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="font-display font-extrabold text-bbb-charcoal">Get in touch</p>
            <ul className="mt-3 space-y-2 text-bbb-slate">
              <li><a href="mailto:hello@backhomebuddy.ng" className="hover:text-bbb-charcoal">hello@backhomebuddy.ng</a></li>
              <li><a href={POLICY.privacy} className="hover:text-bbb-charcoal">Privacy policy</a></li>
              <li><a href={POLICY.terms} className="hover:text-bbb-charcoal">Terms of service</a></li>
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-bbb-border pt-6 text-xs text-bbb-slate">
          Backhome Buddy holds your payment against your task and releases it to your buddy only after the work is
          done and you have accepted the proof. It is not a bank and not a regulated escrow service.
        </p>
      </div>
    </footer>
  );
}
