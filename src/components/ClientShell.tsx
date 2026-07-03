"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, LifeBuoy, LogOut, Menu, PlusCircle, Settings, UsersRound } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

import { NotificationBadge } from "@/components/NotificationBadge";

const NAV = [
  { label: "Dashboard", href: "/client/dashboard", icon: Home },
  { label: "New Request", href: "/client/requests/new", icon: PlusCircle },
  { label: "Recipients", href: "/client/recipients", icon: UsersRound },
  { label: "Notifications", href: "/client/notifications", icon: Bell },
  { label: "Support", href: "/client/support", icon: LifeBuoy },
  { label: "Profile", href: "/client/profile", icon: Settings },
];

export function ClientShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 flex-col justify-center border-b border-bbb-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="Backhome Buddy" className="h-8 w-auto self-start" />
        <p className="mt-0.5 text-[11px] font-medium text-bbb-slate">Client Portal</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-bbb-soft text-bbb-dark" : "text-bbb-slate hover:bg-white hover:text-bbb-charcoal"}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>{label === "Notifications" && <NotificationBadge />}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-bbb-border p-3">
        <form action={signOut}>
          <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-bbb-slate hover:bg-white hover:text-red-600">
            <LogOut className="h-4 w-4" /><span>Logout</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bbb-bg font-body text-bbb-charcoal">
      <div className="mx-auto flex max-w-[1280px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-bbb-border bg-white lg:block">{sidebar}</aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-panel">{sidebar}</div>
          </div>
        )}
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-bbb-border bg-white"><Menu className="h-5 w-5" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Backhome Buddy" className="h-7 w-auto" />
            <span className="w-10" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
