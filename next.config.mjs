/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/((?!widget/chat).*)", headers: securityHeaders },
      {
        source: "/widget/chat",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://backhomebuddy.ng https://www.backhomebuddy.ng" },
        ],
      },
    ];
  },
};
export default nextConfig;
