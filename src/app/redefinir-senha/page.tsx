"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );
    const err =
      hashParams.get("error_description") || hashParams.get("error_code");
    if (err) {
      setError(
        err.toLowerCase().includes("expired")
          ? "Este link de redefinição expirou ou já foi utilizado. Solicite um novo link."
          : "Link de redefinição inválido. Solicite uma nova recuperação de senha."
      );
    }
  }, []);

  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isStrong = hasMinLen && hasUpper && hasLower && hasNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isStrong) {
      setError(
        "A nova senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula e número."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            "Sessão de redefinição expirada. Solicite um novo link de recuperação."
        );
        setLoading(false);
        return;
      }

      setDone(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch {
      setError("Erro de conexão ao redefinir a senha. Tente novamente.");
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
          <Link href="/" aria-label="Voltar para a página inicial da Dashfy">
            <DashfyBrand size="lg" className="mb-3" />
          </Link>
          <p className="text-xs text-zinc-400 mt-1">
            Defina uma nova senha de acesso
          </p>
        </div>

        <SpotlightCard className="p-6 sm:p-7 shadow-2xl">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-white tracking-tight">
              Redefinir senha
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Escolha uma senha forte para proteger sua conta Dashfy.
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

          {done ? (
            <div className="space-y-4">
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Senha atualizada com sucesso! Redirecionando para seu painel...
                </span>
              </div>
              <Link
                href="/dashboard"
                className="btn-pressable w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4"
              >
                <span>Acessar Dashfy</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    id="new-password"
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
                  htmlFor="confirm-new-password"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Confirmar nova senha
                </label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-200"
                  placeholder="Repita a nova senha"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-pressable w-full flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4 shadow-sm disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? "Salvando..." : "Salvar nova senha"}</span>
              </button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </Link>
            <Link
              href="/recuperar-senha"
              className="text-zinc-400 hover:text-white transition"
            >
              Solicitar novo link
            </Link>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
