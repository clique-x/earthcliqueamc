import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Manrope is the brand's web typeface (Brand Book p.15).
const manrope = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "EarthClique AMC", template: "%s · EarthClique AMC" },
  description: "On-demand IT, network and CCTV support for businesses — a verified engineer at your door, fast.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster richColors theme="light" position="top-right" />
      </body>
    </html>
  );
}
