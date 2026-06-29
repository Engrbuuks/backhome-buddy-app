import Link from "next/link";
import { PublicChatWidget } from "@/components/PublicChatWidget";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-container flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="Backhome Buddy" className="mx-auto h-12 w-auto" />
        <h1 className="mt-2 font-display text-4xl font-extrabold">Portal</h1>
        <p className="mt-3 max-w-md text-bbb-slate">
          App skeleton. Auth + portals wire in here. The marketing site links to{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-sm">/login</code> and{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-sm">/apply</code>.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/login" className="rounded-xl bg-bbb-strong px-5 py-3 text-sm font-bold text-white hover:bg-bbb-dark">Sign in</Link>
        <Link href="/signup" className="rounded-xl border border-bbb-border bg-white px-5 py-3 text-sm font-bold hover:border-bbb-strong">Client sign up</Link>
        <Link href="/apply" className="rounded-xl border border-bbb-border bg-white px-5 py-3 text-sm font-bold hover:border-bbb-strong">Become a Buddy</Link>
      </div>
          <PublicChatWidget />
    </main>
  );
}
