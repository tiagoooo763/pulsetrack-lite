import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginPageClient } from "@/components/LoginPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar",
  description:
    "Acesse sua conta Dashfy para gerenciar campanhas, gastos publicitários, ROAS, ROI e operações financeiras.",
};

export default async function LoginPage() {
  const authed = await isAuthenticated();
  if (authed) {
    redirect("/dashboard");
  }

  return <LoginPageClient />;
}
