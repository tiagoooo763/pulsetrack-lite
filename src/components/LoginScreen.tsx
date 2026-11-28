"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { gsap } from "gsap";
import { SpotlightCard } from "./SpotlightCard";
import { DashfyBrand } from "./dashfy/DashfyBrand";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const authError = params.get("auth_error");
      const rawHashError =
        hashParams.get("error_description") ||
        hashParams.get("error_code") ||
        params.get("error_description");
      const resetOk = params.get("reset");
      const confirmed = params.get("confirmed");

      if (authError) {
        setError(authError);
      } else if (rawHashError) {
        const lower = rawHashError.toLowerCase();
        setError(
          lower.includes("expired")
            ? "Este link de autenticação expirou ou já foi utilizado. Solicite um novo link."
            : "Link de autenticação inválido ou expirado. Tente novamente."
        );
      } else if (resetOk === "1") {
        setNotice("Senha redefinida com sucesso. Faça login com sua nova senha.");
      } else if (confirmed === "1") {
        setNotice("E-mail confirmado com sucesso! Agora você já pode entrar.");
      }
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
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
    setErrorCode(null);
    setNotice(null);

    const trimmedEmail = username.trim();
    if (!trimmedEmail || !password) {
      setError("Informe seu e-mail e sua senha para continuar.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Credenciais inválidas.");
        if (typeof data.code === "string") {
          setErrorCode(data.code);
        }
        setLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError("Erro de conexão ao autenticar. Tente novamente.");
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    const trimmedEmail = username.trim().toLowerCase();
    if (!trimmedEmail) return;
    setResending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível reenviar o e-mail.");
      } else {
        setError(null);
        setErrorCode(null);
        setNotice(
          data.message ||
            "Reenviamos o e-mail de confirmação. Verifique sua caixa de entrada e spam."
        );
      }
    } catch {
      setError("Erro de conexão ao reenviar confirmação.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#040914] relative overflow-hidden"
    >
      {/* Subtle Dashfy blue radial glow + grid matching landing page */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(640px circle at 50% 0%, rgba(29,116,255,0.18), transparent 65%), linear-gradient(to right, rgba(147,197,253,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(147,197,253,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div ref={brandRef} className="flex flex-col items-center text-center mb-8">
          <Link href="/" aria-label="Voltar para a página inicial da Dashfy">
            <DashfyBrand size="lg" className="mb-3" />
          </Link>
          <p className="text-xs text-slate-400 mt-1">
            Análise de Marketing Digital &amp; Gestão Financeira
          </p>
        </div>

        {/* Card */}
        <div ref={cardRef}>
          <SpotlightCard className="p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <h1 className="font-display text-lg font-semibold text-white tracking-tight">
                Entrar no Painel
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Acesse sua conta Dashfy com isolamento seguro por usuário.
              </p>
            </div>

            {notice && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-fade-in-up"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-fade-in-up space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {errorCode === "EMAIL_NOT_CONFIRMED" && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resending}
                    className="w-full py-1.5 px-3 rounded-lg border border-rose-400/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-100 text-[11px] font-semibold transition disabled:opacity-50"
                  >
                    {resending
                      ? "Reenviando e-mail..."
                      : "Reenviar e-mail de confirmação"}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="dashfy-input w-full h-11 px-3.5 text-sm"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-[11px] text-[#5ea1ff] hover:text-sky-300 transition-colors"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="dashfy-input w-full h-11 pl-3.5 pr-10 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-3 p-1 text-slate-400 hover:text-white transition"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
                className="btn-pressable dashfy-btn-primary w-full h-11 text-sm px-4 disabled:opacity-50"
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

            {/* Botão Criar Conta */}
            <div className="mt-5">
              <div className="relative flex items-center justify-center my-3.5">
                <div className="border-t border-blue-200/10 w-full" />
                <span className="bg-[#0a1529] px-3 text-[11px] text-slate-400 shrink-0">
                  Novo na Dashfy?
                </span>
                <div className="border-t border-blue-200/10 w-full" />
              </div>

              <Link
                href="/cadastro"
                className="btn-pressable dashfy-btn-secondary w-full h-11 text-sm px-4"
              >
                <UserPlus className="w-4 h-4 text-[#5ea1ff]" />
                <span>Criar conta</span>
              </Link>
            </div>

            <div className="mt-6 pt-4 border-t border-blue-200/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#5ea1ff]" />
                Supabase Auth &amp; RLS
              </span>
              <Link
                href="/"
                className="text-slate-400 hover:text-white transition-colors"
              >
                &larr; Página inicial
              </Link>
            </div>
          </SpotlightCard>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <Link href="/privacidade" className="hover:text-sky-300 transition">
              Política de Privacidade
            </Link>
            <span>&bull;</span>
            <Link href="/termos" className="hover:text-sky-300 transition">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
