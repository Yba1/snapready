import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

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
    <html lang="en" className={geist.variable}>
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
