"use client";

import React, { useState } from "react";
import type { WebhookEventRecord } from "@/lib/db";
import type { OmegaPayCredentialsResponse } from "@/lib/omegapay-types";
import { formatDateTimeBR } from "@/lib/format";
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
} from "lucide-react";
import { SpotlightCard } from "./SpotlightCard";

interface IntegrationStatus {
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: string;
  apiBaseUrl: string;
  isDefaultPassword: boolean;
}

interface IntegrationAndGuideTabProps {
  integrationStatus: IntegrationStatus;
  recentWebhooks: WebhookEventRecord[];
  onRefreshDashboard: () => Promise<void>;
}

export function IntegrationAndGuideTab({
  integrationStatus,
  recentWebhooks,
  onRefreshDashboard,
}: IntegrationAndGuideTabProps) {
  // Formulário de credenciais
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [dashboardPassword, setDashboardPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsFeedback, setCredsFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Teste de credenciais (GET /gateway/producer/credentials)
  const [testingCreds, setTestingCreds] = useState(false);
  const [credTestResult, setCredTestResult] =
    useState<OmegaPayCredentialsResponse | null>(null);
  const [credTestError, setCredTestError] = useState<string | null>(null);

  // Consulta pontual de transação / transferência
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

  // Simulador oficial de Webhook
  const [simEvent, setSimEvent] = useState("TRANSACTION_PAID");
  const [simTxId, setSimTxId] = useState("1pned18asp");
  const [simProduct, setSimProduct] = useState("Mentoria PulseTrack Pro");
  const [simGross, setSimGross] = useState("297.00");
  const [simFee, setSimFee] = useState("14.85");
  const [simMethod, setSimMethod] = useState("PIX");
  const [simLoading, setSimLoading] = useState(false);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const webhookEndpointUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/omegapay`
      : "https://seu-dominio.vercel.app/api/webhooks/omegapay";

  async function handleSaveCredentials(e: React.FormEvent) {
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
          text: data.error || "Erro ao salvar configurações.",
        });
      } else {
        setPublicKey("");
        setSecretKey("");
        setWebhookToken("");
        setDashboardPassword("");
        setCredsFeedback({
          type: "success",
          text: "Credenciais armazenadas com segurança no servidor.",
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

  async function handleTestCredentials() {
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

  async function handleLookup(e: React.FormEvent) {
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
          `Idempotência confirmada: o evento ${simEvent} para o ID "${simTxId}" já havia sido processado e não foi duplicado (HTTP 200).`
        );
      } else {
        setSimFeedback(
          `Evento ${simEvent} processado com sucesso para o ID "${simTxId}" (HTTP 200).`
        );
        await onRefreshDashboard();
      }
    } catch {
      setSimFeedback("Erro ao disparar simulação de webhook.");
    } finally {
      setSimLoading(false);
    }
  }

  function copyWebhookUrl() {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(webhookEndpointUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  }

  return (
    <div className="space-y-4">
      {/* Endpoint Bar */}
      <SpotlightCard className="p-5 sm:p-6 bento-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                Endpoint Receptor de Webhooks (HTTP POST &bull; JSON)
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Cadastre esta URL em <code className="text-zinc-200">Configurações &gt; Webhooks</code> no painel da OmegaPay
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#050507] border border-white/10 rounded-xl p-1.5 pl-3">
            <code className="text-xs text-zinc-200 font-mono truncate max-w-[280px] sm:max-w-[420px]">
              {webhookEndpointUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhookUrl}
              className="btn-pressable flex items-center gap-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 px-3 py-1.5 text-xs font-semibold shadow-sm transition shrink-0"
            >
              {copiedUrl ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
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

      {/* Grid: Credenciais + Consultas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Credenciais no Servidor */}
        <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-white" />
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
              onClick={handleTestCredentials}
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

          <form onSubmit={handleSaveCredentials} className="space-y-3">
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
              {savingCreds ? "Salvando..." : "Salvar Credenciais no Servidor"}
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

            <form onSubmit={handleLookup} className="space-y-3">
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
              <strong>Aviso da Documentação:</strong> O PulseTrack Lite utiliza webhooks em tempo real e consultas sob demanda para evitar bloqueios por excesso de requisições.
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Simulador Oficial de Webhooks */}
      <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Testador Local de Webhooks OmegaPay
            </h3>
            <p className="text-xs text-zinc-400">
              Dispara notificações com a estrutura oficial para validar o fluxo em tempo real
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSimulateWebhook}
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
                className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
                className="w-full rounded-xl border border-white/10 bg-[#050507] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={simMethod}
              onChange={(e) => setSimMethod(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#050507] px-2 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-zinc-200">
            {simFeedback}
          </div>
        )}
      </SpotlightCard>

      {/* Registro Auditável de Webhooks */}
      <SpotlightCard className="p-5 sm:p-6 space-y-3 bento-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Histórico de Webhooks Recebidos
            </h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Últimos {recentWebhooks.length} eventos
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
                  <th className="py-2.5 px-3.5 font-medium">Recebido em</th>
                  <th className="py-2.5 px-3.5 font-medium">Evento Oficial</th>
                  <th className="py-2.5 px-3.5 font-medium">ID da Entidade</th>
                  <th className="py-2.5 px-3.5 font-medium">Status Resultante</th>
                  <th className="py-2.5 px-3.5 font-medium">Chave de Idempotência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                {recentWebhooks.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3.5 text-zinc-400 font-mono whitespace-nowrap">
                      {formatDateTimeBR(ev.receivedAt)}
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

      {/* Guia Passo a Passo Oficial */}
      <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Guia Rápido: Conectar na OmegaPay
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-400">
          <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5 hover:border-white/20 transition-colors">
            <span className="text-white font-medium block">1. Criar Webhook</span>
            <p className="leading-relaxed">
              No painel da OmegaPay em <code className="text-zinc-300">Configurações &gt; Webhooks</code>, clique em Criar, cole a URL acima e selecione os eventos oficiais.
            </p>
          </div>
          <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5 hover:border-white/20 transition-colors">
            <span className="text-white font-medium block">2. Copiar Credenciais</span>
            <p className="leading-relaxed">
              Copie o Token de validação do webhook e as chaves <code className="text-zinc-300">x-public-key</code> e <code className="text-zinc-300">x-secret-key</code> em <code className="text-zinc-300">Configurações &gt; Credenciais</code>.
            </p>
          </div>
          <div className="rounded-xl bg-[#050507] border border-white/10 p-4 space-y-1.5 hover:border-white/20 transition-colors">
            <span className="text-white font-medium block">3. Salvar e Conferir</span>
            <p className="leading-relaxed">
              Cole as chaves no formulário acima e clique em Salvar. As vendas e o saldo serão atualizados automaticamente no Supabase.
            </p>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
