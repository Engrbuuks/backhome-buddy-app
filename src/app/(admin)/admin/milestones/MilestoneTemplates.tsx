"use client";
import React, { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { saveServiceMilestones } from "@/lib/requests/milestone-actions";

type Svc = { id: string; name: string; milestones: Array<{ id?: string; title: string; hint?: string | null }> };

export default function MilestoneTemplates({ services }: { services: Svc[] }) {
  if (!services.length) return <p className="text-sm text-bbb-slate">No services yet. Add services first, then define their milestone templates here.</p>;
  return (
    <div className="space-y-6">
      {services.map((s) => <ServiceBlock key={s.id} svc={s} />)}
    </div>
  );
}

function ServiceBlock({ svc }: { svc: Svc }) {
  const [rows, setRows] = useState(svc.milestones.length ? svc.milestones.map((m) => ({ title: m.title, hint: m.hint || "" })) : [{ title: "", hint: "" }]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const set = (i: number, k: "title" | "hint", v: string) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const add = () => setRows((r) => [...r, { title: "", hint: "" }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = () => start(async () => {
    setErr(""); setMsg("");
    const res = await saveServiceMilestones(svc.id, rows.filter((r) => r.title.trim()));
    if (res.error) { setErr(res.error); return; }
    setMsg("Saved.");
  });

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <p className="mb-3 font-display text-base font-extrabold">{svc.name}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-bbb-border p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bbb-soft text-xs font-bold text-bbb-dark">{i + 1}</span>
              <input value={r.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Milestone (e.g. Photo of the front gate)" className="h-9 flex-1 rounded-lg border border-bbb-border px-2 text-sm outline-none focus:border-bbb-strong" />
              <button onClick={() => remove(i)} className="text-bbb-slate hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <input value={r.hint} onChange={(e) => set(i, "hint", e.target.value)} placeholder="Hint — what the buddy should capture" className="mt-2 h-8 w-full rounded-lg border border-bbb-border px-2 text-xs outline-none focus:border-bbb-strong" />
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-bbb-strong hover:text-bbb-dark"><Plus className="h-4 w-4" /> Add milestone</button>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-5 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save template
        </button>
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        {err && <span className="text-sm font-semibold text-red-600">{err}</span>}
      </div>
    </div>
  );
}
