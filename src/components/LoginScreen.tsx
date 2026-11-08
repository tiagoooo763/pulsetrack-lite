"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, Activity, ArrowRight, AlertCircle } from "lucide-react";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Credenciais inválidas.");
        setLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError("Falha de conexão com o servidor.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#090b10] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[320px] bg-emerald-500/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[450px] h-[260px] bg-purple-600/10 blur-[130px] rounded-full" />

      <div className="w-full max-w-md z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="w-5 h-5 text-zinc-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-white">
                PulseTrack
              </span>
              <span className="text-[11px] font-medium uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Lite
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Controle Financeiro &bull; Integração Oficial OmegaPay
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#11141d]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-white">
              Acesso ao Painel Financeiro
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Autenticação protegida por sessão HTTP-only no servidor.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Usuário
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0b0d14] pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  placeholder="••••••••••••"
                />
                <Lock className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3" />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Padrão inicial local (caso <code className="text-zinc-400">DASHBOARD_PASSWORD</code> não esteja no <code className="text-zinc-400">.env</code>):{" "}
                <code className="text-emerald-400/90">pulsetrack123</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm py-2.5 px-4 transition shadow-lg shadow-emerald-500/20"
            >
              <span>{loading ? "Verificando..." : "Entrar no Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Chaves da OmegaPay (<code className="text-zinc-300">x-public-key</code> e{" "}
              <code className="text-zinc-300">x-secret-key</code>) mantidas exclusivamente no servidor.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
