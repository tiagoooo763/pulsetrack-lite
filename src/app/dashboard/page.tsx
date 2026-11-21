import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { PulseTrackShell } from "@/components/PulseTrackShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel",
  description: "Área autenticada da plataforma Dashfy.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  return <PulseTrackShell initialAuthenticated={true} />;
}
