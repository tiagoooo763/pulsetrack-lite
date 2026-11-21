import type { Metadata } from "next";
import React from "react";
import { isAuthenticated } from "@/lib/auth";
import { PublicLandingPage } from "@/components/landing/PublicLandingPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashfy — Análise de Marketing Digital & Gestão Financeira",
  description:
    "Plataforma SaaS para acompanhamento de campanhas, gastos publicitários, ROAS, ROI, taxas, despesas e lucro líquido em operações separadas.",
  alternates: {
    canonical: "https://www.usedashfy.com.br",
  },
};

export default async function HomePage() {
  const authed = await isAuthenticated();
  return <PublicLandingPage isLoggedIn={authed} />;
}
