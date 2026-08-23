"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDate } from "@/components/money";
import { markAllRead, markRead } from "@/lib/notifications/actions";

export function NotificationList({ items }: { items: any[] }) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<any[]>(items);
  const router = useRouter();
  const unread = rows.filter((n) => !n.read).length;

  const openItem = (n: any) => {
    // Mark this one read immediately in the UI (drops the count), persist, then navigate.
    if (!n.read) {
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
      markRead(n.id).then(() => router.refresh());
    }
    if (n.link) router.push(n.link);
  };

  const readAll = () => start(async () => {
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    await markAllRead();
    router.refresh();
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Notifications</h1>
          <p className="mt-1 text-sm text-bbb-slate">{unread ? `${unread} unread` : "All caught up"}</p>
        </div>
        {unread > 0 && (
          <button disabled={pending} onClick={readAll} className="flex items-center gap-2 rounded-xl border border-bbb-border px-3 py-2 text-xs font-bold text-bbb-slate hover:border-bbb-strong hover:text-bbb-charcoal disabled:opacity-50">
            <CheckCheck className="h-3.5 w-3.5" />Mark all read
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center">
          <Bell className="h-8 w-8 text-bbb-slate" />
          <p className="mt-3 text-sm text-bbb-slate">Nothing yet — updates about your requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className={`block w-full text-left rounded-2xl border p-4 shadow-soft transition hover:border-bbb-strong ${n.read ? "border-bbb-border bg-white" : "border-bbb-strong/30 bg-bbb-soft/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold">{n.title}</p>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-bbb-strong" />}
              </div>
              {n.body && <p className="mt-1 text-sm text-bbb-slate">{n.body}</p>}
              <p className="mt-2 text-[11px] text-bbb-slate">{formatDate(n.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
