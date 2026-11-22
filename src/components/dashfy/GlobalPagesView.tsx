"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Database,
  HelpCircle,
  KeyRound,
  Mail,
  Settings,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import type {
  DashfyDashboardPayload,
  DashboardOperationId,
  GlobalPageId,
  OperationTabId,
} from "@/lib/dashfy-types";
import { EXPENSE_CATEGORIES } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/db";
import type { UserSoundPreferences } from "@/lib/notification-sounds";
import { SpotlightCard } from "@/components/SpotlightCard";
import { SalesSoundSettingsSection } from "./SalesSoundSettingsSection";

interface GlobalPagesViewProps {
  pageId: GlobalPageId;
  data: DashfyDashboardPayload;
  onRefresh: () => Promise<void>;
  onNavigateDashboard: (dash: DashboardOperationId, tab: OperationTabId) => void;
  onSoundPrefsSaved?: (prefs: UserSoundPreferences) => void;
}

export function GlobalPagesView({
  pageId,
  data,
  onRefresh,
  onNavigateDashboard,
  onSoundPrefsSaved,
}: GlobalPagesViewProps) {
  // Minha Conta
  const [displayName, setDisplayName] = useState(data.profile.displayName);
  const [companyName, setCompanyName] = useState(data.profile.companyName);
  const [newPassword, setNewPassword] = useState("");
  const [accountMsg, setAccountMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Alterar e-mail (Supabase Auth)
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeMsg, setEmailChangeMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Configurações (Gasto rápido)
  const [presetTitle, setPresetTitle] = useState(
    data.quickExpensePreset?.title || "Meta Ads"
  );
  const [presetAmount, setPresetAmount] = useState(
    String(data.quickExpensePreset?.amount || 50)
  );
  const [presetCategory, setPresetCategory] = useState<ExpenseCategory>(
    data.quickExpensePreset?.category || "META_ADS"
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setAccountMsg(null);
    try {
      if (newPassword.trim().length > 0 && newPassword.trim().length < 8) {
        setAccountMsg({
          type: "error",
          text: "A nova senha deve ter no mínimo 8 caracteres.",
        });
        setSavingAccount(false);
        return;
      }

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          displayName,
          companyName,
        }),
      });

      if (newPassword.trim().length >= 8) {
        const pwdRes = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_credentials",
            dashboardPassword: newPassword.trim(),
          }),
        });
        const pwdJson = await pwdRes.json();
        if (!pwdRes.ok) {
          setAccountMsg({
            type: "error",
            text: pwdJson.error || "Não foi possível atualizar a senha.",
          });
          setSavingAccount(false);
          return;
        }
        setNewPassword("");
      }

      setAccountMsg({
        type: "success",
        text: "Dados da conta atualizados com sucesso.",
      });
      await onRefresh();
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailChangeMsg(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailChangeMsg({
        type: "error",
        text: "Informe um endereço de e-mail válido.",
      });
      return;
    }
    if (trimmed === data.profile.username.toLowerCase()) {
      setEmailChangeMsg({
        type: "error",
        text: "O novo e-mail precisa ser diferente do e-mail atual.",
      });
      return;
    }

    setChangingEmail(true);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: trimmed }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setEmailChangeMsg({
          type: "error",
          text: json.error || "Não foi possível solicitar a alteração de e-mail.",
        });
      } else {
        setNewEmail("");
        setEmailChangeMsg({
          type: "success",
          text:
            json.message ||
            "Enviamos um link de confirmação para concluir a alteração do seu e-mail.",
        });
      }
    } catch {
      setEmailChangeMsg({
        type: "error",
        text: "Erro de conexão ao solicitar alteração de e-mail.",
      });
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    const num = Number(presetAmount.replace(",", "."));
    try {
      if (Number.isFinite(num) && num > 0) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_quick_expense_preset",
            preset: { title: presetTitle, amount: num, category: presetCategory },
          }),
        });
        setSettingsMsg("Configurações salvas no servidor.");
        await onRefresh();
      }
    } finally {
      setSavingSettings(false);
    }
  }

  if (pageId === "minha_conta") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Perfil &amp; Segurança</h3>
              <p className="text-xs text-zinc-400">
                Gerencie os dados da sua conta administrativa Dashfy
              </p>
            </div>
          </div>

          {accountMsg && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                accountMsg.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {accountMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">E-mail de Acesso</label>
              <input
                type="text"
                disabled
                value={data.profile.username}
                className="w-full rounded-xl border border-white/10 bg-[#050507]/60 px-3 py-2 text-xs text-zinc-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Nome de Exibição</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Workspace / Empresa</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">
                Nova Senha de Acesso (opcional, mín. 8 caracteres)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Deixe em branco para manter a senha atual"
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingAccount}
              className="btn-pressable w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
            >
              {savingAccount ? "Salvando..." : "Salvar Alterações"}
            </button>
          </form>
        </SpotlightCard>

        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Segurança da Sessão</h3>
              <p className="text-xs text-zinc-400">Proteção de credenciais e tokens</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-zinc-300">
            <div className="p-3 rounded-xl border border-white/10 bg-[#08080a] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-white" />
                {data.profile.authProvider === "supabase"
                  ? "Supabase Auth (JWT + RLS Multi-Usuário)"
                  : "Sessão Segura HTTP-Only (Conta Legada)"}
              </span>
              <span className="text-emerald-400 font-semibold">Ativa</span>
            </div>
            <div className="p-3 rounded-xl border border-white/10 bg-[#08080a] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-white" />
                Persistência de Dados
              </span>
              <span className="text-emerald-400 font-semibold">Conectada</span>
            </div>
          </div>

          {/* Alterar E-mail de Acesso (Supabase Auth) */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-white" />
              <div>
                <h4 className="text-xs font-semibold text-white">
                  Alterar e-mail de acesso
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Envia confirmação segura via Supabase Auth antes de concluir a troca.
                </p>
              </div>
            </div>

            {emailChangeMsg && (
              <div
                role={emailChangeMsg.type === "error" ? "alert" : "status"}
                className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
                  emailChangeMsg.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                {emailChangeMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{emailChangeMsg.text}</span>
              </div>
            )}

            {data.profile.authProvider === "supabase" ? (
              <form onSubmit={handleChangeEmail} className="space-y-2.5">
                <div>
                  <label
                    htmlFor="account-new-email"
                    className="block text-xs text-zinc-300 mb-1"
                  >
                    Novo E-mail
                  </label>
                  <input
                    id="account-new-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingEmail}
                  className="btn-pressable w-full py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {changingEmail
                    ? "Enviando confirmação..."
                    : "Solicitar Alteração de E-mail"}
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-zinc-400 rounded-xl border border-white/10 bg-[#08080a] p-3">
                Sua sessão atual está no modo legado. Crie ou acesse sua conta via
                Supabase Auth para gerenciar a troca de e-mail por confirmação automática.
              </p>
            )}
          </div>
        </SpotlightCard>
      </div>
    );
  }

  if (pageId === "configuracoes") {
    return (
      <div className="space-y-6">
        {/* Configurações -> Notificações -> Sons de vendas */}
        <SalesSoundSettingsSection
          initialPreferences={data.soundPreferences}
          onPreferencesSaved={onSoundPrefsSaved}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Atalho de Despesa Rápida
              </h3>
              <p className="text-xs text-zinc-400">
                Configure o botão de lançamento rápido na barra superior
              </p>
            </div>
          </div>

          {settingsMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {settingsMsg}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-300 mb-1">Nome do Atalho</label>
              <input
                type="text"
                value={presetTitle}
                onChange={(e) => setPresetTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Valor Padrão (R$)</label>
                <input
                  type="text"
                  value={presetAmount}
                  onChange={(e) => setPresetAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Categoria</label>
                <select
                  value={presetCategory}
                  onChange={(e) => setPresetCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white focus:border-white focus:outline-none"
                >
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn-pressable w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
            >
              {savingSettings ? "Salvando..." : "Salvar Configurações"}
            </button>
          </form>
        </SpotlightCard>

        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-3">
          <h3 className="text-sm font-semibold text-white">Padrões Regionais</h3>
          <div className="space-y-2 text-xs text-zinc-300">
            <div className="flex justify-between p-3 rounded-xl border border-white/10 bg-[#08080a]">
              <span className="text-zinc-400">Moeda Principal</span>
              <span className="font-mono text-white">BRL (R$)</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl border border-white/10 bg-[#08080a]">
              <span className="text-zinc-400">Fuso Horário</span>
              <span className="font-mono text-white">America/Sao_Paulo (BRT)</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl border border-white/10 bg-[#08080a]">
              <span className="text-zinc-400">Operações Configuradas</span>
              <span className="font-mono text-white">TikTok • OmegaPay</span>
            </div>
          </div>
        </SpotlightCard>
        </div>
      </div>
    );
  }

  // ==================== SUPORTE ====================
  return (
    <div className="space-y-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Central de Suporte Dashfy</h3>
            <p className="text-xs text-zinc-400">
              Guias práticos para configurar a OmegaPay e importar seus relatórios do TikTok Ads
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <BookOpen className="w-4 h-4 text-white" />
              <span>1. Como integrar a OmegaPay</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Acesse <strong>Operação OmegaPay &gt; Integrações</strong>, copie a URL do webhook e cole no painel da OmegaPay. Em seguida, gere sua chave API com permissão de <em>Consultar dados da conta / ver saldo</em> e salve no Dashfy.
            </p>
            <button
              type="button"
              onClick={() => onNavigateDashboard("omegapay", "integracoes")}
              className="text-xs font-semibold text-white hover:underline"
            >
              Ir para Integrações OmegaPay &rarr;
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <BookOpen className="w-4 h-4 text-white" />
              <span>2. Como usar a Operação TikTok</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Exporte seus dados de campanhas no TikTok Ads Manager em formato CSV (ou baixe nosso modelo pronto) e clique em <strong>Importar CSV</strong> em <strong>Operação TikTok &gt; TikTok Ads</strong>. Os números ficam 100% isolados da OmegaPay.
            </p>
            <button
              type="button"
              onClick={() => onNavigateDashboard("tiktok", "tiktok_ads")}
              className="text-xs font-semibold text-white hover:underline"
            >
              Ir para TikTok Ads &rarr;
            </button>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
