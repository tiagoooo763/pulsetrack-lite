"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  KeyRound,
  Megaphone,
  Plug,
  Power,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import type {
  DashboardOperationMode,
  IntegrationStatusPayload,
  OperationTabId,
} from "@/lib/dashfy-types";
import type { WebhookEventRecord } from "@/lib/db";
import type { OmegaPayCredentialsResponse } from "@/lib/omegapay-types";
import { formatDateTimeBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";
import { TikTokOAuthPanel } from "./TikTokOAuthPanel";
import { ElevyPayIntegrationCard } from "./ElevyPayIntegrationCard";

interface IntegrationsViewProps {
  dashboardId?: string;
  dashboardName?: string;
  dashboardMode: DashboardOperationMode;
  integrationStatus: IntegrationStatusPayload;
  recentWebhooks?: WebhookEventRecord[];
  onRefresh: () => Promise<void>;
  onNavigateTab: (tabId: OperationTabId) => void;
  onSyncOmegaBalance: () => Promise<void>;
  onChangeDashboardMode?: (nextMode: DashboardOperationMode) => Promise<void>;
  syncingBalance: boolean;
}

export function IntegrationsView({
  dashboardId = "tiktok",
  dashboardName = "Operação",
  dashboardMode,
  integrationStatus,
  recentWebhooks = [],
  onRefresh,
  onNavigateTab,
  onSyncOmegaBalance,
  onChangeDashboardMode,
  syncingBalance,
}: IntegrationsViewProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<DashboardOperationMode>(dashboardMode);
  const [switchingMode, setSwitchingMode] = useState(false);

  useEffect(() => {
    setSelectedProvider(dashboardMode);
  }, [dashboardId, dashboardMode]);

  async function handleSelectProvider(nextMode: DashboardOperationMode) {
    setSelectedProvider(nextMode);
    if (nextMode !== dashboardMode && onChangeDashboardMode) {
      setSwitchingMode(true);
      try {
        await onChangeDashboardMode(nextMode);
      } finally {
        setSwitchingMode(false);
      }
    }
  }
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsFeedback, setCredsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<OmegaPayCredentialsResponse | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  const [togglingSync, setTogglingSync] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Simulador de evento webhook OmegaPay
  const [simEvent, setSimEvent] = useState("TRANSACTION_PAID");
  const [simProduct, setSimProduct] = useState("Produto Digital Dashfy");
  const [simGross, setSimGross] = useState("197.00");
  const [simFee, setSimFee] = useState("9.85");
  const [simLoading, setSimLoading] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.usedashfy.com.br";
  const webhookParam = integrationStatus.webhookUserParam;
  const omegaWebhookUrl =
    webhookParam && !webhookParam.startsWith("legacy:")
      ? `${originUrl}/api/webhooks/omegapay?u=${encodeURIComponent(webhookParam)}`
      : `${originUrl}/api/webhooks/omegapay`;

  const isOmegaConnected =
    integrationStatus.hasApiCredentials || integrationStatus.hasWebhookToken;

  async function handleSaveOmegaCreds(e: React.FormEvent) {
    e.preventDefault();
    setCredsFeedback(null);
    if (!publicKey.trim() && !secretKey.trim() && !webhookToken.trim()) {
      setCredsFeedback({
        type: "error",
        text: "Preencha ao menos um campo de credencial para atualizar no backend.",
      });
      return;
    }
    setSavingCreds(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_credentials",
          publicKey: publicKey.trim() || undefined,
          secretKey: secretKey.trim() || undefined,
          webhookToken: webhookToken.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCredsFeedback({
          type: "error",
          text: json.error || "Não foi possível salvar as credenciais.",
        });
      } else {
        setPublicKey("");
        setSecretKey("");
        setWebhookToken("");
        setCredsFeedback({
          type: "success",
          text: "Credenciais salvas com segurança no backend. Nunca são expostas no navegador.",
        });
        await onRefresh();
      }
    } catch {
      setCredsFeedback({
        type: "error",
        text: "Erro de comunicação ao salvar credenciais.",
      });
    } finally {
      setSavingCreds(false);
    }
  }

  async function handleTestConnection() {
    setTestingConn(true);
    setConnError(null);
    setConnResult(null);
    try {
      const res = await fetch("/api/omegapay/credentials", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setConnError(
          json.error ||
            "Falha ao validar credenciais na OmegaPay. Verifique sua API Key e Secret Key."
        );
      } else {
        setConnResult(json.credentials as OmegaPayCredentialsResponse);
      }
    } catch {
      setConnError("Erro de rede ao testar conexão com a OmegaPay.");
    } finally {
      setTestingConn(false);
    }
  }

  async function handleToggleSync() {
    setTogglingSync(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_omegapay_sync",
          enabled: !integrationStatus.syncEnabled,
        }),
      });
      await onRefresh();
    } finally {
      setTogglingSync(false);
    }
  }

  async function handleSimulateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSimLoading(true);
    setSimFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_webhook",
          event: simEvent,
          productName: simProduct,
          grossAmount: Number(simGross.replace(",", ".")),
          feeAmount: Number(simFee.replace(",", ".")),
          paymentMethod: "PIX",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSimFeedback(json.error || "Falha ao processar evento de teste.");
      } else {
        setSimFeedback("Evento de teste processado e salvo no histórico da OmegaPay!");
        await onRefresh();
      }
    } catch {
      setSimFeedback("Erro ao disparar simulação.");
    } finally {
      setSimLoading(false);
    }
  }

  const nexusWebhookUrl =
    webhookParam && !webhookParam.startsWith("legacy:")
      ? `${originUrl}/api/webhooks/nexus?u=${encodeURIComponent(webhookParam)}`
      : `${originUrl}/api/webhooks/nexus`;

  // ==================== SELETOR LIVRE DE INTEGRAÇÃO POR OPERAÇÃO ====================
  return (
    <div className="space-y-6">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5ea1ff] mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Integração flexível • {dashboardName}</span>
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Escolha o que integrar nesta operação
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Cada operação (Operação 1, Operação 2 ou Operação 3) pode ser conectada livremente ao{" "}
              <strong className="text-zinc-200">TikTok Ads</strong> ou ao seu{" "}
              <strong className="text-zinc-200">Gateway de Pagamento</strong>. Você pode alternar quando quiser.
            </p>
          </div>
          {switchingMode && (
            <span className="text-xs text-sky-300 font-medium shrink-0">
              Atualizando operação...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OPÇÃO 1: TIKTOK ADS */}
          <button
            type="button"
            onClick={() => handleSelectProvider("tiktok")}
            disabled={switchingMode}
            className={`text-left rounded-2xl border p-4 sm:p-5 transition-all duration-200 flex items-start gap-3.5 ${
              selectedProvider === "tiktok"
                ? "border-[#1d74ff]/60 bg-[#1d74ff]/10 shadow-[0_12px_32px_-12px_rgba(29,116,255,0.45)]"
                : "border-white/10 bg-[#08080a] hover:border-white/25 hover:bg-white/[0.03]"
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                selectedProvider === "tiktok"
                  ? "bg-[#1d74ff]/20 border-[#1d74ff]/40 text-[#5ea1ff]"
                  : "bg-white/5 border-white/10 text-zinc-300"
              }`}
            >
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  TikTok Ads (OAuth &amp; CSV)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    dashboardMode === "tiktok"
                      ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-zinc-400"
                  }`}
                >
                  {dashboardMode === "tiktok" ? "Ativo nesta operação" : "Selecionar"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Conecte seu TikTok Business Center via OAuth 2.0 oficial ou importe planilhas CSV de campanhas, gastos, cliques, ROAS e UTMs.
              </p>
            </div>
          </button>

          {/* OPÇÃO 2: GATEWAY DE PAGAMENTO (OMEGAPAY / NEXUS) */}
          <button
            type="button"
            onClick={() => handleSelectProvider("omegapay")}
            disabled={switchingMode}
            className={`text-left rounded-2xl border p-4 sm:p-5 transition-all duration-200 flex items-start gap-3.5 ${
              selectedProvider === "omegapay"
                ? "border-emerald-500/55 bg-emerald-500/10 shadow-[0_12px_32px_-12px_rgba(16,185,129,0.4)]"
                : "border-white/10 bg-[#08080a] hover:border-white/25 hover:bg-white/[0.03]"
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                selectedProvider === "omegapay"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-white/5 border-white/10 text-zinc-300"
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  Gateways de Pagamento (ElevyPay / OmegaPay / Nexus)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    dashboardMode === "omegapay"
                      ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-zinc-400"
                  }`}
                >
                  {dashboardMode === "omegapay" ? "Ativo nesta operação" : "Selecionar"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Conecte sua gateway via API e Webhooks autenticados para receber vendas em tempo real, notificações sonoras/mobile, taxas e saldo.
              </p>
            </div>
          </button>
        </div>
      </SpotlightCard>

      {/* CONTEÚDO DA INTEGRAÇÃO ESCOLHIDA */}
      {selectedProvider === "tiktok" ? (
        <div className="space-y-5">
          <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      TikTok Ads Manager — Importação CSV
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Operacional
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Exporte o relatório de campanhas/conjuntos/anúncios no TikTok Ads Manager em CSV e importe diretamente na aba TikTok Ads desta operação.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("tiktok_ads")}
                className="btn-pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Abrir Importação CSV</span>
              </button>
            </div>
          </SpotlightCard>

          <TikTokOAuthPanel dashboardId={dashboardId} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* CARD COMPLETO DE INTEGRAÇÃO ELEVYPAY */}
          <ElevyPayIntegrationCard
            initialStatus={integrationStatus.elevypay}
            recentWebhooks={recentWebhooks}
            onRefresh={onRefresh}
          />

          {/* CARD DE STATUS DA INTEGRAÇÃO OMEGAPAY */}
          <SpotlightCard className="p-5 sm:p-6 bento-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-white" />
                </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-white">OmegaPay Gateway</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isOmegaConnected && integrationStatus.syncEnabled
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOmegaConnected && integrationStatus.syncEnabled
                        ? "bg-emerald-400"
                        : "bg-amber-400"
                    }`}
                  />
                  {!isOmegaConnected
                    ? "Aguardando Credenciais"
                    : integrationStatus.syncEnabled
                      ? "Conexão Ativa"
                      : "Sincronização Pausada"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                API Oficial: <span className="font-mono text-zinc-300">{integrationStatus.apiBaseUrl}</span>
                {" • "}
                Última sincronização:{" "}
                <span className="font-mono text-zinc-200">
                  {integrationStatus.lastSyncAt
                    ? formatDateTimeBR(integrationStatus.lastSyncAt)
                    : "Ainda não sincronizada"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSync}
              disabled={togglingSync}
              className={`btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
                integrationStatus.syncEnabled
                  ? "border-white/10 bg-[#08080a] text-zinc-200 hover:border-rose-500/50 hover:text-rose-300"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {integrationStatus.syncEnabled
                  ? "Desabilitar Sincronização"
                  : "Habilitar Sincronização"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConn}
              className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{testingConn ? "Testando..." : "Testar Conexão"}</span>
            </button>

            <button
              type="button"
              onClick={onSyncOmegaBalance}
              disabled={syncingBalance || !integrationStatus.syncEnabled}
              className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 text-xs font-semibold text-black disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingBalance ? "animate-spin" : ""}`} />
              <span>{syncingBalance ? "Sincronizando..." : "Sincronizar Saldo"}</span>
            </button>
          </div>
        </div>

        {/* Resultado do Teste de Conexão */}
        {connError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{connError}</span>
          </div>
        )}

        {connResult && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Conexão validada com sucesso na OmegaPay!</span>
            </div>
            <div className="text-[11px] text-emerald-100/80 font-mono">
              Permissões ativas:{" "}
              {Array.isArray(connResult.permissions) && connResult.permissions.length > 0
                ? connResult.permissions.join(", ")
                : "Credenciais válidas"}
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* GRID DE CONFIGURAÇÃO DE CREDENCIAIS + WEBHOOK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Formulário de Credenciais (Armazenadas apenas no Backend) */}
        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Credenciais da API OmegaPay
              </h3>
              <p className="text-xs text-zinc-400">
                Armazenadas exclusivamente no servidor (nunca enviadas ao navegador)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span
              className={`px-2.5 py-1 rounded-lg border ${
                integrationStatus.hasApiCredentials
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-zinc-400"
              }`}
            >
              API Key / Secret: {integrationStatus.hasApiCredentials ? "Configuradas" : "Não configuradas"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border ${
                integrationStatus.hasWebhookToken
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-zinc-400"
              }`}
            >
              Webhook Token: {integrationStatus.hasWebhookToken ? "Configurado" : "Não configurado"}
            </span>
          </div>

          {credsFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                credsFeedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              {credsFeedback.text}
            </div>
          )}

          <form onSubmit={handleSaveOmegaCreds} className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-300 mb-1">
                Chave Pública (x-public-key)
              </label>
              <input
                type="password"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={
                  integrationStatus.hasApiCredentials
                    ? "•••••••• (deixe em branco para manter)"
                    : "Cole sua x-public-key da OmegaPay"
                }
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">
                Chave Secreta (x-secret-key)
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={
                  integrationStatus.hasApiCredentials
                    ? "•••••••• (deixe em branco para manter)"
                    : "Cole sua x-secret-key da OmegaPay"
                }
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">
                Token de Validação do Webhook
              </label>
              <input
                type="password"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder={
                  integrationStatus.hasWebhookToken
                    ? "•••••••• (deixe em branco para manter)"
                    : "Cole o token exclusivo gerado no webhook OmegaPay"
                }
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingCreds}
              className="btn-pressable w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
            >
              {savingCreds ? "Salvando no servidor..." : "Salvar Credenciais no Backend"}
            </button>
          </form>
        </SpotlightCard>

        {/* Configuração de Webhook + Teste de Evento */}
        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Configuração do Webhook OmegaPay
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cadastre a URL abaixo em <strong>Configurações &gt; Webhooks</strong> no painel da OmegaPay.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#050507] p-3 flex items-center justify-between gap-2">
            <code className="text-[11px] font-mono text-white break-all">
              {omegaWebhookUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(omegaWebhookUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2500);
              }}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold shrink-0"
            >
              {copiedUrl ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? "Copiado" : "Copiar"}</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-200">Eventos recomendados:</div>
            <div className="font-mono text-[10px] text-zinc-400">
              TRANSACTION_CREATED • TRANSACTION_PAID • TRANSACTION_REFUNDED • TRANSACTION_CANCELED • TRANSACTION_CHARGED_BACK • TRANSFER_COMPLETED
            </div>
          </div>

          {/* Testador real de fluxo webhook */}
          <form
            onSubmit={handleSimulateWebhook}
            className="pt-4 border-t border-white/10 space-y-3"
          >
            <div className="text-xs font-semibold text-white">
              Validar Pipeline de Webhook (Teste Local Seguro)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={simEvent}
                onChange={(e) => setSimEvent(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white focus:border-white focus:outline-none"
              >
                <option value="TRANSACTION_PAID">TRANSACTION_PAID</option>
                <option value="TRANSACTION_CREATED">TRANSACTION_CREATED</option>
                <option value="TRANSACTION_REFUNDED">TRANSACTION_REFUNDED</option>
                <option value="TRANSFER_COMPLETED">TRANSFER_COMPLETED</option>
              </select>
              <input
                type="text"
                value={simProduct}
                onChange={(e) => setSimProduct(e.target.value)}
                placeholder="Nome do produto"
                className="rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
              <input
                type="text"
                value={simGross}
                onChange={(e) => setSimGross(e.target.value)}
                placeholder="Valor bruto"
                className="rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
              <input
                type="text"
                value={simFee}
                onChange={(e) => setSimFee(e.target.value)}
                placeholder="Taxa"
                className="rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            {simFeedback && (
              <div className="text-xs text-white">{simFeedback}</div>
            )}

            <button
              type="submit"
              disabled={simLoading}
              className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 bg-[#08080a] hover:border-white/30 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              <span>{simLoading ? "Processando..." : "Disparar Evento de Validação"}</span>
            </button>
          </form>
        </SpotlightCard>
      </div>

      {/* Endpoint alternativo: Nexus Pay Webhook */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Receptor Nexus Pay / Webhook Alternativo
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Também compatível com eventos Nexus Pay vinculados exclusivamente à sua conta Dashfy.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-blue-400/30 bg-blue-500/10 text-sky-300">
            Receptor Ativo
          </span>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#050507] p-3 flex items-center justify-between gap-2">
          <code className="text-[11px] font-mono text-zinc-200 break-all">
            {nexusWebhookUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(nexusWebhookUrl);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2500);
            }}
            className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar</span>
          </button>
        </div>
      </SpotlightCard>
    </div>
      )}
    </div>
  );
}
