import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseTrack Lite — Inteligência Financeira & OmegaPay",
  description:
    "Dashboard financeiro minimalista integrado aos webhooks e endpoints oficiais da OmegaPay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#090b10] text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
