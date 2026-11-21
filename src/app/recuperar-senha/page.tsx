"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Send,
} from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSentMessage(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível processar a solicitação.");
        setLoading(false);
        return;
      }

      setSentMessage(
        data.message ||
          "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes."
      );
      setLoading(false);
    } catch {
      setError("Erro de conexão ao solicitar recuperação. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#050507] relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <DashfyBrand size="lg" className="mb-3" />
          <p className="text-xs text-zinc-400 mt-1">
            Recuperação segura de acesso
          </p>
        </div>

        <SpotlightCard className="p-6 sm:p-7 shadow-2xl">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-white tracking-tight">
              Recuperar senha
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Informe o e-mail da sua conta Dashfy e enviaremos um link seguro
              para definir uma nova senha.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {sentMessage ? (
            <div className="space-y-4">
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{sentMessage}</span>
              </div>

              <Link
                href="/"
                className="btn-pressable w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para o login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="recover-email"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    id="recover-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pressable w-full flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar link de recuperação</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </Link>
            <Link
              href="/cadastro"
              className="text-zinc-400 hover:text-white transition"
            >
              Criar conta
            </Link>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
