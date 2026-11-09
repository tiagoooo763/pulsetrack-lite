"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, Activity, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { gsap } from "gsap";
import { SpotlightCard } from "./SpotlightCard";

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
    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(brandRef.current, {
        opacity: 0,
        y: -16,
        duration: 0.6,
      }).from(
        cardRef.current,
        {
          opacity: 0,
          y: 20,
          scale: 0.98,
          duration: 0.7,
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
        // Subtle error shake on card
        if (cardRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.fromTo(
            cardRef.current,
            { x: -6 },
            { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" }
          );
        }
        return;
      }

      onSuccess();
    } catch {
      setError("Falha de conexão com o servidor.");
      setLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#050507] text-zinc-100 relative selection:bg-white/20 selection:text-white"
    >
      {/* Background Subtle Gradient Glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-[120px]"
        aria-hidden="true"
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div ref={brandRef} className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(255,255,255,0.12)]">
            <Activity className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white font-sans">
              PulseTrack
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
              Lite
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Gestão Financeira &bull; OmegaPay v1
          </p>
        </div>

        {/* Card */}
        <div ref={cardRef}>
          <SpotlightCard className="p-6 sm:p-7 shadow-2xl">
            <div className="mb-5">
              <h1 className="text-base font-semibold text-white tracking-tight">
                Entrar no Painel
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Acesso seguro protegido por sessão criptografada.
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
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  E-mail ou Usuário
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                  placeholder="mendoncat831@gmail.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 focus:outline-none"
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pressable w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-50 text-black font-semibold text-sm py-2.5 px-4 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all"
              >
                <span>{loading ? "Verificando..." : "Entrar no Dashboard"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[11px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Credenciais seguras mantidas no servidor</span>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
