"use client";
import React from "react";


export function AuthLayout({
  eyebrow = "Backhome Buddy", title, subtitle, children,
  sideTitle = "Your tasks handled right.",
}: {
  eyebrow?: string; title: string; subtitle?: string;
  children: React.ReactNode; sideTitle?: string;
}) {
  return (
    <main className="h-screen overflow-hidden bg-bbb-bg p-4 font-body text-bbb-charcoal">
      <div className="mx-auto grid h-full max-w-[1180px] overflow-hidden rounded-3xl border border-bbb-border bg-white shadow-panel lg:grid-cols-[1fr_0.9fr]">
        <section className="flex flex-col justify-center overflow-y-auto p-6 sm:p-8 lg:p-10">
          <div className="mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Backhome Buddy" className="h-10 w-auto" />
            <p className="mt-1.5 text-xs text-bbb-slate">Your Tasks Handled Right</p>
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-bbb-strong">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-3 max-w-xl text-sm leading-6 text-bbb-slate">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </section>
        <aside className="relative hidden overflow-hidden lg:block">
          {/* Brand photo (same support agent as the marketing site) */}
          <img
            src="/images/auth-agent.jpg"
            alt="A Backhome Buddy support agent ready to help"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Green gradient wash for text legibility + brand tint */}
          <div className="absolute inset-0 bg-gradient-to-t from-bbb-charcoal/85 via-bbb-charcoal/35 to-bbb-charcoal/10" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <p className="font-display text-3xl font-extrabold leading-tight text-white">{sideTitle}</p>
              <p className="mt-4 text-sm leading-6 text-white/85">A trusted operating system for clients, buddies and admins to manage every errand from request to proof.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {["Proof", "Trust", "Control"].map((i) => (
                <div key={i} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="font-display text-lg font-bold text-white">{i}</p>
                  <p className="text-[11px] text-white/75">Every task</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
