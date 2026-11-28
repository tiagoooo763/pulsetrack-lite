"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  FileBarChart2,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import type {
  AutomationRuleRecord,
  MetricAlertLogRecord,
  TikTokCampaignRecord,
  TransactionRecord,
  WebhookEventRecord,
} from "@/lib/db";
import type {
  DashboardOperationMode,
  IntegrationStatusPayload,
  NotificationPrefs,
} from "@/lib/dashfy-types";
import { downloadCsvFile, type OperationSummaryMetrics } from "@/lib/dashfy-metrics";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  getPaymentMethodLabel,
  getTransactionStatusMeta,
} from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

/* ==================== 1. RELATÓRIOS ==================== */
interface ReportsViewProps {
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  metrics: OperationSummaryMetrics;
  transactions: TransactionRecord[];
  tiktokCampaigns: TikTokCampaignRecord[];
}

export function ReportsView({
  dashboardMode,
  dashboardName,
  metrics,
  transactions,
  tiktokCampaigns,
}: ReportsViewProps) {
  const isTikTok = dashboardMode === "tiktok";

  function handleExportCsv() {
    if (isTikTok) {
      downloadCsvFile(
        `dashfy-relatorio-tiktok-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Data",
          "Conta",
          "Campanha",
          "Conjunto",
          "Anuncio",
          "Produto",
          "Investimento",
          "Impressoes",
          "Cliques",
          "Conversoes",
          "Receita Atribuida",
          "Lucro Estimado",
          "Status",
        ],
        tiktokCampaigns.map((c) => [
          c.statDate,
          c.adAccount,
          c.campaignName,
          c.adgroupName,
          c.adName,
          c.productName,
          c.spend.toFixed(2),
          c.impressions,
          c.clicks,
          c.conversions,
          c.attributedRevenue.toFixed(2),
          (c.attributedRevenue - c.spend).toFixed(2),
          c.status,
        ])
      );
    } else {
      downloadCsvFile(
        `dashfy-relatorio-omegapay-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Data",
          "ID",
          "Produto",
          "Metodo",
          "Bruto",
          "Taxa",
          "Liquido",
          "Status",
        ],
        transactions.map((t) => [
          t.paidAt || t.createdAt,
          t.id,
          t.productName,
          t.paymentMethod,
          t.grossAmount.toFixed(2),
          t.feeAmount.toFixed(2),
          t.netAmount.toFixed(2),
          t.status,
        ])
      );
    }
  }

  return (
    <div className="space-y-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <FileBarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Relatório Executivo — {dashboardName}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Exporte os dados filtrados da operação atual em CSV pronto para Excel ou Google Sheets.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="btn-pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Exportar CSV Completo</span>
        </button>
      </SpotlightCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpotlightCard className="p-5 bento-card space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Demonstrativo Financeiro do Período
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">
                {isTikTok ? "Receita Atribuída" : "Faturamento Bruto"}
              </span>
              <span className="font-mono text-white font-semibold">
                {formatBRL(metrics.grossRevenue)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">Taxas Totais</span>
              <span className="font-mono text-rose-400">
                -{formatBRL(metrics.checkoutOrPlatformFees + metrics.customFeesTotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">Faturamento Líquido</span>
              <span className="font-mono text-white font-semibold">
                {formatBRL(metrics.netRevenue)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">Gastos com Anúncios</span>
              <span className="font-mono text-rose-400">
                -{formatBRL(metrics.adExpenses)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">Outras Despesas</span>
              <span className="font-mono text-rose-400">
                -{formatBRL(metrics.otherExpenses)}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-bold">
              <span className="text-white">
                {isTikTok ? "Lucro Estimado" : "Resultado Líquido"}
              </span>
              <span
                className={`font-mono ${
                  metrics.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatBRL(metrics.profit)}
              </span>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Indicadores de Eficiência
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">ROAS</span>
              <span className="font-mono text-white font-semibold">
                {metrics.roas !== null ? `${metrics.roas.toFixed(2)}x` : "—"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">ROI (%)</span>
              <span className="font-mono text-white font-semibold">
                {metrics.roiPct !== null ? `${metrics.roiPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">Margem Líquida</span>
              <span className="font-mono text-white font-semibold">
                {metrics.marginPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.06]">
              <span className="text-zinc-400">
                {isTikTok ? "Total de Conversões" : "Taxa de Aprovação"}
              </span>
              <span className="font-mono text-white font-semibold">
                {isTikTok ? metrics.approvedCount : `${metrics.approvalRate.toFixed(1)}%`}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-400">Produtos Ativos</span>
              <span className="font-mono text-white font-semibold">
                {metrics.productBreakdown.length}
              </span>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

/* ==================== 2. PEDIDOS ==================== */
interface OrdersViewProps {
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  transactions: TransactionRecord[];
  tiktokCampaigns: TikTokCampaignRecord[];
}

export function OrdersView({
  dashboardMode,
  dashboardName,
  transactions,
  tiktokCampaigns,
}: OrdersViewProps) {
  const isTikTok = dashboardMode === "tiktok";
  const tiktokWithOrders = tiktokCampaigns.filter((c) => c.conversions > 0);

  return (
    <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ShoppingBag className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Pedidos — {dashboardName}
          </h3>
          <p className="text-xs text-zinc-400">
            {isTikTok
              ? "Conversões atribuídas agrupadas por campanha, anúncio e produto"
              : "Pedidos sincronizados via checkout e webhooks oficiais OmegaPay"}
          </p>
        </div>
      </div>

      {isTikTok ? (
        tiktokWithOrders.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">
            Nenhuma conversão atribuída registrada na Operação TikTok.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">Campanha / Anúncio</th>
                  <th className="py-2.5 px-3 text-right">Qtd. Pedidos</th>
                  <th className="py-2.5 px-3 text-right">Ticket Médio</th>
                  <th className="py-2.5 px-3 text-right text-white">Receita Atrib.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                {tiktokWithOrders.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-mono text-zinc-400">
                      {formatDateBR(c.statDate)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{c.productName}</td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      {c.campaignName} &bull; <span className="text-zinc-400">{c.adName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                      {c.conversions}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {formatBRL(c.attributedRevenue / Math.max(1, c.conversions))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                      {formatBRL(c.attributedRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">
          Nenhum pedido recebido na Operação OmegaPay no período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Pedido / ID</th>
                <th className="py-2.5 px-3">Produto</th>
                <th className="py-2.5 px-3">Pagamento</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
              {transactions.map((t) => {
                const meta = getTransactionStatusMeta(t.status);
                return (
                  <tr key={t.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-3 font-mono text-zinc-300">
                      {t.orderId || t.id}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{t.productName}</td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      {getPaymentMethodLabel(t.paymentMethod)} ({t.installments}x)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                      {formatBRL(t.grossAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border ${meta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                      {formatDateTimeBR(t.paidAt || t.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SpotlightCard>
  );
}

/* ==================== 3. EVENTOS ==================== */
interface EventsViewProps {
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  webhooks: WebhookEventRecord[];
  tiktokCampaigns: TikTokCampaignRecord[];
}

export function EventsView({
  dashboardMode,
  dashboardName,
  webhooks,
  tiktokCampaigns,
}: EventsViewProps) {
  const isTikTok = dashboardMode === "tiktok";
  const omegaWebhooks = webhooks.filter((w) => (w.gateway || "OMEGAPAY") === "OMEGAPAY");

  return (
    <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Log de Eventos — {dashboardName}
          </h3>
          <p className="text-xs text-zinc-400">
            {isTikTok
              ? "Histórico de registros e importações de campanhas/conversões TikTok"
              : "Auditoria sanitizada de todos os webhooks recebidos com chave de idempotência"}
          </p>
        </div>
      </div>

      {isTikTok ? (
        tiktokCampaigns.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">
            Nenhum evento de importação registrado na Operação TikTok ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {tiktokCampaigns.slice(0, 20).map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/10 bg-[#08080a] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono text-white text-[11px] mr-2">
                    TIKTOK_IMPORT
                  </span>
                  <span className="text-white font-medium">{c.campaignName}</span>
                  <span className="text-zinc-400 ml-2">({c.adName})</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-400">
                  {c.conversions} conv. &bull; {formatDateTimeBR(c.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : omegaWebhooks.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">
          Nenhum webhook recebido da OmegaPay ainda. Configure o endpoint na aba Integrações.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Recebido em</th>
                <th className="py-2.5 px-3">Evento</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Status Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
              {omegaWebhooks.map((w) => (
                <tr key={w.id} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                    {formatDateTimeBR(w.receivedAt)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-white font-medium">
                    {w.eventType}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-white">{w.entityId}</td>
                  <td className="py-2.5 px-3 font-mono text-zinc-300">
                    {w.statusAfter || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SpotlightCard>
  );
}

/* ==================== 4. NOTIFICAÇÕES ==================== */
interface NotificationsViewProps {
  dashboardId?: string;
  dashboardMode: DashboardOperationMode;
  integrationStatus: IntegrationStatusPayload;
  transactions: TransactionRecord[];
  rules: AutomationRuleRecord[];
  prefs: NotificationPrefs;
  onRefresh: () => Promise<void>;
  onOpenSoundSettings?: () => void;
  onOpenMyMetrics?: () => void;
}

export function NotificationsView({
  dashboardId = "tiktok",
  dashboardMode,
  integrationStatus,
  transactions,
  rules,
  prefs,
  onRefresh,
  onOpenSoundSettings,
  onOpenMyMetrics,
}: NotificationsViewProps) {
  const [localPrefs, setLocalPrefs] = useState<NotificationPrefs>(prefs);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [metricAlerts, setMetricAlerts] = useState<MetricAlertLogRecord[]>([]);

  const isTikTok = dashboardMode === "tiktok";

  useEffect(() => {
    if (!isTikTok) return;
    let active = true;
    fetch(`/api/metrics/alerts?dashboardId=${encodeURIComponent(dashboardId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j?.ok && Array.isArray(j.logs)) {
          setMetricAlerts(j.logs);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isTikTok, dashboardId]);
  const refunds = transactions.filter(
    (t) => t.status === "REFUNDED" || t.status === "CHARGED_BACK"
  );

  const alerts: Array<{ title: string; detail: string; level: "warn" | "ok" }> = [];
  if (!isTikTok) {
    if (!integrationStatus.hasApiCredentials) {
      alerts.push({
        title: "Credenciais da API OmegaPay pendentes",
        detail: "Cadastre x-public-key e x-secret-key na aba Integrações para sincronizar seu saldo.",
        level: "warn",
      });
    }
    if (!integrationStatus.syncEnabled) {
      alerts.push({
        title: "Sincronização OmegaPay pausada",
        detail: "Reative a sincronização em Integrações quando desejar consultar o saldo.",
        level: "warn",
      });
    }
    if (refunds.length > 0) {
      alerts.push({
        title: `${refunds.length} reembolso(s)/chargeback(s) registrado(s)`,
        detail: "Revise os pedidos na aba Vendas ou Pedidos para acompanhar sua taxa de reembolso.",
        level: "warn",
      });
    }
  } else {
    const activeRules = rules.filter((r) => r.enabled).length;
    alerts.push({
      title: `${activeRules} regra(s) de monitoramento ativa(s)`,
      detail: "Acompanhe alertas de ROAS, CPA e CPC diretamente na aba Regras ou em Minhas Métricas.",
      level: "ok",
    });
    for (const ma of metricAlerts.slice(0, 6)) {
      alerts.push({
        title: ma.title,
        detail: `${ma.message} (${formatDateTimeBR(ma.triggeredAt)})`,
        level: ma.severity === "positive" ? "ok" : "warn",
      });
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      title: "Tudo em dia nesta operação",
      detail: "Nenhum alerta crítico detectado no momento.",
      level: "ok",
    });
  }

  async function handleSavePrefs() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_notifications",
          prefs: localPrefs,
        }),
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Alertas da Operação</h3>
            <p className="text-xs text-zinc-400">
              Monitoramento real baseado nos eventos desta operação
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map((a, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3.5 flex items-start gap-2.5 text-xs ${
                a.level === "warn"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {a.level === "warn" ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <div>
                <div className="font-semibold">{a.title}</div>
                <div className="text-[11px] opacity-85 mt-0.5">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </SpotlightCard>

      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Preferências de Notificação</h3>
          <p className="text-xs text-zinc-400">
            Defina quais alertas devem ser destacados no Dashfy
          </p>
        </div>

        <div className="space-y-2.5">
          {(
            [
              { key: "alertOnRefund", label: "Alertar sobre reembolsos (OmegaPay)" },
              { key: "alertOnChargeback", label: "Alertar sobre chargebacks (OmegaPay)" },
              { key: "alertOnLowRoas", label: "Destacar regras de ROAS / CPA (TikTok)" },
              { key: "alertOnSyncError", label: "Avisar falhas de sincronização de API" },
            ] as Array<{ key: keyof NotificationPrefs; label: string }>
          ).map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#08080a] cursor-pointer"
            >
              <span className="text-xs text-zinc-200">{item.label}</span>
              <input
                type="checkbox"
                checked={localPrefs[item.key]}
                onChange={(e) =>
                  setLocalPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))
                }
                className="w-4 h-4 accent-white rounded"
              />
            </label>
          ))}
        </div>

        {savedNotice && (
          <div className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Preferências salvas no servidor!
          </div>
        )}

        <button
          type="button"
          onClick={handleSavePrefs}
          disabled={saving}
          className="btn-pressable w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Preferências"}
        </button>

        {onOpenSoundSettings && (
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-zinc-400">
              Personalize o som, volume ou envie seu áudio de venda aprovada.
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenMyMetrics && (
                <button
                  type="button"
                  onClick={onOpenMyMetrics}
                  className="btn-pressable px-3.5 py-2 rounded-xl border border-[#1d74ff]/40 bg-[#1d74ff]/15 hover:bg-[#1d74ff]/25 text-xs font-semibold text-[#7db5ff]"
                >
                  Alertas de Metas &rarr;
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSoundSettings}
                className="btn-pressable px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white"
              >
                Sons de vendas &rarr;
              </button>
            </div>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
