"use client";
import React, { useEffect, useState, useRef } from "react";
import { getUnreadCount } from "@/lib/notifications/actions";

/** A pulsing, animated badge showing the unread notification count. Polls every
 *  15s. When the count increases, it briefly plays a stronger "ping" animation
 *  so a new notification is conspicuous. Rendered inside the Notifications nav
 *  item across all dashboards. */
export function NotificationBadge() {
  const [count, setCount] = useState<number>(0);
  const [ping, setPing] = useState(false);
  const prev = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const c = await getUnreadCount();
        if (!alive) return;
        if (c > prev.current) {
          setPing(true);
          setTimeout(() => setPing(false), 2600);
        }
        prev.current = c;
        setCount(c);
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!count) return null;

  return (
    <span className="relative ml-auto inline-flex h-5 min-w-[20px] items-center justify-center">
      {/* expanding ping ring — animates continuously while unread, stronger on new */}
      <span className={`absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 ${ping ? "animate-ping" : "animate-ping [animation-duration:2.4s]"}`} />
      <span className="relative inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-extrabold text-white shadow">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}
