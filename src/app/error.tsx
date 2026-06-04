"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bbb-bg px-6 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-wide text-red-600">Something went wrong</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">An unexpected error occurred</h1>
      <p className="mt-2 max-w-md text-sm text-bbb-slate">Try again — if it keeps happening, contact support.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-bbb-strong px-5 py-3 text-sm font-bold text-white hover:bg-bbb-dark">Try again</button>
    </main>
  );
}
