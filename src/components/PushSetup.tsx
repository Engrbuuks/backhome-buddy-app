"use client";
import React, { useEffect, useState } from "react";
import { getPushPublicKey, savePushSubscription, sendTestPush } from "@/lib/notifications/push-actions";

/**
 * Turns the site into something that can reach a phone.
 *
 * Used by all three roles. A buddy misses paid work without it; an admin
 * misses a refund request or a dispute sitting in a queue; a client misses
 * the moment their proof arrives. The wording changes per role, the mechanism
 * does not.
 *
 * Two steps, and they are separate on purpose. Installing to the home screen is
 * what makes notifications possible at all on iOS, and makes them reliable on
 * Android. Granting permission is what makes them actually arrive.
 *
 * The prompt is deliberately quiet once everything is on: a buddy who has
 * already set it up should see a single confirming line, not a banner nagging
 * them forever.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  // VAPID keys arrive base64url encoded; PushManager wants raw bytes.
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSetup({
  heading = "Do not miss a task",
  blurb = "Tasks are offered to one buddy at a time, with a short window to accept. Set this up once and your phone will alert you even when the app is closed.",
  onLabel = "Task alerts are on for this phone.",
  unsupported = "This browser cannot show task alerts. Open Backhome Buddy in Chrome on your phone so you do not miss offers.",
}: {
  heading?: string;
  blurb?: string;
  onLabel?: string;
  unsupported?: string;
} = {}) {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    // Already running as an installed app?
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true,
    );
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Chrome fires this when the app is installable; holding it lets us show
    // our own button instead of relying on a hidden browser menu item.
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function enable() {
    setBusy(true); setError(""); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notifications were not allowed. You can turn them on in your browser settings for this site.");
        return;
      }
      const key = await getPushPublicKey();
      if (!key) { setError("Push is not configured on the server yet."); return; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
      }
      const json = sub.toJSON() as any;
      const r = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      if (r.error) { setError(r.error); return; }
      setMsg("Notifications are on for this device.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true); setError(""); setMsg("");
    const r = await sendTestPush();
    if (r.error) setError(r.error); else setMsg("Test sent — check your phone.");
    setBusy(false);
  }

  if (!supported) {
    return (
      <div className="mb-6 rounded-3xl border border-bbb-border bg-white p-5 text-sm text-bbb-slate shadow-soft">
        {unsupported}
      </div>
    );
  }

  const allSet = permission === "granted";

  // Quiet confirming line once everything is working.
  if (allSet && installed) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm font-semibold text-green-800">{onLabel}</p>
        <button type="button" onClick={test} disabled={busy}
          className="text-xs font-bold text-green-800 underline disabled:opacity-50">
          Send me a test
        </button>
        {(msg || error) && <p className={`w-full text-xs font-semibold ${error ? "text-red-600" : "text-green-800"}`}>{error || msg}</p>}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-3xl border-2 border-bbb-strong/30 bg-white p-5 shadow-soft">
      <h2 className="font-display text-base font-extrabold">{heading}</h2>
      <p className="mt-1 text-sm text-bbb-slate">{blurb}</p>

      <ol className="mt-4 space-y-3">
        <li className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${installed ? "bg-green-100 text-green-700" : "bg-bbb-bg text-bbb-slate"}`}>
            {installed ? "✓" : "1"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bbb-charcoal">Add Backhome Buddy to your home screen</p>
            {installed ? (
              <p className="text-xs text-green-700">Done.</p>
            ) : isIOS ? (
              <p className="text-xs text-bbb-slate">
                Tap the Share button, then <strong>Add to Home Screen</strong>. On iPhone this step is required before alerts can work.
              </p>
            ) : installEvent ? (
              <button
                type="button"
                onClick={async () => { installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); }}
                className="mt-1.5 h-10 rounded-xl bg-bbb-charcoal px-4 text-xs font-bold text-white hover:opacity-90"
              >
                Add to home screen
              </button>
            ) : (
              <p className="text-xs text-bbb-slate">
                Open your browser menu and choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.
              </p>
            )}
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${allSet ? "bg-green-100 text-green-700" : "bg-bbb-bg text-bbb-slate"}`}>
            {allSet ? "✓" : "2"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bbb-charcoal">Allow notifications</p>
            {allSet ? (
              <p className="text-xs text-green-700">Done. <button type="button" onClick={test} disabled={busy} className="font-bold underline disabled:opacity-50">Send a test</button></p>
            ) : permission === "denied" ? (
              <p className="text-xs text-amber-700">
                Blocked for this site. Open your browser settings for backhomebuddy.ng and allow notifications, then come back.
              </p>
            ) : (
              <button type="button" onClick={enable} disabled={busy}
                className="mt-1.5 h-10 rounded-xl bg-bbb-strong px-4 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
                {busy ? "Setting up…" : "Turn on alerts"}
              </button>
            )}
          </div>
        </li>
      </ol>

      {(msg || error) && (
        <p className={`mt-3 text-xs font-semibold ${error ? "text-red-600" : "text-green-700"}`}>{error || msg}</p>
      )}
    </div>
  );
}
