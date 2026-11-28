"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { TikTokConnectionPublicRecord } from "@/lib/db";
import type {
  TikTokOptimizationSignalStatus,
  TikTokReadOnlyReportResult,
  TikTokReportDataLevel,
} from "@/lib/tiktok-client";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface TikTokOAuthPanelProps {
  dashboardId: string;
  onSynced?: () => Promise<void>;
}

interface FinancialCrossCheck {
  gatewayGrossRevenue: number;
  gatewayNetRevenue: number;
  gatewayFees: number;
  gatewayApprovedSales: number;
  tiktokSpend: number;
  realProfit: number;
  realRoas: number;
  realCpa: number;
}

function getOptimizationBadgeClass(status: TikTokOptimizationSignalStatus): string {
  switch (status) {
    case "SCALE":
      return "border-emerald-500/35 bg-emerald-500/15 text-emerald-300";
    case "CONTROL_CPA":
      return "border-rose-500/35 bg-rose-500/15 text-rose-300";
    case "OPTIMIZE_CREATIVE":
    case "OPTIMIZE_CHECKOUT":
    case "FATIGUE":
      return "border-amber-500/35 bg-amber-500/15 text-amber-200";
    case "LEARNING":
      return "border-sky-500/35 bg-sky-500/15 text-sky-300";
    default:
      return "border-white/15 bg-white/[0.05] text-zinc-300";
  }
}

