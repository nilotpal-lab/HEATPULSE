import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HeatPulse — Pune Heatwave Early Warning System",
  description: "SIH26083: Extreme Heatwave Early Warning and Human Thermal Stress Index for Pune, Maharashtra. MoES/NCMRWF.",
  authors: [{ name: "HeatPulse Team" }],
  keywords: ["heatwave", "heat stress", "Pune", "early warning", "SIH", "disaster management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-zinc-50 antialiased">
        {children}
      </body>
    </html>
  );
}
