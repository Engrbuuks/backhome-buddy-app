"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import {
  LayoutDashboard, Inbox, UserCheck, ShieldCheck, Wallet, RotateCcw,
  AlertTriangle, Users, Package, MapPin, Receipt, Bell, UserCog, MessageSquare, HardDriveDownload, UserPlus,
LogOut, Menu, X, BookOpen,
} from "lucide-react";

import { NotificationBadge } from "@/components/NotificationBadge";
import { NotificationStrip } from "@/components/NotificationStrip";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Requests Queue", icon: Inbox },
  { href: "/admin/assignment", label: "Assignment", icon: UserCheck },
  { href: "/admin/proofs", label: "Proof Review", icon: ShieldCheck },
  { href: "/admin/payouts", label: "Payouts Queue", icon: Wallet },
  { href: "/admin/refunds", label: "Refunds & Cancellations", icon: RotateCcw },
  { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/admin/buddies", label: "Buddy Management", icon: Users },
  { href: "/admin/clients", label: "Clients", icon: UserCog },
  { href: "/admin/recruitment", label: "Recruitment", icon: UserPlus },
  { href: "/admin/services", label: "Service Pricing", icon: Package },
  { href: "/admin/milestones", label: "Milestone Templates", icon: Package },
  { href: "/admin/regions", label: "Regions", icon: MapPin },
  { href: "/admin/ledger", label: "Ledger", icon: Receipt },
  { href: "/admin/fx", label: "Currency & Banking", icon: Receipt },
  { href: "/admin/chats", label: "Support Chats", icon: MessageSquare },
  { href: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/templates", label: "Email Settings", icon: Bell },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/backup", label: "Backup", icon: HardDriveDownload },
];

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  return (
    <div className="min-h-screen bg-bbb-bg">
      <div className="mx-auto flex max-w-[1280px] gap-6 p-4">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col rounded-3xl border border-bbb-border bg-white p-3 shadow-soft">
            <div className="mb-3 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="Backhome Buddy" className="h-8 w-auto" />
              <p className="mt-1 text-xs text-bbb-slate">Ops Admin</p>
            </div>
            <nav className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} prefetch
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-bbb-strong text-white" : "text-bbb-slate hover:bg-bbb-bg hover:text-bbb-charcoal"}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                    {href === "/admin/notifications" && <NotificationBadge />}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-2 shrink-0 border-t border-bbb-border pt-2">
              <form action={signOut}>
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-bbb-slate transition hover:bg-bbb-bg hover:text-red-600">
                  <LogOut className="h-4 w-4 shrink-0" /><span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Backhome Buddy" className="h-7 w-auto" />
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-bbb-charcoal px-3 py-1 text-xs font-bold text-white">Admin</span>
              <form action={signOut}>
                <button aria-label="Logout" className="grid h-8 w-8 place-items-center rounded-full border border-bbb-border text-bbb-slate hover:text-red-600">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
              <button aria-label="Menu" onClick={() => setNavOpen((v) => !v)} className="grid h-8 w-8 place-items-center rounded-full border border-bbb-border text-bbb-charcoal">
                {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {navOpen && (
            <nav className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-bbb-border bg-white p-2 shadow-soft lg:hidden">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} prefetch onClick={() => setNavOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${active ? "bg-bbb-strong text-white" : "text-bbb-slate hover:bg-bbb-bg"}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
          <h1 className="sr-only">{title}</h1>
          <NotificationStrip href="/admin/notifications" />
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actionLabel, onAction }: {
  eyebrow?: string; title: string; description?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:items-end sm:text-left">
      <div>
        {eyebrow && <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-strong">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-bbb-charcoal">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-bbb-slate">{description}</p>}
      </div>
      {actionLabel && (
        <button onClick={onAction} className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
