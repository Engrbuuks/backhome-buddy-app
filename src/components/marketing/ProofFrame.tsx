/**
 * The artefact this business actually produces.
 *
 * Not a photograph of a client's family home, which would be theirs and not
 * ours to publish, but the frame the app puts around one: the verification
 * strip with the time, the coordinates and whether the picture was taken live
 * or uploaded from a gallery.
 *
 * It is the hero of the site because it is the thing being bought. A client
 * does not pay for an errand, which a relative would run for nothing. They pay
 * for evidence, and this is what the evidence looks like.
 *
 * Both variants are drawn, including the unverified one. Showing the case
 * where there is no location is what makes the verified case believable: a
 * site that only ever shows its best outcome is making a claim, and a site
 * that labels its worst one is making a promise.
 */

type Variant = "verified" | "uploaded";

/**
 * Just the stamp, without the picture under it.
 *
 * Used where the point is the DIFFERENCE between the two labels rather than
 * the photograph. Repeating the same illustration three times down one page
 * taught the reader nothing the second and third time; two strips side by side
 * put the actual comparison where the eye already is.
 */
export function ProofStrip({ variant, label }: { variant: Variant; label: string }) {
  const verified = variant === "verified";
  return (
    <figure>
      <div
        className="flex items-center gap-3 rounded-2xl bg-[#111113] px-5 py-4"
        style={{ borderLeft: `5px solid ${verified ? "#079516" : "#B45309"}` }}
      >
        <span
          className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white"
          style={{ background: verified ? "#079516" : "#B45309" }}
          aria-hidden
        >
          {verified ? "\u2713" : "!"}
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold text-white">
            {verified ? "Verified capture" : "Uploaded from gallery"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-white/55 tabular-nums">
            {verified
              ? "14 Oct 2026, 11:42 WAT · 7.3775, 3.9470 · accurate to 8 m"
              : "No location captured · received by us 14 Oct 2026, 19:05 WAT"}
          </p>
        </div>
      </div>
      <figcaption className="mt-3 max-w-[46ch] text-sm leading-6 text-bbb-slate">{label}</figcaption>
    </figure>
  );
}

export function ProofFrame({
  variant = "verified",
  className = "",
  label,
}: {
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  const verified = variant === "verified";
  const strip = verified ? "#079516" : "#B45309";

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 440 340"
        role="img"
        aria-label={
          verified
            ? "A proof photograph stamped with the time it was taken and the coordinates where it was taken"
            : "A proof photograph uploaded from a phone gallery, labelled as carrying no location"
        }
        className="h-auto w-full rounded-2xl"
      >
        {/* The picture itself, abstracted: a gate and a wall, the commonest
            thing a buddy is asked to photograph. Muted on purpose — the strip
            below is the point, not the scenery. */}
        <defs>
          <clipPath id={`frame-${variant}`}>
            <rect x="0" y="0" width="440" height="340" rx="16" />
          </clipPath>
        </defs>

        <g clipPath={`url(#frame-${variant})`}>
          <rect x="0" y="0" width="440" height="340" fill="#2B2B2E" />
          {/* sky */}
          <rect x="0" y="0" width="440" height="150" fill="#3A3A3F" />
          {/* ground */}
          <rect x="0" y="212" width="440" height="128" fill="#232326" />
          {/* wall */}
          <rect x="24" y="118" width="392" height="96" fill="#44444A" />
          {/* gate */}
          <rect x="150" y="128" width="140" height="86" fill="#2E2E33" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={160 + i * 26} y="136" width="6" height="70" fill="#52525A" />
          ))}
          {/* pillars */}
          <rect x="128" y="110" width="18" height="104" fill="#55555C" />
          <rect x="294" y="110" width="18" height="104" fill="#55555C" />
          {/* a tree, because every Nigerian compound has one */}
          <rect x="372" y="150" width="7" height="64" fill="#3F3F45" />
          <circle cx="375" cy="140" r="26" fill="#35353A" />

          {/* THE STRIP. This is the whole reason the picture exists. */}
          <rect x="0" y="262" width="440" height="78" fill="rgba(17,17,19,0.86)" />
          <rect x="0" y="262" width="5" height="78" fill={strip} />

          {verified ? (
            <>
              <circle cx="32" cy="288" r="9" fill={strip} />
              <path d="M27.5 288.5l3.2 3.2 6-6.4" stroke="#fff" strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x="50" y="292" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="var(--font-sora), sans-serif">
                Verified capture
              </text>
              <text x="50" y="313" fill="#B9B9BE" fontSize="11.5" fontFamily="var(--font-inter), sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
                14 Oct 2026, 11:42 WAT · 7.3775, 3.9470 · accurate to 8 m
              </text>
            </>
          ) : (
            <>
              <circle cx="32" cy="288" r="9" fill={strip} />
              <text x="29" y="293" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-sora), sans-serif">!</text>
              <text x="50" y="292" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="var(--font-sora), sans-serif">
                Uploaded from gallery
              </text>
              <text x="50" y="313" fill="#B9B9BE" fontSize="11.5" fontFamily="var(--font-inter), sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
                No location captured · received by us 14 Oct 2026, 19:05 WAT
              </text>
            </>
          )}
        </g>
      </svg>
      {label && <figcaption className="mt-3 text-sm leading-6 text-bbb-slate">{label}</figcaption>}
    </figure>
  );
}

/**
 * The same frame, pulled apart and annotated.
 *
 * On the page this answers the only question that matters to somebody abroad:
 * how would I know this was not staged? Each line names a specific defence,
 * and the last one is the one nobody else offers.
 */
export function ProofAnatomy() {
  const rows: { term: string; def: string }[] = [
    {
      term: "Taken in the app, not uploaded to it",
      def: "The camera opens inside Backhome Buddy. A picture taken that way carries the moment and the place it was taken, and is labelled as live capture.",
    },
    {
      term: "Coordinates, not a place name",
      def: "Latitude and longitude with an accuracy reading, so you can put it on a map yourself rather than take our word for where it was.",
    },
    {
      term: "Two clocks, one of them ours",
      def: "The phone's time and, separately, the time our server received the file. A phone clock can be changed. Ours cannot be changed by whoever took the photograph.",
    },
    {
      term: "A visible label when there is no location",
      def: "If the picture came from a gallery instead, it says so, in those words, on your screen. You are never shown an unverified photograph dressed as a verified one.",
    },
  ];

  return (
    <dl className="divide-y divide-bbb-border">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-1.5 py-5 sm:grid-cols-[minmax(0,19rem)_1fr] sm:gap-10">
          <dt className="font-display text-[15px] font-extrabold leading-6 text-bbb-charcoal">{r.term}</dt>
          <dd className="max-w-[62ch] text-[15px] leading-7 text-bbb-slate">{r.def}</dd>
        </div>
      ))}
    </dl>
  );
}
