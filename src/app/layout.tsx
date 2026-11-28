import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.usedashfy.com.br"),
  title: {
    default: "Dashfy — Análise de Marketing Digital & Gestão Financeira",
    template: "%s | Dashfy",
  },
  description:
    "Dashfy é uma plataforma SaaS de análise de marketing digital e gestão financeira para acompanhar campanhas, gastos publicitários, ROAS, ROI e lucro líquido.",
  applicationName: "Dashfy",
  authors: [{ name: "Tiago Mendonça", url: "https://www.usedashfy.com.br" }],
  creator: "Tiago Mendonça",
  publisher: "Dashfy",
  keywords: [
    "Dashfy",
    "análise de marketing digital",
    "gestão financeira SaaS",
    "ROAS",
    "ROI",
    "acompanhamento de campanhas",
    "dashboard financeiro",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://www.usedashfy.com.br",
    siteName: "Dashfy",
    title: "Dashfy — Análise de Marketing Digital & Gestão Financeira",
    description:
      "Acompanhe campanhas, gastos publicitários, ROAS, ROI, taxas e lucro líquido em dashboards separados por operação.",
    images: [
      {
        url: "/assets/logo-dashfy.png",
        width: 512,
        height: 128,
        alt: "Dashfy",
      },
    ],
  },
  icons: {
    icon: "/assets/logo-dashfy-icon.png",
    apple: "/assets/logo-dashfy-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dashfy",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#040914",
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
    <html
      lang="pt-BR"
      className={`dark scroll-smooth ${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#040914] text-slate-100 font-sans antialiased selection:bg-[#1d74ff]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