interface ConnectionsApiResponse {
  ok: boolean;
  configured: boolean;
  callbackUrl: string;
  connections: TikTokConnectionPublicRecord[];
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function TikTokOAuthPanel({ dashboardId, onSynced }: TikTokOAuthPanelProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState(
    "https://www.usedashfy.com.br/api/integrations/tiktok/callback"
  );
  const [connections, setConnections] = useState<TikTokConnectionPublicRecord[]>(
    []
  );
  const [connectionLabel, setConnectionLabel] = useState("");
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Estado da consulta somente-leitura de relatórios e otimização
  const defaultDates = useMemo(() => getDefaultDateRange(), []);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [dataLevel, setDataLevel] =
    useState<TikTokReportDataLevel>("AUCTION_CAMPAIGN");
  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [loadingReport, setLoadingReport] = useState(false);
  const [syncingReport, setSyncingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportData, setReportData] =
    useState<TikTokReadOnlyReportResult | null>(null);
  const [crossCheck, setCrossCheck] = useState<FinancialCrossCheck | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/tiktok/connections", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as ConnectionsApiResponse;
      if (json.ok) {
        setConfigured(Boolean(json.configured));
        if (json.callbackUrl) setCallbackUrl(json.callbackUrl);
        setConnections(Array.isArray(json.connections) ? json.connections : []);
      }
    } catch {
      // Falha silenciosa no carregamento inicial
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const authorizedAccountOptions = useMemo(() => {
    const items: Array<{
      value: string;
      connectionId: string;
      connectionLabel: string;
      advertiserId: string;
      advertiserName: string;
    }> = [];
    for (const conn of connections) {
      if (conn.status === "REVOKED") continue;
      for (const adv of conn.advertisers) {
        items.push({
          value: `${conn.id}::${adv.advertiserId}`,
          connectionId: conn.id,
          connectionLabel: conn.label,
          advertiserId: adv.advertiserId,
          advertiserName: adv.advertiserName,
        });
      }
    }
    return items;
  }, [connections]);

  useEffect(() => {
    if (
      authorizedAccountOptions.length > 0 &&
      !authorizedAccountOptions.some((o) => o.value === selectedTarget)
    ) {
      setSelectedTarget(authorizedAccountOptions[0].value);
    }
  }, [authorizedAccountOptions, selectedTarget]);

  function handleConnectClick() {
    const params = new URLSearchParams({ dashboardId });
    if (connectionLabel.trim()) {
      params.set("label", connectionLabel.trim());
    }
    window.location.href = `/api/integrations/tiktok/authorize?${params.toString()}`;
  }

  async function handleRefreshConnection(connectionId: string) {
    setBusyId(connectionId);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/tiktok/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text:
            json.error ||
            "Não foi possível revalidar as contas autorizadas no TikTok.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Contas de anúncios e Business Centers autorizados atualizados com sucesso.",
        });
      }
      await loadConnections();
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao consultar a TikTok Marketing API.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    setBusyId(connectionId);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/integrations/tiktok/connections?id=${encodeURIComponent(connectionId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setFeedback({
          type: "success",
          text: "Conexão TikTok Business removida desta conta.",
        });
        setReportData(null);
        await loadConnections();
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível desconectar esta conta.",
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function runReportQuery(syncToDashboard: boolean) {
    setReportError(null);
    setReportNotice(null);

    const chosen = authorizedAccountOptions.find(
      (o) => o.value === selectedTarget
    );
    if (!chosen) {
      setReportError("Selecione uma conta de anúncios autorizada.");
      return;
    }

    if (syncToDashboard) setSyncingReport(true);
    else {
      setLoadingReport(true);
      setReportData(null);
      setCrossCheck(null);
    }

    try {
      const res = await fetch("/api/integrations/tiktok/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: chosen.connectionId,
          advertiserId: chosen.advertiserId,
          startDate,
          endDate,
          dataLevel,
          syncToDashboard,
          dashboardId,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: TikTokReadOnlyReportResult;
        financialCrossCheck?: FinancialCrossCheck;
        syncedCount?: number;
      };
      if (!res.ok || !json.ok || !json.report) {
        setReportError(
          json.error ||
            "Não foi possível consultar o relatório na TikTok Marketing API."
        );
      } else {
        setReportData(json.report);
        if (json.financialCrossCheck) {
          setCrossCheck(json.financialCrossCheck);
        }
        if (syncToDashboard) {
          setReportNotice(
            json.syncedCount && json.syncedCount > 0
              ? `${json.syncedCount} registro(s) sincronizado(s) para o Resumo, TikTok Ads e Minhas Métricas!`
              : "Dados já estavam sincronizados para este período (nenhum registro duplicado)."
          );
          if (onSynced) await onSynced();
        }
      }
    } catch {
      setReportError("Erro de comunicação ao consultar relatórios do TikTok.");
    } finally {
      setLoadingReport(false);
      setSyncingReport(false);
    }
  }

  async function handleFetchReport(e: React.FormEvent) {
    e.preventDefault();
    await runReportQuery(false);
  }

  const activeCount = connections.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  TikTok Marketing API (OAuth 2.0 — Leitura &amp; Relatórios)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeCount > 0
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                      : configured
                        ? "border-white/15 bg-white/[0.05] text-zinc-200"
                        : "border-amber-500/35 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {activeCount > 0
                    ? `${activeCount} conexão(ões) ativa(s)`
                    : configured
                      ? "Pronto para conectar"
                      : "Aguardando credenciais no servidor"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Conecte um ou mais Business Centers e contas de anúncios
                autorizadas para consultar gastos e relatórios em modo{" "}
                <strong className="text-zinc-200">somente-leitura</strong>.
                Nenhum anúncio ou campanha é criado, editado ou excluído.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <input
              type="text"
              value={connectionLabel}
              onChange={(e) => setConnectionLabel(e.target.value)}
              maxLength={60}
              placeholder="Rótulo opcional (ex: BC Principal)"
              className="rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none sm:w-52"
            />
            <button
              type="button"
              onClick={handleConnectClick}
              className="btn-pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Conectar TikTok Business</span>
            </button>
          </div>
        </div>

        {/* Callback URL registrada para o Portal TikTok */}
        <div className="rounded-xl border border-white/10 bg-[#050507] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Advertiser Redirect URL (Callback OAuth oficial)
            </span>
            <code className="text-[11px] font-mono text-zinc-200 break-all">
              {callbackUrl}
            </code>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(callbackUrl);
              setCopiedCallback(true);
              setTimeout(() => setCopiedCallback(false), 2200);
            }}
            className="btn-pressable inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-medium shrink-0"
          >
            {copiedCallback ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedCallback ? "Copiado" : "Copiar URL"}</span>
          </button>
        </div>

        {!loading && !configured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Configure as credenciais do aplicativo TikTok na Vercel
              </div>
              <p className="text-amber-100/80 leading-relaxed">
                Adicione <code className="font-mono">TIKTOK_APP_ID</code> e{" "}
                <code className="font-mono">TIKTOK_APP_SECRET</code> nas
                Environment Variables do servidor (sem prefixo{" "}
                <code className="font-mono">NEXT_PUBLIC_</code>) e faça redeploy
                para habilitar a troca do código OAuth.
              </p>
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Lista de Conexões / BCs / Contas Autorizadas */}
        {loading ? (
          <div className="text-xs text-zinc-500 py-3">
            Carregando conexões TikTok Business...
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#08080a]/60 p-4 text-xs text-zinc-400 flex items-center justify-between gap-3">
            <span>
              Nenhuma conta TikTok Business conectada ainda. Você pode conectar
              múltiplos Business Centers e contas de anúncios nesta operação.
            </span>
            <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => {
              const isBusy = busyId === conn.id;
              return (
                <div
                  key={conn.id}
                  className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {conn.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            conn.status === "ACTIVE"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : conn.status === "REVOKED"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {conn.status === "ACTIVE"
                            ? "Conectada"
                            : conn.status === "REVOKED"
                              ? "Token expirado / revogado"
                              : "Atenção"}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {conn.advertisers.length} conta(s) &bull;{" "}
                          {conn.businessCenters.length} BC(s)
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Última verificação:{" "}
                        {conn.lastSyncAt
                          ? formatDateTimeBR(conn.lastSyncAt)
                          : "—"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRefreshConnection(conn.id)}
                        disabled={isBusy}
                        className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-white disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isBusy ? "animate-spin" : ""}`}
                        />
                        <span>Atualizar contas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={isBusy}
                        className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-rose-500/40 hover:text-rose-300 text-[11px] font-medium text-zinc-400 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Desconectar</span>
                      </button>
                    </div>
                  </div>

                  {conn.lastError && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                      {conn.lastError}
                    </div>
                  )}

                  {/* Business Centers autorizados */}
                  {conn.businessCenters.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        <span>Business Centers autorizados</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {conn.businessCenters.map((bc) => (
                          <span
                            key={bc.bcId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-[#050507] text-[11px] text-zinc-200"
                          >
                            <span className="font-medium text-white">
                              {bc.name}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500">
                              ID {bc.bcId}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contas de anúncios autorizadas */}
                  {conn.advertisers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Contas de anúncios autorizadas
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {conn.advertisers.map((adv) => (
                          <div
                            key={adv.advertiserId}
                            className="rounded-lg border border-white/10 bg-[#050507] px-3 py-2 flex flex-col"
                          >
                            <span className="text-xs font-medium text-white truncate">
                              {adv.advertiserName}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              Advertiser ID: {adv.advertiserId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SpotlightCard>

      {/* CONSULTA SOMENTE-LEITURA DE GASTOS, COMPRAS, CPA, LUCRO E OTIMIZAÇÃO */}
      {authorizedAccountOptions.length > 0 && (
        <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Relatórios, Compras, CPA, Lucro &amp; Otimização (TikTok API)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Puxa gasto, compras, CPA, ROAS, lucro estimado, CTR, checkout (IC), frequência e retenção de vídeo (Hook 2s / Hold 6s) em modo somente-leitura, cruzando com o valor líquido real do seu gateway.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => runReportQuery(true)}
              disabled={syncingReport || loadingReport}
              className="btn-pressable inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-200 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingReport ? "animate-spin" : ""}`} />
              <span>
                {syncingReport ? "Sincronizando..." : "Sincronizar p/ Operação"}
              </span>
            </button>
          </div>

          <form
            onSubmit={handleFetchReport}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-4">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Conta de Anúncios Autorizada
              </label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              >
                {authorizedAccountOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.advertiserName} ({opt.advertiserId}) —{" "}
                    {opt.connectionLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Nível de Otimização
              </label>
              <select
                value={dataLevel}
                onChange={(e) =>
                  setDataLevel(e.target.value as TikTokReportDataLevel)
                }
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white focus:border-white focus:outline-none"
              >
                <option value="AUCTION_CAMPAIGN">Campanhas</option>
                <option value="AUCTION_ADGROUP">Conjuntos</option>
                <option value="AUCTION_AD">Anúncios</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-zinc-400 mb-1">
                Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-2.5 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loadingReport || syncingReport}
                className="btn-pressable w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
              >
                {loadingReport ? "Consultando..." : "Consultar"}
              </button>
            </div>
          </form>

          {reportNotice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{reportNotice}</span>
            </div>
          )}

          {reportError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{reportError}</span>
            </div>
          )}

          {reportData && (
            <div className="space-y-4 pt-2">
              {/* CRUZAMENTO REAL: QUANTO CAIU NO GATEWAY vs QUANTO GASTOU NO TIKTOK */}
              {crossCheck && (
                <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-r from-[#071510] via-[#080b10] to-[#08080a] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                      Cruzamento Real: Gateway (Quanto Caiu) vs TikTok Ads (Quanto Gastou)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {startDate} até {endDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        Caiu Líquido (Gateway)
                      </span>
                      <span className="text-sm font-mono font-semibold text-white">
                        {formatBRL(crossCheck.gatewayNetRevenue)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        Vendas Aprovadas (GW)
                      </span>
                      <span className="text-sm font-mono font-semibold text-white">
                        {crossCheck.gatewayApprovedSales}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        Gasto TikTok Ads
                      </span>
                      <span className="text-sm font-mono font-semibold text-amber-200">
                        {formatBRL(crossCheck.tiktokSpend)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        Lucro Real (GW − Ads)
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${
                          crossCheck.realProfit >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {formatBRL(crossCheck.realProfit)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        CPA Real (GW)
                      </span>
                      <span className="text-sm font-mono font-semibold text-white">
                        {crossCheck.realCpa > 0
                          ? formatBRL(crossCheck.realCpa)
                          : "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <span className="text-[10px] text-zinc-400 block">
                        ROAS Real (GW)
                      </span>
                      <span className="text-sm font-mono font-semibold text-white">
                        {crossCheck.realRoas > 0
                          ? `${crossCheck.realRoas.toFixed(2)}x`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* KPIs DE OTIMIZAÇÃO DA TIKTOK MARKETING API */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                  {
                    label: "Gasto TikTok",
                    value: formatBRL(reportData.totals.spend),
                  },
                  {
                    label: "Compras (Pixel)",
                    value: reportData.totals.purchases.toLocaleString("pt-BR"),
                  },
                  {
                    label: "CPA (TikTok)",
                    value:
                      reportData.totals.cpa > 0
                        ? formatBRL(reportData.totals.cpa)
                        : "—",
                  },
                  {
                    label: "Receita Atrib.",
                    value: formatBRL(reportData.totals.attributedRevenue),
                  },
                  {
                    label: "ROAS (TikTok)",
                    value:
                      reportData.totals.roas > 0
                        ? `${reportData.totals.roas.toFixed(2)}x`
                        : "—",
                  },
                  {
                    label: "Lucro Estimado",
                    value: formatBRL(reportData.totals.estimatedProfit),
                    tone:
                      reportData.totals.estimatedProfit >= 0
                        ? "text-emerald-400"
                        : "text-rose-400",
                  },
                  {
                    label: "CTR / CPC",
                    value: `${reportData.totals.ctr.toFixed(2)}% • ${formatBRL(reportData.totals.cpc)}`,
                  },
                  {
                    label: "CPM Médio",
                    value: formatBRL(reportData.totals.cpm),
                  },
                  {
                    label: "Taxa Conv. (CVR)",
                    value: `${reportData.totals.conversionRate.toFixed(2)}%`,
                  },
                  {
                    label: "Checkouts (IC)",
                    value: `${reportData.totals.initiateCheckout} (${reportData.totals.checkoutToPurchaseRate.toFixed(0)}%)`,
                  },
                  {
                    label: "Hook 2s / Hold 6s",
                    value: `${reportData.totals.hookRate2s.toFixed(1)}% / ${reportData.totals.holdRate6s.toFixed(1)}%`,
                  },
                  {
                    label: "Frequência",
                    value:
                      reportData.totals.frequency > 0
                        ? reportData.totals.frequency.toFixed(2)
                        : "—",
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-white/10 bg-[#050507] p-3"
                  >
                    <span className="text-[10px] text-zinc-500 block">
                      {kpi.label}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-semibold font-mono tabular-nums mt-0.5 block truncate ${
                        kpi.tone || "text-white"
                      }`}
                    >
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>

              {reportData.rows.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  Nenhum registro de gasto encontrado no período selecionado
                  para esta conta autorizada.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-zinc-400">
                      <tr>
                        <th className="px-3 py-2.5">Data</th>
                        <th className="px-3 py-2.5">Campanha / Item</th>
                        <th className="px-3 py-2.5">Otimização</th>
                        <th className="px-3 py-2.5 text-right">Gasto</th>
                        <th className="px-3 py-2.5 text-right">Compras</th>
                        <th className="px-3 py-2.5 text-right">CPA</th>
                        <th className="px-3 py-2.5 text-right">ROAS</th>
                        <th className="px-3 py-2.5 text-right">Lucro Est.</th>
                        <th className="px-3 py-2.5 text-right">CTR</th>
                        <th className="px-3 py-2.5 text-right">Hook 2s</th>
                        <th className="px-3 py-2.5 text-right">Freq.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {reportData.rows.slice(0, 40).map((row, idx) => (
                        <tr
                          key={`${row.campaignId}-${row.statDate}-${idx}`}
                          className="hover:bg-white/[0.02]"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-400 whitespace-nowrap">
                            {row.statDate}
                          </td>
                          <td className="px-3 py-2 max-w-[210px]">
                            <div className="text-white font-medium truncate">
                              {row.adName || row.adgroupName || row.campaignName}
                            </div>
                            {(row.adName || row.adgroupName) && (
                              <div className="text-[10px] text-zinc-500 truncate">
                                {row.campaignName}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[220px]">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getOptimizationBadgeClass(
                                row.optimization.status
                              )}`}
                              title={row.optimization.action}
                            >
                              {row.optimization.label}
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                              {row.optimization.action}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-white whitespace-nowrap">
                            {formatBRL(row.spend)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-200">
                            {row.purchases}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-200 whitespace-nowrap">
                            {row.cpa > 0 ? formatBRL(row.cpa) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-200 whitespace-nowrap">
                            {row.roas > 0 ? `${row.roas.toFixed(2)}x` : "—"}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                              row.estimatedProfit >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {formatBRL(row.estimatedProfit)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
                            {row.ctr.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
                            {row.hookRate2s > 0
                              ? `${row.hookRate2s.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
                            {row.frequency > 0
                              ? row.frequency.toFixed(2)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </SpotlightCard>
      )}
    </div>
  );
}
