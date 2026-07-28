/** Main diaspora locations for Backhome Buddy, with flag emoji. Clients pick
 *  from this list when leaving a testimonial, so we get a clean country + flag. */
export const DIASPORA_LOCATIONS: Array<{ code: string; label: string; flag: string }> = [
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "IE", label: "Ireland", flag: "🇮🇪" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "AE", label: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", label: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "NG", label: "Nigeria", flag: "🇳🇬" },
];

export function locationByCode(code?: string | null) {
  if (!code) return null;
  return DIASPORA_LOCATIONS.find((l) => l.code === code) || null;
}
