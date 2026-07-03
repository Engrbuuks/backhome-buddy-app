"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadCount } from "@/lib/notifications/actions";

/** A full-width strip that runs across the top of the dashboard content and
 *  PULSATES continuously while there are unread notifications. It polls the
 *  unread count and disappears once everything is read. Clicking it goes to the
 *  notifications page. `href` sets the correct notifications route per role. */
export function NotificationStrip({ href = "/admin/notifications" }: { href?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const c = await getUnreadCount(); if (alive) setCount(c); } catch {}
    };
    load();
    const t = setInterval(load, 12000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!count) return null;

  return (
    <>
      {/* Local keyframes: a soft glow pulse + a light sweeping across the strip. */}
      <style>{`
        @keyframes bbStripPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(7,149,22,0.0); background-color: #eafbe8; }
          50%      { box-shadow: 0 0 22px 2px rgba(7,149,22,0.45); background-color: #d8f5d2; }
        }
        @keyframes bbStripSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-strip-pulse { animation: none !important; }
          .bb-strip-sweep { display: none !important; }
        }
      `}</style>
      <Link
        href={href}
        aria-label={`${count} unread notification${count === 1 ? "" : "s"} — view`}
        className="bb-strip-pulse relative mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-bbb-strong/40 px-4 py-3 text-sm font-bold text-bbb-dark"
        style={{ animation: "bbStripPulse 1.6s ease-in-out infinite" }}
      >
        {/* sweeping light */}
        <span
          className="bb-strip-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/50"
          style={{ animation: "bbStripSweep 2.2s linear infinite" }}
        />
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bbb-strong text-white">
          <Bell className="h-4 w-4" />
        </span>
        <span className="relative">
          You have <span className="text-bbb-strong">{count}</span> new notification{count === 1 ? "" : "s"} — tap to view
        </span>
        <span className="relative ml-auto rounded-full bg-bbb-strong px-2.5 py-0.5 text-xs font-extrabold text-white">{count > 99 ? "99+" : count}</span>
      </Link>
    </>
  );
}
