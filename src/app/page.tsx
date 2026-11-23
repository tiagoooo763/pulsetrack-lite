import type { Metadata } from "next";
import React from "react";
import { cookies } from "next/headers";
import { isAuthenticated, SESSION_COOKIE_NAME } from "@/lib/auth";
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
  // Otimização: visitantes sem cookie de sessão não disparam round-trip ao Supabase/DB na página pública
  const cookieStore = await cookies();
  const hasAnySessionCookie = cookieStore
    .getAll()
    .some(
      (c) =>
        c.name === SESSION_COOKIE_NAME ||
        (c.name.startsWith("sb-") && c.name.includes("auth-token"))
    );

  const authed = hasAnySessionCookie ? await isAuthenticated() : false;
  return <PublicLandingPage isLoggedIn={authed} />;
}
