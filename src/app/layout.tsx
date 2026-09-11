import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/navigation/Header";
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
  title: "HeatPulse — India Extreme Heatwave Early Warning & Human Thermal Stress Index",
  description:
    "SIH26083: Extreme Heatwave Early Warning and Human Thermal Stress Index for Ministry of Earth Sciences / NCMRWF across 849 municipal wards in 6 Indian cities.",
  authors: [{ name: "HeatPulse Team (SIH26083)" }],
  keywords: [
    "heatwave",
    "thermal stress",
    "WBGT",
    "Heat Index",
    "UTCI",
    "MoES",
    "NCMRWF",
    "SIH26083",
    "early warning",
    "Bengaluru",
    "Pune",
    "Mumbai",
    "Kolkata",
    "Chennai",
    "Coimbatore",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-zinc-50 antialiased flex flex-col font-sans">
        {/* Strip browser-extension injected attributes before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.querySelectorAll('[bis_skin_checked],[bis_register],[__processed_*]').forEach(function(e){e.removeAttribute('bis_skin_checked');e.removeAttribute('bis_register');for(var i=e.attributes.length-1;i>=0;i--){var n=e.attributes[i].name;if(n.indexOf('__processed_')===0)e.removeAttribute(n)}})}catch(x){}})()`,
          }}
        />
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
