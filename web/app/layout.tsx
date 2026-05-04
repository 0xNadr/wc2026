import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://wc2026.nader.info"),
  title: {
    default: "WC 2026 Forecaster: Who lifts the trophy?",
    template: "%s · WC 2026 Forecaster",
  },
  description:
    "Bayesian Monte Carlo simulator running 50,000 tournament rollouts on a Dixon Coles model fitted to a century of international results plus EA FC 25 squad strength.",
  openGraph: {
    title: "WC 2026 Forecaster: Who lifts the trophy?",
    description:
      "Per-team champion odds, knockout bracket, scenario explorer and matchup predictor for the 2026 FIFA World Cup.",
    siteName: "WC 2026 Forecaster",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WC 2026 Forecaster",
    description:
      "Bayesian forecast of the 2026 FIFA World Cup. Champion odds, brackets, head to head and scenarios.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        {/* Dark is the default; only strip it when the user has explicitly chosen light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteNav />
        <main className="flex-1 mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8 w-full">{children}</main>
        <Script
          src="https://analytics.nader.info/count.js"
          strategy="afterInteractive"
          data-goatcounter="https://analytics.nader.info/count"
        />
      </body>
    </html>
  );
}
