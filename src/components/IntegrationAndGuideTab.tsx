"use client";

import React, { useState } from "react";
import type { WebhookEventRecord } from "@/lib/db";
import type { OmegaPayCredentialsResponse } from "@/lib/omegapay-types";
import { formatDateTimeBR, formatBRL } from "@/lib/format";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Search,
  Send,
  ShieldCheck,
  Terminal,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { SpotlightCard } from "./SpotlightCard";

interface IntegrationStatus {
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: string;
  apiBaseUrl: string;
  isDefaultPassword: boolean;
  nexus?: {
    hasApiCredentials: boolean;
    hasWebhookToken: boolean;
    apiBaseUrl: string;
  };
}

interface IntegrationAndGuideTabProps {
  integrationStatus: IntegrationStatus;
  recentWebhooks: WebhookEventRecord[];
  onRefreshDashboard: () => Promise<void>;
  initialGateway?: "OMEGAPAY" | "NEXUS";
}

export function IntegrationAndGuideTab({
  integrationStatus,
  recentWebhooks,
  onRefreshDashboard,
  initialGateway = "OMEGAPAY",
}: IntegrationAndGuideTabProps) {
  const [selectedGatewayTab, setSelectedGatewayTab] = useState<"OMEGAPAY" | "NEXUS">(initialGateway);

  // Formulário de credenciais OmegaPay
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [dashboardPassword, setDashboardPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsFeedback, setCredsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Formulário de credenciais Nexus
  const [nexusApiKey, setNexusApiKey] = useState("");
  const [nexusSecretKey, setNexusSecretKey] = useState("");
  const [nexusWebhookToken, setNexusWebhookToken] = useState("");
  const [savingNexusCreds, setSavingNexusCreds] = useState(false);
  const [nexusCredsFeedback, setNexusCredsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Atualização de Saldo Nexus
  const [nexusAvailable, setNexusAvailable] = useState("");
  const [nexusPending, setNexusPending] = useState("");
  const [updatingNexusBal, setUpdatingNexusBal] = useState(false);
  const [nexusBalFeedback, setNexusBalFeedback] = useState<string | null>(null);

  // Teste de credenciais OmegaPay (GET /gateway/producer/credentials)
  const [testingCreds, setTestingCreds] = useState(false);
  const [credTestResult, setCredTestResult] =
    useState<OmegaPayCredentialsResponse | null>(null);
  const [credTestError, setCredTestError] = useState<string | null>(null);

  // Consulta pontual de transação / transferência (OmegaPay)
  const [lookupType, setLookupType] = useState<"transaction" | "transfer">(
    "transaction"
  );
  const [lookupField, setLookupField] = useState<"id" | "clientIdentifier">(
    "id"
  );
  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Simulador oficial de Webhook OmegaPay
  const [simEvent, setSimEvent] = useState("TRANSACTION_PAID");
  const [simTxId, setSimTxId] = useState("1pned18asp");
  const [simProduct, setSimProduct] = useState("Mentoria PulseTrack Pro");
  const [simGross, setSimGross] = useState("297.00");
  const [simFee, setSimFee] = useState("14.85");
  const [simMethod, setSimMethod] = useState("PIX");
  const [simLoading, setSimLoading] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [copiedOmegaUrl, setCopiedOmegaUrl] = useState(false);

  // Simulador oficial de Webhook Nexus
  const [nexusSimEvent, setNexusSimEvent] = useState("TRANSACTION_PAID");
  const [nexusSimTxId, setNexusSimTxId] = useState("nex_98234a");
  const [nexusSimProduct, setNexusSimProduct] = useState("Mentoria Nexus Pro");
  const [nexusSimGross, setNexusSimGross] = useState("197.00");
  const [nexusSimFee, setNexusSimFee] = useState("9.85");
  const [nexusSimMethod, setNexusSimMethod] = useState("PIX");
  const [nexusSimLoading, setNexusSimLoading] = useState(false);
  const [nexusSimFeedback, setNexusSimFeedback] = useState<string | null>(null);
  const [copiedNexusUrl, setCopiedNexusUrl] = useState(false);

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://pulsetrack-lite.vercel.app";
  const omegaWebhookUrl = `${originUrl}/api/webhooks/omegapay`;
  const nexusWebhookUrl = `${originUrl}/api/webhooks/nexus`;

  async function handleSaveOmegaCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSavingCreds(true);
    setCredsFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_credentials",
          publicKey,
          secretKey,
          webhookToken,
          dashboardPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredsFeedback({
          type: "error",
          text: data.error || "Erro ao salvar configurações da OmegaPay.",
        });
      } else {
        setPublicKey("");
        setSecretKey("");
        setWebhookToken("");
        setDashboardPassword("");
        setCredsFeedback({
          type: "success",
          text: "Credenciais da OmegaPay salvas no servidor.",
        });
        await onRefreshDashboard();
      }
    } catch {
      setCredsFeedback({
        type: "error",
        text: "Falha de comunicação com o servidor.",
      });
    } finally {
      setSavingCreds(false);
    }
  }

  async function handleSaveNexusCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSavingNexusCreds(true);
    setNexusCredsFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_nexus_credentials",
          nexusApiKey,
          nexusSecretKey,
          nexusWebhookToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNexusCredsFeedback({
          type: "error",
          text: data.error || "Erro ao salvar credenciais da Nexus.",
        });
      } else {
        setNexusApiKey("");
        setNexusSecretKey("");
        setNexusWebhookToken("");
        setNexusCredsFeedback({
          type: "success",
          text: "Credenciais da Nexus salvas com sucesso.",
        });
        await onRefreshDashboard();
      }
    } catch {
      setNexusCredsFeedback({
        type: "error",
        text: "Falha de comunicação com o servidor.",
      });
    } finally {
      setSavingNexusCreds(false);
    }
  }

  async function handleUpdateNexusBalance(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingNexusBal(true);
    setNexusBalFeedback(null);
    try {
      const avail = Number(nexusAvailable.replace(",", ".")) || 0;
      const pend = Number(nexusPending.replace(",", ".")) || 0;
      const res = await fetch("/api/nexus/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available: avail,
          pending: pend,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNexusBalFeedback(`Erro: ${json.error || "Falha ao salvar saldo"}`);
      } else {
        setNexusBalFeedback(`Saldo da Nexus atualizado: ${formatBRL(avail)} disponível.`);
        setNexusAvailable("");
        setNexusPending("");
        await onRefreshDashboard();
      }
    } catch {
      setNexusBalFeedback("Erro ao atualizar saldo da Nexus no servidor.");
    } finally {
      setUpdatingNexusBal(false);
    }
  }

  async function handleTestOmegaCredentials() {
    setTestingCreds(true);
    setCredTestError(null);
    setCredTestResult(null);
    try {
      const res = await fetch("/api/omegapay/credentials", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCredTestError(
          data.error || "Credenciais inválidas ou sem comunicação com a OmegaPay."
        );
      } else {
        setCredTestResult(data.credentials);
      }
    } catch {
      setCredTestError("Erro ao executar teste de credenciais.");
    } finally {
      setTestingCreds(false);
    }
  }

  async function handleOmegaLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const params = new URLSearchParams({
        type: lookupType,
        [lookupField]: lookupValue.trim(),
        sync: "true",
      });
      const res = await fetch(`/api/omegapay/lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLookupError(
          data.error || "Registro não encontrado ou erro na consulta."
        );
      } else {
        setLookupResult(data.result);
        await onRefreshDashboard();
      }
    } catch {
      setLookupError("Erro ao consultar endpoint oficial da OmegaPay.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSimulateOmegaWebhook(e: React.FormEvent) {
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
          transactionId: simTxId.trim() || "1pned18asp",
          transferId: simTxId.trim() || "wth_01",
          productName: simProduct.trim() || "Mentoria PulseTrack Pro",
          grossAmount: Number(simGross) || 297,
          feeAmount: Number(simFee) || 14.85,
          paymentMethod: simMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSimFeedback(
          `Erro: ${data.error || data.result?.error || "Falha ao simular"}`
        );
      } else if (data.result?.duplicate) {
        setSimFeedback(
          `Idempotência confirmada: o evento ${simEvent} para o ID "${simTxId}" já havia sido processado (HTTP 200).`
        );
      } else {
        setSimFeedback(
          `Evento OmegaPay ${simEvent} processado com sucesso para o ID "${simTxId}" (HTTP 200).`
        );
        await onRefreshDashboard();
      }
    } catch {
      setSimFeedback("Erro ao disparar simulação de webhook.");
    } finally {
      setSimLoading(false);
    }
  }

  async function handleSimulateNexusWebhook(e: React.FormEvent) {
    e.preventDefault();
    setNexusSimLoading(true);
    setNexusSimFeedback(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_nexus_webhook",
          event: nexusSimEvent,
          transactionId: nexusSimTxId.trim() || `nex_${Date.now().toString(36)}`,
          productName: nexusSimProduct.trim() || "Mentoria Nexus Pro",
          grossAmount: Number(nexusSimGross) || 197,
          feeAmount: Number(nexusSimFee) || 9.85,
          paymentMethod: nexusSimMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNexusSimFeedback(
          `Erro: ${data.error || data.result?.error || "Falha ao simular"}`
        );
      } else if (data.result?.duplicate) {
        setNexusSimFeedback(
          `Idempotência Nexus confirmada: o evento para "${nexusSimTxId}" já foi gravado sem duplicar.`
        );
      } else {
        setNexusSimFeedback(
          `Evento Nexus processado com sucesso! A venda já consta na aba da Nexus (HTTP 200).`
        );
        await onRefreshDashboard();
      }
    } catch {
      setNexusSimFeedback("Erro ao disparar simulação de webhook Nexus.");
    } finally {
      setNexusSimLoading(false);
    }
  }

  function copyUrl(text: string, type: "omega" | "nexus") {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
      if (type === "omega") {
        setCopiedOmegaUrl(true);
        setTimeout(() => setCopiedOmegaUrl(false), 2000);
      } else {
        setCopiedNexusUrl(true);
        setTimeout(() => setCopiedNexusUrl(false), 2000);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Seletor de Gateway em Configuração */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <button
          type="button"
          onClick={() => setSelectedGatewayTab("OMEGAPAY")}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            selectedGatewayTab === "OMEGAPAY"
              ? "bg-white text-black shadow-sm"
              : "bg-[#0c0c0e] text-zinc-400 hover:text-white border border-white/10"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Configurar OmegaPay</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedGatewayTab("NEXUS")}
          className={`btn-pressable flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            selectedGatewayTab === "NEXUS"
              ? "bg-white text-black shadow-sm"
              : "bg-[#0c0c0e] text-zinc-400 hover:text-white border border-white/10"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Configurar Nexus Pay</span>
        </button>
      </div>

      {/* ================= ABA DE INTEGRAÇÃO NEXUS PAY ================= */}
      {selectedGatewayTab === "NEXUS" && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Endpoint Bar Nexus */}
          <SpotlightCard className="p-5 sm:p-6 bento-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">
                    Endpoint de Webhooks Nexus Pay (HTTP POST &bull; JSON)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Cadastre esta URL em <code className="text-zinc-200">Webhooks / Integrações</code> no painel da Nexus para receber vendas e estornos em tempo real.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#050507] border border-white/10 rounded-xl p-1.5 pl-3">
                <code className="text-xs text-zinc-200 font-mono truncate max-w-[280px] sm:max-w-[420px]">
                  {nexusWebhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(nexusWebhookUrl, "nexus")}
                  className="btn-pressable flex items-center gap-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 px-3 py-1.5 text-xs font-semibold shadow-sm transition shrink-0"
                >
                  {copiedNexusUrl ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </SpotlightCard>

          {/* Grid: Saldo Nexus + Credenciais Nexus */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Atualizador Rápido de Saldo Nexus */}
            <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Saldo da Nexus Pay
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Defina o saldo disponível e a liberar da Nexus para exibição isolada na aba Nexus
                  </p>
                </div>
              </div>

              {nexusBalFeedback && (
                <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-zinc-200">
                  {nexusBalFeedback}
                </div>
              )}

              <form onSubmit={handleUpdateNexusBalance} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Saldo Disponível (R$)
                    </label>
                    <input
                      type="text"
                      required
                      value={nexusAvailable}
                      onChange={(e) => setNexusAvailable(e.target.value)}
                      placeholder="Ex: 1540.50"
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Saldo Pendente / A Liberar (R$)
                    </label>
                    <input
                      type="text"
                      value={nexusPending}
                      onChange={(e) => setNexusPending(e.target.value)}
                      placeholder="Ex: 850.00"
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingNexusBal}
                  className="btn-pressable w-full rounded-xl bg-white text-black hover:bg-zinc-100 disabled:opacity-50 font-semibold text-xs py-2.5 px-4 shadow-sm transition"
                >
                  {updatingNexusBal ? "Salvando..." : "Atualizar Saldo da Nexus"}
                </button>
              </form>

              <div className="pt-2 text-[11px] text-zinc-500">
                O saldo da Nexus fica 100% isolado do saldo da OmegaPay e compõe a visão consolidada.
              </div>
            </SpotlightCard>

            {/* Credenciais Opcionais de API Nexus */}
            <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Credenciais e Token da Nexus (Opcional)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Valide assinaturas de webhook e configure integração direta
                  </p>
                </div>
              </div>

              {nexusCredsFeedback && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    nexusCredsFeedback.type === "success"
                      ? "border-white/20 bg-white/5 text-zinc-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {nexusCredsFeedback.text}
                </div>
              )}

              <form onSubmit={handleSaveNexusCredentials} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Token Secreto do Webhook Nexus (Opcional)
                  </label>
                  <input
                    type="password"
                    value={nexusWebhookToken}
                    onChange={(e) => setNexusWebhookToken(e.target.value)}
                    placeholder="Token ou segredo do webhook gerado na Nexus"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    API Key da Nexus (Opcional)
                  </label>
                  <input
                    type="password"
                    value={nexusApiKey}
                    onChange={(e) => setNexusApiKey(e.target.value)}
                    placeholder="Chave pública ou API key da Nexus"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingNexusCreds}
                  className="btn-pressable w-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 font-semibold text-xs py-2.5 px-4 shadow-sm transition"
                >
                  {savingNexusCreds ? "Salvando..." : "Salvar Configurações Nexus"}
                </button>
              </form>
            </SpotlightCard>
          </div>

          {/* Testador de Webhook Nexus */}
          <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Simulador de Vendas Nexus Pay
                </h3>
                <p className="text-xs text-zinc-400">
                  Teste o recebimento de uma venda da Nexus e veja ela aparecer instantaneamente na aba Nexus e no ROI isolado
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSimulateNexusWebhook}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Evento Nexus
                </label>
                <select
                  value={nexusSimEvent}
                  onChange={(e) => setNexusSimEvent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                >
                  <option value="TRANSACTION_PAID">Compra Aprovada (PAID)</option>
                  <option value="TRANSACTION_CREATED">Pedido Criado (PENDING)</option>
                  <option value="TRANSACTION_REFUNDED">Reembolsado (REFUNDED)</option>
                  <option value="TRANSACTION_CHARGED_BACK">Chargeback</option>
                  <option value="TRANSACTION_CANCELED">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  ID Transação Nexus
                </label>
                <input
                  type="text"
                  value={nexusSimTxId}
                  onChange={(e) => setNexusSimTxId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Produto Nexus
                </label>
                <input
                  type="text"
                  value={nexusSimProduct}
                  onChange={(e) => setNexusSimProduct(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Bruto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={nexusSimGross}
                    onChange={(e) => setNexusSimGross(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Taxa (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={nexusSimFee}
                    onChange={(e) => setNexusSimFee(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={nexusSimMethod}
                  onChange={(e) => setNexusSimMethod(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#050507] px-2 py-2 text-xs text-white focus:border-white focus:outline-none transition-all"
                >
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="BOLETO">Boleto</option>
                </select>
                <button
                  type="submit"
                  disabled={nexusSimLoading}
                  className="btn-pressable flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white text-black hover:bg-zinc-100 disabled:opacity-50 text-xs font-semibold py-2 px-3 shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{nexusSimLoading ? "..." : "Disparar"}</span>
                </button>
              </div>
            </form>

            {nexusSimFeedback && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">
                {nexusSimFeedback}
              </div>
            )}
          </SpotlightCard>

          {/* Guia Oficial de Conexão Nexus */}
          <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Como conectar a Nexus Pay na Dashfy
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-400">
              <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5">
                <span className="text-white font-medium block">1. Copiar URL do Webhook</span>
                <p className="leading-relaxed">
                  Copie a URL de webhook da Nexus acima (<code className="text-zinc-300">/api/webhooks/nexus</code>).
                </p>
              </div>
              <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5">
                <span className="text-white font-medium block">2. Cadastrar na Nexus Pay</span>
                <p className="leading-relaxed">
                  No painel da Nexus Pay em <code className="text-zinc-300">Webhooks / Integrações</code>, cole a URL e ative os eventos de vendas e estornos.
                </p>
              </div>
              <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5">
                <span className="text-white font-medium block">3. Saldo &amp; ROI Isolados</span>
                <p className="leading-relaxed">
                  Ao clicar na aba da Nexus na Dashfy, todo o faturamento, taxas, saldo e ROI passam a ser exibidos sem misturar com a OmegaPay.
                </p>
              </div>
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* ================= ABA DE INTEGRAÇÃO OMEGAPAY ================= */}
      {selectedGatewayTab === "OMEGAPAY" && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Endpoint Bar OmegaPay */}
          <SpotlightCard className="p-5 sm:p-6 bento-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">
                    Endpoint de Webhooks OmegaPay (HTTP POST &bull; JSON)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Cadastre esta URL em <code className="text-zinc-200">Configurações &gt; Webhooks</code> no painel da OmegaPay
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#050507] border border-white/10 rounded-xl p-1.5 pl-3">
                <code className="text-xs text-zinc-200 font-mono truncate max-w-[280px] sm:max-w-[420px]">
                  {omegaWebhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyUrl(omegaWebhookUrl, "omega")}
                  className="btn-pressable flex items-center gap-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 px-3 py-1.5 text-xs font-semibold shadow-sm transition shrink-0"
                >
                  {copiedOmegaUrl ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </SpotlightCard>

          {/* Grid: Credenciais + Consultas OmegaPay */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Credenciais no Servidor */}
            <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      Credenciais da API OmegaPay
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      {integrationStatus.apiBaseUrl}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestOmegaCredentials}
                  disabled={testingCreds}
                  className="btn-pressable flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      testingCreds ? "animate-spin" : ""
                    }`}
                  />
                  <span>Testar Credenciais (GET)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-[#050507] border border-white/10 p-3">
                  <span className="text-zinc-500 block">Chaves da API (GET)</span>
                  <span className="font-medium mt-1 inline-block text-white">
                    {integrationStatus.hasApiCredentials
                      ? "Configuradas no servidor"
                      : "Pendentes"}
                  </span>
                </div>
                <div className="rounded-xl bg-[#050507] border border-white/10 p-3">
                  <span className="text-zinc-500 block">Token do Webhook</span>
                  <span className="font-medium mt-1 inline-block text-white">
                    {integrationStatus.hasWebhookToken
                      ? "Configurado no servidor"
                      : "Pendente"}
                  </span>
                </div>
              </div>

              {credTestResult && (
                <div className="rounded-xl border border-white/20 bg-white/[0.03] p-3 text-xs space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Credencial Válida: {credTestResult.name}</span>
                  </div>
                  <p className="text-zinc-400">
                    Acesso Total: {credTestResult.grantAllPermissions ? "Sim" : "Não"}
                  </p>
                  <p className="text-zinc-400">
                    Permissões:{" "}
                    {credTestResult.permissions.length > 0
                      ? credTestResult.permissions.join(", ")
                      : "Nenhuma específica listada"}
                  </p>
                </div>
              )}

              {credTestError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <strong>Retorno da OmegaPay:</strong> {credTestError}
                </div>
              )}

              {credsFeedback && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    credsFeedback.type === "success"
                      ? "border-white/20 bg-white/5 text-zinc-200"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {credsFeedback.text}
                </div>
              )}

              <form onSubmit={handleSaveOmegaCredentials} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Chave Pública (<code className="text-zinc-400">x-public-key</code>)
                  </label>
                  <input
                    type="password"
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Chave Secreta (<code className="text-zinc-400">x-secret-key</code>)
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Token de Validação do Webhook (<code className="text-zinc-400">payload.token</code>)
                  </label>
                  <input
                    type="password"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    placeholder="Token gerado no painel da OmegaPay"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Nova Senha de Acesso ao Painel (Opcional)
                  </label>
                  <input
                    type="password"
                    value={dashboardPassword}
                    onChange={(e) => setDashboardPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingCreds}
                  className="btn-pressable w-full rounded-xl bg-white text-black hover:bg-zinc-100 disabled:opacity-50 font-semibold text-xs py-2.5 px-4 shadow-sm transition"
                >
                  {savingCreds ? "Salvando..." : "Salvar Credenciais da OmegaPay"}
                </button>
              </form>
            </SpotlightCard>

            {/* Card 2: Consulta Pontual na API */}
            <SpotlightCard className="p-5 sm:p-6 space-y-4 flex flex-col justify-between bento-card">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      Consulta Sob Demanda (GET)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Consulte transações ou transferências sem polling contínuo
                    </p>
                  </div>
                </div>

                <form onSubmit={handleOmegaLookup} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Recurso Oficial
                      </label>
                      <select
                        value={lookupType}
                        onChange={(e) =>
                          setLookupType(e.target.value as "transaction" | "transfer")
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                      >
                        <option value="transaction">Buscar transação</option>
                        <option value="transfer">Buscar transferência</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Parâmetro
                      </label>
                      <select
                        value={lookupField}
                        onChange={(e) =>
                          setLookupField(e.target.value as "id" | "clientIdentifier")
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                      >
                        <option value="id">id (OmegaPay)</option>
                        <option value="clientIdentifier">clientIdentifier</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lookupValue}
                      onChange={(e) => setLookupValue(e.target.value)}
                      placeholder="ID da transação ou identificador"
                      className="flex-1 rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="btn-pressable rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 text-xs font-medium px-4 py-2 transition shrink-0"
                    >
                      {lookupLoading ? "Buscando..." : "Consultar"}
                    </button>
                  </div>
                </form>

                {lookupError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {lookupError}
                  </div>
                )}

                {lookupResult && (
                  <div className="rounded-xl border border-white/10 bg-[#050507] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">Resposta Oficial</span>
                      <span className="text-zinc-500 font-mono">
                        ID: {String(lookupResult.id || "—")}
                      </span>
                    </div>
                    <pre className="text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-40 p-2 bg-[#08080a] rounded-lg border border-white/5">
                      {JSON.stringify(lookupResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white/[0.02] border border-white/10 p-3 text-xs text-zinc-400 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                <div>
                  <strong>Aviso:</strong> A Dashfy utiliza webhooks em tempo real e consultas sob demanda para evitar bloqueios por excesso de requisições.
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* Simulador Oficial OmegaPay */}
          <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Simulador de Webhooks OmegaPay
                </h3>
                <p className="text-xs text-zinc-400">
                  Dispara notificações com a estrutura oficial para validar o fluxo em tempo real
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSimulateOmegaWebhook}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Evento Oficial
                </label>
                <select
                  value={simEvent}
                  onChange={(e) => setSimEvent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                >
                  <optgroup label="Pagamentos">
                    <option value="TRANSACTION_CREATED">TRANSACTION_CREATED (Criada)</option>
                    <option value="TRANSACTION_PAID">TRANSACTION_PAID (Aprovada)</option>
                    <option value="TRANSACTION_CANCELED">TRANSACTION_CANCELED (Cancelada)</option>
                    <option value="TRANSACTION_REFUNDED">TRANSACTION_REFUNDED (Reembolsada)</option>
                    <option value="TRANSACTION_CHARGED_BACK">TRANSACTION_CHARGED_BACK (Chargeback)</option>
                  </optgroup>
                  <optgroup label="Transferências">
                    <option value="TRANSFER_CREATED">TRANSFER_CREATED (Solicitada)</option>
                    <option value="TRANSFER_COMPLETED">TRANSFER_COMPLETED (Concluída)</option>
                    <option value="TRANSFER_FAILED">TRANSFER_FAILED (Falhou)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  ID da Transação
                </label>
                <input
                  type="text"
                  value={simTxId}
                  onChange={(e) => setSimTxId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Produto
                </label>
                <input
                  type="text"
                  value={simProduct}
                  onChange={(e) => setSimProduct(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Bruto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simGross}
                    onChange={(e) => setSimGross(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Taxa (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simFee}
                    onChange={(e) => setSimFee(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#050507] px-2 py-2 text-xs text-white focus:border-white focus:outline-none transition-all"
                >
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="BOLETO">Boleto</option>
                </select>
                <button
                  type="submit"
                  disabled={simLoading}
                  className="btn-pressable flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white text-black hover:bg-zinc-100 disabled:opacity-50 text-xs font-semibold py-2 px-3 shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{simLoading ? "..." : "Disparar"}</span>
                </button>
              </div>
            </form>

            {simFeedback && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                {simFeedback}
              </div>
            )}
          </SpotlightCard>
        </div>
      )}

      {/* Registro Auditável Unificado de Webhooks */}
      <SpotlightCard className="p-5 sm:p-6 space-y-3 bento-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Histórico de Webhooks Recebidos
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Últimos {recentWebhooks.length} eventos registrados
          </span>
        </div>

        {recentWebhooks.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
            Nenhum evento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400">
                  <th className="py-2.5 px-3.5 font-medium">Data / Hora</th>
                  <th className="py-2.5 px-3.5 font-medium">Gateway</th>
                  <th className="py-2.5 px-3.5 font-medium">Evento Oficial</th>
                  <th className="py-2.5 px-3.5 font-medium">ID da Entidade</th>
                  <th className="py-2.5 px-3.5 font-medium">Status Resultante</th>
                  <th className="py-2.5 px-3.5 font-medium">Idempotência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                {recentWebhooks.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3.5 text-zinc-400 font-mono whitespace-nowrap">
                      {formatDateTimeBR(ev.receivedAt)}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          ev.gateway === "NEXUS"
                            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ev.gateway === "NEXUS" ? "bg-cyan-400" : "bg-emerald-400"
                          }`}
                        />
                        {ev.gateway === "NEXUS" ? "Nexus Pay" : "OmegaPay"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-white">
                      {ev.eventType}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-zinc-300">
                      {ev.entityId}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-zinc-400">
                      {ev.statusAfter || "—"}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-zinc-500 truncate max-w-[200px]">
                      {ev.dedupeKey}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
