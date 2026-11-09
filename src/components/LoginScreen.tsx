"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, Activity, ArrowRight, AlertCircle } from "lucide-react";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("mendoncat831@gmail.com");
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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#050507] text-zinc-100 relative">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center mb-3 shadow-lg shadow-white/5">
            <Activity className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              PulseTrack
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
              Lite
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Gestão Financeira &bull; OmegaPay v1
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0c0c0e] p-6 sm:p-7 shadow-2xl">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-white">
              Entrar no Painel
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Acesso seguro protegido por sessão criptografada.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                E-mail ou Usuário
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none transition"
                placeholder="mendoncat831@gmail.com"
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
                  className="w-full rounded-xl border border-white/10 bg-[#050507] pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none transition"
                  placeholder="••••••••••••"
                />
                <Lock className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold text-sm py-2.5 px-4 transition"
            >
              <span>{loading ? "Verificando..." : "Entrar no Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>Credenciais seguras mantidas no servidor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
