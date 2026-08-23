import { AdminShell, PageHeader } from "@/components/AdminShell";
import { listTestimonials, listInvites } from "@/lib/testimonials/actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { signProofUrls } from "@/lib/storage/sign";
import TestimonialsAdmin from "./TestimonialsAdmin";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const [pending, approved, invites] = await Promise.all([
    listTestimonials("pending"), listTestimonials("approved"), listInvites(),
  ]);
  // sign any media for preview
  const signMedia = async (rows: any[]) => {
    const withMedia = rows.filter((r) => r.media_url).map((r) => ({ id: r.id, file_url: r.media_url, kind: r.media_kind }));
    const signed = await signProofUrls(withMedia as any[]);
    const map = new Map(signed.map((s: any) => [s.id, s.signedUrl]));
    return rows.map((r) => ({ ...r, media_signed: map.get(r.id) || null }));
  };
  const [pendingS, approvedS] = await Promise.all([signMedia(pending), signMedia(approved)]);

  return (
    <AdminShell title="Testimonials">
      <MarkNotificationsRead link="/admin/testimonials" />
      <PageHeader eyebrow="Reviews" title="Testimonials" description="Generate one-time links for happy clients, then approve what appears on the website." />
      <TestimonialsAdmin pending={pendingS} approved={approvedS} invites={invites} />
    </AdminShell>
  );
}
