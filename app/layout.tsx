import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "SnapReady — Depop photos that actually sell",
  description: "Remove the background from your Depop photos in seconds. Free, no account needed.",
  openGraph: {
    title: "SnapReady — Depop photos that actually sell",
    description: "Remove the background from your Depop photos in seconds. Free, no account needed.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <div className="bg-stage">
          <div className="bg-mesh" />
          <div className="bg-orb o1" />
          <div className="bg-orb o2" />
          <div className="bg-orb o3" />
          <div className="bg-noise" />
          <div className="bg-vignette" />
        </div>
        <div id="snap-root">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
