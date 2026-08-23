import { getInviteByToken } from "@/lib/testimonials/actions";
import TestimonialForm from "./TestimonialForm";

export const dynamic = "force-dynamic";

export default async function TestimonialPage({ params }: { params: { token: string } }) {
  const invite = await getInviteByToken(params.token);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-extrabold text-bbb-strong">Backhome Buddy</h1>
        <p className="mt-1 text-sm text-bbb-slate">Share your experience</p>
      </div>
      {!invite ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-bold text-red-800">This link is invalid</p>
          <p className="mt-1 text-sm text-red-700">Please check the link, or ask us for a new one.</p>
        </div>
      ) : invite.used ? (
        <div className="rounded-2xl border border-bbb-border bg-white p-6 text-center shadow-soft">
          <p className="font-bold text-bbb-charcoal">This link has already been used</p>
          <p className="mt-1 text-sm text-bbb-slate">Thank you — your testimonial has been received.</p>
        </div>
      ) : (
        <TestimonialForm token={params.token} inviteeName={invite.invitee_name} />
      )}
    </main>
  );
}
