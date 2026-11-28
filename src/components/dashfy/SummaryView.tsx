"use client";

import React from "react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  Megaphone,
  Package,
  Percent,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import type {
  BalanceSnapshotRecord,
  TikTokCampaignRecord,
  TransactionRecord,
} from "@/lib/db";
import type {
  DashboardOperationMode,
  OperationTabId,
  SummaryFilterState,
} from "@/lib/dashfy-types";
import type { OperationSummaryMetrics } from "@/lib/dashfy-metrics";
import {
  formatBRL,
  formatDateBR,
  getTransactionStatusMeta,
} from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";
import { SummaryFiltersBar } from "./SummaryFiltersBar";
import {
  FinancialBreakdownDonut,
  RevenueTrendChart,
} from "./AnalyticsCharts";

interface SummaryViewProps {
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  metrics: OperationSummaryMetrics;
  filters: SummaryFilterState;
  filterOptions: {
    adAccounts: string[];
    campaigns: string[];
    trafficSources: string[];
    products: string[];
    platforms: string[];
  };
  onFiltersChange: (next: SummaryFilterState) => void;
  onFiltersReset: () => void;
  onNavigateTab: (tabId: OperationTabId) => void;
  recentTransactions: TransactionRecord[];
  tiktokCampaigns: TikTokCampaignRecord[];
  omegaBalance: BalanceSnapshotRecord | null;
}

