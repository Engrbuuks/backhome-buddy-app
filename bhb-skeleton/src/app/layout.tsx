import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: "Backhome Buddy",
  description: "Get things done back home — concierge tasks across Nigeria.",
  // Makes the site installable to a phone home screen. Once installed it can
  // raise a notification while closed, which is the only way a time boxed task
  // offer reaches a buddy who is not currently looking at the site.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Backhome Buddy",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#33CB2B",
  width: "device-width",
  initialScale: 1,
  // Installed apps should feel native, but never at the cost of a buddy being
  // able to zoom into a document or a proof photo.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-bbb-bg font-body text-bbb-charcoal antialiased">{children}</body>
    </html>
  );
}
