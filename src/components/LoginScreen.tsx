"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { gsap } from "gsap";
import { SpotlightCard } from "./SpotlightCard";
import { DashfyBrand } from "./dashfy/DashfyBrand";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("mendoncat831@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(brandRef.current, {
        opacity: 0,
        y: -14,
        duration: 0.55,
      }).from(
        cardRef.current,
        {
          opacity: 0,
          y: 18,
          scale: 0.985,
          duration: 0.65,
        },
        "-=0.3"
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

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
      setError("Erro de conexão ao autenticar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#060b17] relative overflow-hidden"
    >
      {/* Subtle Navy / Blue Ambient Grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(26,134,255,0.16), transparent 42%), radial-gradient(circle at 80% 85%, rgba(37,99,235,0.12), transparent 45%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div ref={brandRef} className="flex flex-col items-center text-center mb-8">
          <DashfyBrand size="lg" className="mb-3" />
          <p className="text-xs text-slate-400">
            Plataforma de Inteligência Financeira &amp; Performance de Marketing
          </p>
        </div>

        {/* Card */}
        <div ref={cardRef}>
          <SpotlightCard className="p-6 sm:p-7 shadow-2xl">
            <div className="mb-5">
              <h1 className="text-base font-semibold text-white tracking-tight">
                Acessar Plataforma
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Gerencie suas operações TikTok Ads e OmegaPay em um só lugar.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-fade-in-up"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  E-mail ou Usuário
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/70 bg-[#070d1c] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#1a86ff] focus:ring-1 focus:ring-[#1a86ff]/30 focus:outline-none transition-all duration-200"
                  placeholder="mendoncat831@gmail.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/70 bg-[#070d1c] pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#1a86ff] focus:ring-1 focus:ring-[#1a86ff]/30 focus:outline-none transition-all duration-200"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-white transition"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pressable w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-white font-semibold text-sm py-2.5 px-4 shadow-lg shadow-[#1a86ff]/20 disabled:opacity-50"
              >
                {loading ? (
                  <span>Autenticando...</span>
                ) : (
                  <>
                    <span>Entrar no Dashfy</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#1a86ff]" />
                Cookie HTTP-Only HMAC
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Credenciais no Backend
              </span>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
