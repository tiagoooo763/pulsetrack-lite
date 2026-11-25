"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Plug,
  Power,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import type { ElevyPayIntegrationStatusPayload } from "@/lib/dashfy-types";
import type { WebhookEventRecord } from "@/lib/db";
import { formatDateTimeBR, getTransactionStatusMeta } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface ElevyPayIntegrationCardProps {
  initialStatus?: ElevyPayIntegrationStatusPayload;
  recentWebhooks?: WebhookEventRecord[];
  onRefresh: () => Promise<void>;
}

const ELEVYPAY_PANEL_URL = "https://app.elevypay.com/client-integrations.php";

function ElevyPayLogoMark() {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="url(#elevyGrad)" />
      <path
        d="M11 12.5H25L22.5 16H14.5V17.8H21.8L19.5 21H14.5V23.5H24.5L22 27H11V12.5Z"
        fill="white"
      />
      <circle cx="25.5" cy="24.5" r="2.2" fill="#34D399" />
      <defs>
        <linearGradient
          id="elevyGrad"
          x1="2"
          y1="2"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ElevyPayIntegrationCard({
  initialStatus,
  recentWebhooks = [],
  onRefresh,
}: ElevyPayIntegrationCardProps) {
  const [status, setStatus] = useState<ElevyPayIntegrationStatusPayload>(
    initialStatus || {
      connected: false,
      status: "DISCONNECTED",
      authMode: "DASHFY_TOKEN",
      webhookUrl: null,
      hasDashfySecret: false,
      hasExternalToken: false,
      lastEventAt: null,
      lastEventType: null,
      lastError: null,
      realCommunicationValidated: false,
      updatedAt: null,
    }
  );
  const [events, setEvents] = useState<WebhookEventRecord[]>(() =>
    recentWebhooks.filter((ev) => ev.gateway === "ELEVYPAY")
  );

  const [authMode, setAuthMode] = useState<
    "DASHFY_TOKEN" | "GATEWAY_TOKEN" | "HMAC_SHA256"
  >(initialStatus?.authMode || "DASHFY_TOKEN");
  const [externalToken, setExternalToken] = useState("");
  const [generatedTokenOnce, setGeneratedTokenOnce] = useState<string | null>(
    null
  );

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      setAuthMode(initialStatus.authMode);
    }
  }, [initialStatus]);

  useEffect(() => {
    setEvents(recentWebhooks.filter((ev) => ev.gateway === "ELEVYPAY"));
  }, [recentWebhooks]);

  async function reloadElevyState() {
    try {
      const res = await fetch("/api/integrations/elevypay", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        ok?: boolean;
        integration?: ElevyPayIntegrationStatusPayload;
        events?: WebhookEventRecord[];
      };
      if (json.ok && json.integration) {
        setStatus(json.integration);
        setAuthMode(json.integration.authMode);
      }
      if (json.ok && Array.isArray(json.events)) {
        setEvents(json.events);
      }
    } catch {
      // Silencioso
    }
  }

  async function handleConnect() {
    setFeedback(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/elevypay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível conectar a ElevyPay.",
        });
      } else {
        if (json.integration) setStatus(json.integration);
        if (json.generatedTokenOnce) {
          setGeneratedTokenOnce(json.generatedTokenOnce);
        }
        setFeedback({
          type: "success",
          text: json.message || "ElevyPay conectada com sucesso!",
        });
        await onRefresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao conectar integração ElevyPay.",
      });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setFeedback(null);
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/elevypay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível desconectar a ElevyPay.",
        });
      } else {
        if (json.integration) setStatus(json.integration);
        setGeneratedTokenOnce(null);
        setFeedback({
          type: "info",
          text: json.message || "ElevyPay desconectada.",
        });
        await onRefresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao desconectar a ElevyPay.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSavingConfig(true);
    try {
      const res = await fetch("/api/integrations/elevypay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          authMode,
          externalToken: externalToken.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível salvar as configurações.",
        });
      } else {
        if (json.integration) setStatus(json.integration);
        if (json.generatedTokenOnce) {
          setGeneratedTokenOnce(json.generatedTokenOnce);
        }
        setExternalToken("");
        setFeedback({
          type: "success",
          text:
            json.message ||
            "Configurações da ElevyPay salvas com criptografia no servidor.",
        });
        await onRefresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao salvar configurações da ElevyPay.",
      });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleRotateSecret() {
    setFeedback(null);
    setRotatingSecret(true);
    try {
      const res = await fetch("/api/integrations/elevypay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_secret" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Falha ao rotacionar o token.",
        });
      } else {
        if (json.integration) setStatus(json.integration);
        if (json.generatedTokenOnce) {
          setGeneratedTokenOnce(json.generatedTokenOnce);
        }
        setFeedback({
          type: "success",
          text: json.message || "Novo token seguro gerado!",
        });
        await onRefresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao rotacionar segredo.",
      });
    } finally {
      setRotatingSecret(false);
    }
  }

  async function handleTestIntegration() {
    setFeedback(null);
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/elevypay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_integration" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Falha ao diagnosticar a integração ElevyPay.",
        });
      } else {
        setFeedback({
          type: json.diagnostic?.realCommunicationValidated ? "success" : "info",
          text: json.message,
        });
        await reloadElevyState();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao testar a integração ElevyPay.",
      });
    } finally {
      setTesting(false);
    }
  }

  const webhookUrlDisplay =
    status.webhookUrl ||
    "Clique em 'Conectar' para gerar sua URL individual de webhook ElevyPay";

  return (
    <SpotlightCard className="p-5 sm:p-6 bento-card space-y-5 border-violet-500/20">
      {/* CABEÇALHO: LOGOTIPO, STATUS, CONECTAR / DESCONECTAR / TESTAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0">
            <ElevyPayLogoMark />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                ElevyPay Gateway
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  status.connected && status.realCommunicationValidated
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                    : status.connected
                      ? "border-sky-500/35 bg-sky-500/10 text-sky-300"
                      : "border-zinc-700 bg-white/[0.04] text-zinc-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status.connected && status.realCommunicationValidated
                      ? "bg-emerald-400"
                      : status.connected
                        ? "bg-sky-400"
                        : "bg-zinc-500"
                  }`}
                />
                {!status.connected
                  ? "Desconectada"
                  : status.realCommunicationValidated
                    ? "Ativa (Comunicação validada)"
                    : "Conectada (Aguardando 1º evento real)"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Painel ElevyPay:{" "}
              <a
                href={ELEVYPAY_PANEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <span>app.elevypay.com/client-integrations.php</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {" • "}
              Última comunicação:{" "}
              <span className="font-mono text-zinc-200">
                {status.lastEventAt
                  ? formatDateTimeBR(status.lastEventAt)
                  : "Nenhum evento recebido ainda"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!status.connected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-xs font-semibold text-black disabled:opacity-50"
            >
              <Plug className="w-3.5 h-3.5" />
              <span>{connecting ? "Conectando..." : "Conectar"}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTestIntegration}
                disabled={testing}
                className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {testing ? "Validando..." : "Testar integração"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* FEEDBACK */}
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : feedback.type === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-sky-500/30 bg-sky-500/10 text-sky-200"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* TOKEN GERADO (EXIBIDO APENAS UMA VEZ PARA CÓPIA SEGURA) */}
      {generatedTokenOnce && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Token de autenticação gerado pela Dashfy (copie agora — exibido apenas uma vez)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedTokenOnce);
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 2500);
              }}
              className="btn-pressable inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-300 text-black text-[11px] font-semibold"
            >
              {copiedToken ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedToken ? "Copiado" : "Copiar token"}</span>
            </button>
          </div>
          <code className="block text-[11px] font-mono text-amber-100 break-all bg-black/40 rounded-lg px-2.5 py-2 border border-amber-400/20">
            {generatedTokenOnce}
          </code>
        </div>
      )}

      {/* URL INDIVIDUAL DO WEBHOOK + AUTENTICAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* COLUNA 1: URL DO WEBHOOK & INSTRUÇÕES */}
        <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              URL Individual do Webhook (HTTPS)
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1">
              Exclusiva da sua conta Dashfy. Cadastre no painel da ElevyPay para receber pagamentos isolados.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#050507] p-3 flex items-center justify-between gap-2">
            <code className="text-[11px] font-mono text-zinc-100 break-all">
              {webhookUrlDisplay}
            </code>
            <button
              type="button"
              disabled={!status.webhookUrl}
              onClick={() => {
                if (!status.webhookUrl) return;
                navigator.clipboard.writeText(status.webhookUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2500);
              }}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold shrink-0 disabled:opacity-40"
            >
              {copiedUrl ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedUrl ? "Copiado" : "Copiar URL"}</span>
            </button>
          </div>

          <div className="space-y-2 text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06]">
            <div className="font-semibold text-zinc-200">
              Instruções de configuração na ElevyPay:
            </div>
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>
                Clique em <strong className="text-zinc-200">Conectar</strong> acima para gerar sua URL individual e seu token seguro.
              </li>
              <li>
                Acesse{" "}
                <a
                  href={ELEVYPAY_PANEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-300 underline"
                >
                  Integrações na ElevyPay
                </a>{" "}
                e cadastre a URL do webhook (método <code className="text-zinc-200">POST</code> / JSON).
              </li>
              <li>
                Se a ElevyPay solicitar um token criado por você, cole o token gerado pela Dashfy. Se a ElevyPay fornecer um token próprio ou chave HMAC, selecione o modo ao lado e salve.
              </li>
              <li>
                Ative os eventos de pagamento (pendente, aprovado, recusado, cancelado, expirado, reembolso e chargeback) e realize um pagamento real ou disparo oficial no painel da ElevyPay para validar.
              </li>
            </ol>
          </div>
        </div>

        {/* COLUNA 2: TOKEN E AUTENTICAÇÃO */}
        <form
          onSubmit={handleSaveConfig}
          className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Autenticação &amp; Token do Webhook
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Armazenado com criptografia AES-256-GCM no backend. Requisições sem autenticação são sempre rejeitadas (HTTP 401).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span
              className={`px-2 py-0.5 rounded-lg border ${
                status.hasDashfySecret
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-zinc-400"
              }`}
            >
              Segredo Dashfy: {status.hasDashfySecret ? "Configurado" : "Não gerado"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg border ${
                status.hasExternalToken
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-zinc-400"
              }`}
            >
              Token ElevyPay: {status.hasExternalToken ? "Configurado" : "Opcional"}
            </span>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1">
              Método de validação do webhook
            </label>
            <select
              value={authMode}
              onChange={(e) =>
                setAuthMode(
                  e.target.value as "DASHFY_TOKEN" | "GATEWAY_TOKEN" | "HMAC_SHA256"
                )
              }
              className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
            >
              <option value="DASHFY_TOKEN">
                Token criado pela Dashfy (header, query ?token ou body.token)
              </option>
              <option value="GATEWAY_TOKEN">
                Token fornecido pela ElevyPay (campo abaixo)
              </option>
              <option value="HMAC_SHA256">
                Assinatura criptográfica HMAC-SHA256 (x-elevypay-signature / x-signature)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-300 mb-1">
              {authMode === "HMAC_SHA256"
                ? "Segredo de assinatura HMAC da ElevyPay (opcional se usar o segredo Dashfy)"
                : "Token de autenticação fornecido pela ElevyPay"}
            </label>
            <input
              type="password"
              value={externalToken}
              onChange={(e) => setExternalToken(e.target.value)}
              placeholder={
                status.hasExternalToken
                  ? "•••••••••••• (deixe em branco para manter o atual)"
                  : "Cole aqui apenas o segredo de webhook (não use chave da API)"
              }
              className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="btn-pressable flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {savingConfig ? "Salvando..." : "Salvar configurações"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRotateSecret}
              disabled={rotatingSecret}
              className="btn-pressable inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white disabled:opacity-50"
              title="Gerar um novo segredo criptográfico da Dashfy"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${rotatingSecret ? "animate-spin" : ""}`}
              />
              <span>Novo token</span>
            </button>
          </div>
        </form>
      </div>

      {/* HISTÓRICO DE EVENTOS RECEBIDOS DA ELEVYPAY */}
      <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-300" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Histórico de Eventos Recebidos (ElevyPay)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {events.length} registro(s)
          </span>
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-6 px-4 text-center text-xs text-zinc-500">
            Nenhum evento real recebido da ElevyPay ainda. Após configurar a URL e o token em{" "}
            <span className="font-mono text-zinc-400">app.elevypay.com</span>, cada notificação aparecerá aqui em tempo real.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#050507] text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 font-semibold">Recebido em</th>
                  <th className="py-2 px-3 font-semibold">Evento</th>
                  <th className="py-2 px-3 font-semibold">Transação</th>
                  <th className="py-2 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                {events.slice(0, 10).map((ev) => {
                  const meta = getTransactionStatusMeta(ev.statusAfter || "PENDING");
                  return (
                    <tr key={ev.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 font-mono text-zinc-400 whitespace-nowrap">
                        {formatDateTimeBR(ev.receivedAt)}
                      </td>
                      <td className="py-2 px-3 font-mono text-zinc-200">
                        {ev.eventType}
                      </td>
                      <td className="py-2 px-3 font-mono text-zinc-400">
                        {ev.entityId}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
