import React from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

interface PublicLegalShellProps {
  badge: string;
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

export function PublicLegalShell({
  badge,
  title,
  updatedAt,
  children,
}: PublicLegalShellProps) {
  return (
    <div className="min-h-screen bg-[#040914] text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-blue-200/10 bg-[#040914]/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Voltar para a Dashfy">
            <DashfyBrand size="md" />
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-xl border border-blue-200/15 bg-white/[0.03] hover:bg-white/[0.08]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao início</span>
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-xs font-semibold px-4 py-2 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="space-y-3 pb-8 border-b border-blue-200/10">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border border-[#1d74ff]/35 bg-[#1d74ff]/10 text-sky-300">
            {badge}
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-400">
            Última atualização: {updatedAt} &bull; Site oficial:{" "}
            <a
              href="https://www.usedashfy.com.br"
              className="text-sky-300 hover:underline"
            >
              https://www.usedashfy.com.br
            </a>
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm text-slate-300 leading-relaxed">
          {children}
        </div>
      </main>

      <footer className="border-t border-blue-200/10 bg-[#030710] py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            Dashfy &bull; Responsável: Tiago Mendonça &bull;{" "}
            <a
              href="mailto:contato@usedashfy.com.br"
              className="text-sky-300 hover:underline inline-flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5" />
              contato@usedashfy.com.br
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="hover:text-white transition">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-white transition">
              Termos de Uso
            </Link>
            <Link href="/" className="hover:text-white transition">
              Início
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
