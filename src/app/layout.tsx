import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashfy — Inteligência Financeira & Performance de Marketing",
  description:
    "Plataforma SaaS de análise financeira e marketing com operações separadas para TikTok Ads e OmegaPay.",
  icons: {
    icon: "/assets/logo-dashfy-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#060b17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#060b17] text-slate-100 font-sans antialiased selection:bg-[#1a86ff]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
