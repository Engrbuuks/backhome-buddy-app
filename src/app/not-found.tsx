import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bbb-bg px-6 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-wide text-bbb-strong">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-bbb-slate">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Link href="/" className="mt-6 rounded-xl bg-bbb-strong px-5 py-3 text-sm font-bold text-white hover:bg-bbb-dark">Go home</Link>
    </main>
  );
}
