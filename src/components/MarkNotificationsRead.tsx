"use client";
import { useEffect, useRef } from "react";
import { markReadByLink } from "@/lib/notifications/actions";

/** Drop this on any item page (request, proof, dispute, etc). When the page
 *  opens, it marks read any of the user's notifications pointing to this path,
 *  so the notification tab/count stays in sync when an item is handled here.
 *  Also fires a "notifications:changed" event so the badge refreshes at once. */
export default function MarkNotificationsRead({ link }: { link: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !link) return;
    done.current = true;
    markReadByLink(link)
      .then(() => { try { window.dispatchEvent(new Event("notifications:changed")); } catch {} })
      .catch(() => {});
  }, [link]);
  return null;
}