export function SummaryView({
  dashboardMode,
  dashboardName,
  metrics,
  filters,
  filterOptions,
  onFiltersChange,
  onFiltersReset,
  onNavigateTab,
  recentTransactions,
  tiktokCampaigns,
  omegaBalance,
}: SummaryViewProps) {
  const isTikTok = dashboardMode === "tiktok";

  const topCampaigns = React.useMemo(() => {
    if (!isTikTok) return [];
    const map = new Map<
      string,
      { name: string; spend: number; revenue: number; conversions: number; clicks: number }
    >();
    for (const c of tiktokCampaigns) {
      const cur = map.get(c.campaignName) || {
        name: c.campaignName,
        spend: 0,
        revenue: 0,
        conversions: 0,
        clicks: 0,
      };
      cur.spend += c.spend;
      cur.revenue += c.attributedRevenue;
      cur.conversions += c.conversions;
      cur.clicks += c.clicks;
      map.set(c.campaignName, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [isTikTok, tiktokCampaigns]);

  return (
    <div className="space-y-6">
      <SummaryFiltersBar
        dashboardMode={dashboardMode}
        filters={filters}
        onChange={onFiltersChange}
        onReset={onFiltersReset}
        options={filterOptions}
      />

      {isTikTok && tiktokCampaigns.length === 0 && (
        <div className="rounded-2xl border border-[#3b8bff]/30 bg-gradient-to-r from-[#1d74ff]/12 via-[#0a1529] to-[#0a1529] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm sm:text-base font-semibold text-white">
              {dashboardName} pronta para receber dados
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Conecte sua conta TikTok Ads via OAuth, importe seu relatório CSV ou cadastre campanhas manualmente. Estes dados ficam 100% separados da OmegaPay.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("tiktok_ads")}
            className="btn-pressable dashfy-btn-primary h-10 px-4 text-xs shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar CSV / Conectar TikTok</span>
          </button>
        </div>
      )}

      {/* LINHA 1 — 4 CARDS MESTRES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Faturamento Bruto / Receita Atribuída */}
        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              {isTikTok ? "Receita Atribuída" : "Faturamento Bruto"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(metrics.grossRevenue)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span>
              {isTikTok
                ? `${metrics.approvedCount} conversões atribuídas`
                : `${metrics.approvedCount} vendas aprovadas`}
            </span>
            <span className="text-slate-200 tabular-nums font-medium">
              {isTikTok
                ? "TikTok Ads"
                : `Ticket: ${formatBRL(metrics.averageTicket)}`}
            </span>
          </div>
        </SpotlightCard>

        {/* 2. Receita Líquida */}
        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Receita Líquida
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(metrics.netRevenue)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span className="tabular-nums">
              Taxas: {formatBRL(metrics.checkoutOrPlatformFees + metrics.customFeesTotal)}
            </span>
            <span className="font-medium text-slate-300">Base do Lucro</span>
          </div>
        </SpotlightCard>

        {/* 3. Gastos com Anúncios */}
        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Gastos com Anúncios
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(metrics.adExpenses)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span className="tabular-nums">Outros: {formatBRL(metrics.otherExpenses)}</span>
            <span className="tabular-nums font-medium text-slate-200">
              {isTikTok ? `CPA: ${formatBRL(metrics.cpa)}` : "Ads + Tráfego"}
            </span>
          </div>
        </SpotlightCard>

        {/* 4. Lucro Estimado */}
        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Lucro Estimado
            </span>
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                metrics.profit > 0
                  ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-400"
                  : metrics.profit < 0
                    ? "bg-rose-500/12 border-rose-400/25 text-rose-400"
                    : "bg-[#1d74ff]/12 border-[#3b8bff]/25 text-[#5ea1ff]"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3.5">
            <div
              className={`dashfy-kpi-value text-2xl sm:text-[28px] font-bold leading-tight ${
                metrics.profit > 0
                  ? "text-emerald-400"
                  : metrics.profit < 0
                    ? "text-rose-400"
                    : "text-slate-200"
              }`}
            >
              {formatBRL(metrics.profit)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span>Líquido - Despesas</span>
            <span className="tabular-nums font-semibold text-slate-200">
              Margem: {metrics.marginPct.toFixed(1)}%
            </span>
          </div>
        </SpotlightCard>
      </section>

      {/* LINHA 2 — 5 CARDS SECUNDÁRIOS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* ROAS */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              ROAS
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div
            className={`dashfy-kpi-value my-3 text-2xl font-bold ${
              metrics.roas !== null
                ? metrics.roas >= 1
                  ? "text-emerald-400"
                  : "text-rose-400"
                : "text-slate-400"
            }`}
          >
            {metrics.roas !== null ? `${metrics.roas.toFixed(2)}x` : "—"}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
            Retorno sobre anúncios
          </div>
        </SpotlightCard>

        {/* ROI */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              ROI
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`dashfy-kpi-value text-2xl font-bold ${
                metrics.roiPct !== null
                  ? metrics.roiPct >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {metrics.roiPct !== null
                ? `${metrics.roiPct >= 0 ? "+" : ""}${metrics.roiPct.toFixed(1)}%`
                : "—"}
            </span>
            {metrics.roiMultiplier !== null && (
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({metrics.roiMultiplier.toFixed(2)}x)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
            Retorno líquido total
          </div>
        </SpotlightCard>

        {/* Margem */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Margem
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div
            className={`dashfy-kpi-value my-3 text-2xl font-bold ${
              metrics.marginPct > 0
                ? "text-emerald-400"
                : metrics.marginPct < 0
                  ? "text-rose-400"
                  : "text-slate-300"
            }`}
          >
            {metrics.marginPct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
            Lucro / Faturamento
          </div>
        </SpotlightCard>

        {/* Pendentes / CPC */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              {isTikTok ? "CPC / CPM" : "Vendas Pendentes"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          {isTikTok ? (
            <>
              <div className="dashfy-kpi-value my-3 text-2xl font-bold text-white">
                {formatBRL(metrics.cpc)}
              </div>
              <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10 tabular-nums">
                CPM: {formatBRL(metrics.cpm)}
              </div>
            </>
          ) : (
            <>
              <div className="dashfy-kpi-value my-3 text-2xl font-bold text-white">
                {formatBRL(metrics.pendingAmount)}
              </div>
              <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
                {metrics.pendingCount} pedidos pendentes
              </div>
            </>
          )}
        </SpotlightCard>

        {/* Taxa de Aprovação */}
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              {isTikTok ? "Taxa de Conv." : "Aprovação"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="dashfy-kpi-value my-3 text-2xl font-bold text-white">
            {metrics.approvalRate.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10 flex items-center justify-between gap-2">
            {isTikTok ? (
              <span className="tabular-nums">CTR: {metrics.ctr.toFixed(2)}%</span>
            ) : (
              <>
                <span>
                  {metrics.approvedCount} de {metrics.totalOrdersCount} vendas
                </span>
                <span className="tabular-nums text-rose-300/90 font-medium">
                  Reemb.: {metrics.refundedCount}
                </span>
              </>
            )}
          </div>
        </SpotlightCard>
      </section>

      {/* GRÁFICO DE DESEMPENHO (CURVA/BARRAS) + COMPOSIÇÃO FINANCEIRA */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SpotlightCard className="xl:col-span-8 p-5 sm:p-6">
          <RevenueTrendChart
            series={metrics.dailySeries}
            title={`Desempenho Diário — ${dashboardName}`}
            subtitle={`Evolução de ${isTikTok ? "receita atribuída" : "faturamento"}, despesas e lucro`}
            revenueLabel={isTikTok ? "Receita Atrib." : "Faturamento"}
          />
        </SpotlightCard>

        <SpotlightCard className="xl:col-span-4 p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <FinancialBreakdownDonut
            profit={metrics.profit}
            adExpenses={metrics.adExpenses}
            fees={metrics.checkoutOrPlatformFees + metrics.customFeesTotal}
            otherExpenses={metrics.otherExpenses}
            marginPct={metrics.marginPct}
          />
        </SpotlightCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Vendas por Produto */}
        <SpotlightCard className="lg:col-span-3 p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#1d74ff]/15 border border-[#3b8bff]/30 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#5ea1ff]" />
                </span>
                <span>Vendas por Produto</span>
              </h3>
              <span className="text-xs tabular-nums font-medium text-slate-400">
                {metrics.productBreakdown.length} itens
              </span>
            </div>

            {metrics.productBreakdown.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-blue-200/15 text-xs text-slate-400 bg-[#050b18]/60">
                Nenhum produto com vendas no período.
              </div>
            ) : (
              <div className="space-y-3.5">
                {metrics.productBreakdown.slice(0, 5).map((prod) => (
                  <div key={prod.productName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium text-slate-100 truncate">
                        {prod.productName}
                      </span>
                      <span className="tabular-nums font-semibold text-white shrink-0">
                        {formatBRL(prod.grossRevenue)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#050b18] border border-blue-200/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1d74ff] to-[#5ea1ff]"
                        style={{ width: `${Math.max(4, prod.sharePct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                      <span>{prod.count} unid.</span>
                      <span>{prod.sharePct.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isTikTok && (
            <div className="pt-4 border-t border-blue-200/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Saldo Disponível OmegaPay</span>
                <span className="tabular-nums font-semibold text-white">
                  {formatBRL(omegaBalance?.available ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Saldo Pendente</span>
                <span className="tabular-nums text-slate-300">
                  {formatBRL(omegaBalance?.pending ?? 0)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("saldo")}
                className="btn-pressable dashfy-btn-secondary w-full mt-1 h-9 text-xs"
              >
                <span>Ver detalhes do Saldo</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5ea1ff]" />
              </button>
            </div>
          )}
        </SpotlightCard>
      </section>

      {/* TABELA RESUMIDA INFERIOR */}
      <SpotlightCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight">
              {isTikTok
                ? `Resumo de Campanhas — ${dashboardName}`
                : `Últimas Transações — ${dashboardName}`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isTikTok
                ? "Principais campanhas por receita atribuída e lucro estimado"
                : "Vendas registradas em tempo real via webhook"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab(isTikTok ? "tiktok_ads" : "vendas")}
            className="btn-pressable inline-flex items-center gap-1.5 text-xs text-[#5ea1ff] hover:text-sky-300 font-semibold transition"
          >
            <span>{isTikTok ? "Abrir TikTok Ads" : "Ver todas"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isTikTok ? (
          topCampaigns.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-blue-200/15 text-xs text-slate-400 bg-[#050b18]/60">
              Nenhuma campanha TikTok encontrada para os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-blue-200/10">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-blue-200/10 bg-[#050b18] text-slate-400 uppercase tracking-[0.06em] text-[10px]">
                    <th className="py-3 px-4 font-semibold">Campanha</th>
                    <th className="py-3 px-4 font-semibold text-right">Investimento</th>
                    <th className="py-3 px-4 font-semibold text-right">Conversões</th>
                    <th className="py-3 px-4 font-semibold text-right">Receita Atribuída</th>
                    <th className="py-3 px-4 font-semibold text-right">ROAS</th>
                    <th className="py-3 px-4 font-semibold text-right">Lucro Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                  {topCampaigns.map((c) => {
                    const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                    const profit = c.revenue - c.spend;
                    return (
                      <tr key={c.name} className="hover:bg-[#1d74ff]/[0.06] transition-colors">
                        <td className="py-3 px-4 text-white font-medium max-w-[240px] truncate">
                          {c.name}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                          {formatBRL(c.spend)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                          {c.conversions}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-white font-semibold">
                          {formatBRL(c.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-200 font-medium">
                          {c.spend > 0 ? `${roas.toFixed(2)}x` : "—"}
                        </td>
                        <td
                          className={`py-3 px-4 text-right tabular-nums font-semibold ${
                            profit > 0
                              ? "text-emerald-400"
                              : profit < 0
                                ? "text-rose-400"
                                : "text-slate-400"
                          }`}
                        >
                          {formatBRL(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : recentTransactions.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-blue-200/15 text-xs text-slate-400 bg-[#050b18]/60">
            Nenhuma transação no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-200/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-200/10 bg-[#050b18] text-slate-400 uppercase tracking-[0.06em] text-[10px]">
                  <th className="py-3 px-4 font-semibold">Data</th>
                  <th className="py-3 px-4 font-semibold">Produto</th>
                  <th className="py-3 px-4 font-semibold">ID Transação</th>
                  <th className="py-3 px-4 font-semibold text-right">Bruto</th>
                  <th className="py-3 px-4 font-semibold text-right">Líquido</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                {recentTransactions.slice(0, 6).map((tx) => {
                  const meta = getTransactionStatusMeta(tx.status);
                  return (
                    <tr key={tx.id} className="hover:bg-[#1d74ff]/[0.06] transition-colors">
                      <td className="py-3 px-4 text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDateBR(tx.paidAt || tx.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-white font-medium max-w-[200px] truncate">
                        {tx.productName}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{tx.id}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                        {formatBRL(tx.grossAmount)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-white font-semibold">
                        {formatBRL(tx.netAmount)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badgeClass}`}
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
      </SpotlightCard>
    </div>
  );
}
