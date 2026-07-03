import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { HOME_FOR } from "@/lib/auth/actions";
import { PublicChatWidget } from "@/components/PublicChatWidget";

/** Root landing. Also the destination for email-confirmation links, which arrive
 *  with a ?code=. We exchange that code for a session and send the user straight
 *  to their dashboard — they never see this page after confirming. */
export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = params?.code;

  if (code) {
    const supabase = createClient();
    try { await supabase.auth.exchangeCodeForSession(code); } catch {}
    const profile = await getCurrentProfile();
    if (profile) redirect(HOME_FOR[(profile.role as keyof typeof HOME_FOR)] ?? "/client/dashboard");
    // Code present but session couldn't be established — send to login cleanly.
    redirect("/login?confirmed=1");
  }

  // Already signed in → go to the right dashboard, don't show this page.
  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_FOR[(profile.role as keyof typeof HOME_FOR)] ?? "/client/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-container flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="Backhome Buddy" className="mx-auto h-12 w-auto" />
        <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">Welcome to Backhome Buddy</h1>
        <p className="mt-3 max-w-md text-bbb-slate">
          Sign in to your account, or create one to get things done back home — with real photo and video proof.
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
