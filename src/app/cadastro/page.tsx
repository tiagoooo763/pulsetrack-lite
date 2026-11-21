"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

export default function CadastroPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null
  );

  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordStrong = hasMinLen && hasUpper && hasLower && hasNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (displayName.trim().length < 2) {
      setError("Informe seu nome (mínimo 2 caracteres).");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }

    if (!isPasswordStrong) {
      setError(
        "A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula e número."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a conta.");
        setLoading(false);
        return;
      }

      if (data.autoSignedIn || data.requiresEmailConfirmation === false) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setConfirmationMessage(
        data.message ||
          "Conta criada com sucesso! Verifique sua caixa de entrada e clique no link de confirmação para entrar."
      );
      setLoading(false);
    } catch {
      setError("Erro de conexão ao criar conta. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#050507] relative overflow-hidden">
      {/* Subtle monochrome grid background */}
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
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-7">
          <Link href="/" aria-label="Voltar para a página inicial da Dashfy">
            <DashfyBrand size="lg" className="mb-3" />
          </Link>
          <p className="text-xs text-zinc-400 mt-1">
            Crie seu workspace exclusivo na Dashfy
          </p>
        </div>

        <SpotlightCard className="p-6 sm:p-7 shadow-2xl">
          {confirmationMessage ? (
            <div className="space-y-5 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
                <MailCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-base font-semibold text-white">
                  Confirme seu e-mail
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {confirmationMessage}
                </p>
                <p className="text-[11px] text-zinc-500 pt-1">
                  Enviado para{" "}
                  <span className="text-zinc-200 font-mono">{email}</span>
                </p>
              </div>
              <Link
                href="/login"
                className="btn-pressable w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para o Login</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-base font-semibold text-white tracking-tight">
                  Criar conta
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure seu acesso para gerenciar suas próprias operações,
                  campanhas e integrações.
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

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Seu nome
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      required
                      maxLength={80}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                      placeholder="Ex: Lucas Silva"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-company"
                      className="block text-xs font-medium text-zinc-300 mb-1.5"
                    >
                      Workspace{" "}
                      <span className="text-zinc-500 font-normal">(opcional)</span>
                    </label>
                    <input
                      id="signup-company"
                      type="text"
                      maxLength={80}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                      placeholder="Ex: Minha Operação"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    E-mail
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#050507] pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-2.5 p-1 text-zinc-400 hover:text-white transition"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Checklist de força de senha */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { ok: hasMinLen, label: "8+ caracteres" },
                      { ok: hasUpper, label: "1 letra maiúscula" },
                      { ok: hasLower, label: "1 letra minúscula" },
                      { ok: hasNumber, label: "1 número" },
                    ].map((rule) => (
                      <span
                        key={rule.label}
                        className={`flex items-center gap-1.5 ${
                          rule.ok ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        <Check className="w-3 h-3 shrink-0" />
                        <span>{rule.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-confirm"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Confirmar senha
                  </label>
                  <input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                    placeholder="Repita sua senha"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="mt-1 text-[11px] text-rose-400">
                      As senhas não conferem.
                    </p>
                  )}
                  {passwordsMatch && (
                    <p className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Senhas conferem
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-pressable w-full flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4 shadow-sm disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <span>Criando conta...</span>
                  ) : (
                    <>
                      <span>Criar minha conta</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-zinc-400">Já possui conta?</span>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-white font-medium hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o login</span>
                </Link>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  Criptografia Supabase Auth
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  Ambiente Isolado
                </span>
              </div>
            </>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}
