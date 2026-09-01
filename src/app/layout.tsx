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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.querySelectorAll('[bis_skin_checked],[bis_register],[__processed_*]').forEach(function(el){el.removeAttribute('bis_skin_checked');el.removeAttribute('bis_register');for(var k of Object.keys(el.attributes))if(k.startsWith('__processed_'))el.removeAttribute(k)});}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-zinc-50 antialiased">
        {children}
      </body>
    </html>
  );
}
