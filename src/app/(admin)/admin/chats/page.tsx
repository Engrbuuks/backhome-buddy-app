import Link from "next/link";
import { listThreadsForAdmin } from "@/lib/support/actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { formatDate } from "@/components/money";

export default async function ChatsPage() {
  const threads = await listThreadsForAdmin();
  return (
    <AdminShell title="Support Chats">
      <PageHeader eyebrow="Support" title="Support Chats" description="Client conversations with the AI assistant. Open one to read and reply as the team." />
      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No chats yet.</div>
      ) : (
        <div className="space-y-3">
          {threads.map((t: any) => (
            <Link key={t.id} href={`/admin/chats/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft hover:border-bbb-strong">
              <div className="min-w-0">
                <p className="font-semibold">{t.user_name}</p>
                <p className="truncate text-xs text-bbb-slate">{t.last_sender === "user" ? "Client: " : t.last_sender === "staff" ? "Team: " : "AI: "}{t.preview}</p>
              </div>
              <span className="text-xs text-bbb-slate">{formatDate(t.last_message_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
