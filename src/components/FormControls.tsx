"use client";
import React from "react";
import type { LucideIcon } from "lucide-react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; icon?: LucideIcon; error?: string; className?: string;
};
export function Field({ label, icon: Icon, error, className = "", ...props }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />}
        <input {...props} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:border-bbb-strong focus:ring-4 focus:ring-bbb-primary/10 ${Icon ? "pl-10" : ""} ${error ? "border-red-300" : "border-bbb-border"}`} />
      </div>
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string; icon?: LucideIcon; error?: string; className?: string; children: React.ReactNode;
};
export function SelectField({ label, icon: Icon, children, error, className = "", ...props }: SelectProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">{label}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />}
        <select {...props} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:border-bbb-strong focus:ring-4 focus:ring-bbb-primary/10 ${Icon ? "pl-10" : ""} ${error ? "border-red-300" : "border-bbb-border"}`}>{children}</select>
      </div>
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string; error?: string; className?: string;
};
export function TextAreaField({ label, error, className = "", ...props }: TextAreaProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">{label}</span>
      <textarea {...props} className={`min-h-[120px] w-full resize-none rounded-xl border bg-white px-3 py-3 text-sm outline-none transition focus:border-bbb-strong focus:ring-4 focus:ring-bbb-primary/10 ${error ? "border-red-300" : "border-bbb-border"}`} />
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-2xl border border-bbb-border bg-white p-4 text-left">
      <span>
        <span className="block text-sm font-bold text-bbb-charcoal">{label}</span>
        {description && <span className="mt-1 block text-xs text-bbb-slate">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-bbb-strong" : "bg-gray-200"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
