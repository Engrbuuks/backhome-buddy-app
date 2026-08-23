import Link from "next/link";

/** Reusable server-rendered pager. Links to ?page=N (preserving other params).
 *  Shows Prev / page numbers / Next. Hidden when there's only one page. */
export function Pager({ page, pageSize, total, basePath, params }: {
  page: number; pageSize: number; total: number; basePath: string; params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) if (v && k !== "page") sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  // Window of page numbers around the current page.
  const nums: number[] = [];
  const from = Math.max(1, page - 2), to = Math.min(pages, page + 2);
  for (let i = from; i <= to; i++) nums.push(i);

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-bbb-slate">Showing {start}–{end} of {total}</p>
      <nav className="flex items-center gap-1">
        <PagerLink disabled={page <= 1} href={href(page - 1)}>Prev</PagerLink>
        {from > 1 && <><PagerLink href={href(1)}>1</PagerLink>{from > 2 && <span className="px-1 text-bbb-slate">…</span>}</>}
        {nums.map((n) => (
          <PagerLink key={n} href={href(n)} active={n === page}>{String(n)}</PagerLink>
        ))}
        {to < pages && <>{to < pages - 1 && <span className="px-1 text-bbb-slate">…</span>}<PagerLink href={href(pages)}>{String(pages)}</PagerLink></>}
        <PagerLink disabled={page >= pages} href={href(page + 1)}>Next</PagerLink>
      </nav>
    </div>
  );
}

function PagerLink({ href, children, active, disabled }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  const cls = `min-w-[2rem] rounded-lg px-2.5 py-1.5 text-center text-xs font-bold ${active ? "bg-bbb-strong text-white" : "border border-bbb-border text-bbb-slate hover:border-bbb-strong"}`;
  if (disabled) return <span className={`${cls} cursor-not-allowed opacity-40`}>{children}</span>;
  return <Link href={href} className={cls}>{children}</Link>;
}
