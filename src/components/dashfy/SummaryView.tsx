"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
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
  DashboardOperationId,
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

interface SummaryViewProps {
  dashboardId: DashboardOperationId;
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
  dashboardId,
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const isTikTok = dashboardId === "tiktok";

  const maxChartVal = Math.max(
    1,
    ...metrics.dailySeries.map((d) =>
      Math.max(d.grossRevenue, d.netRevenue, d.expenses, Math.abs(d.profit))
    )
  );

  // Agrupamento resumido por campanha para o TikTok
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
    <div className="space-y-5">
      {/* BARRA HORIZONTAL DE FILTROS (ESTILO UTMIFY) */}
      <SummaryFiltersBar
        dashboardId={dashboardId}
        filters={filters}
        onChange={onFiltersChange}
        onReset={onFiltersReset}
        options={filterOptions}
      />

      {/* BANNER CONTEXTUAL DE SEPARAÇÃO DE OPERAÇÕES */}
      {isTikTok && tiktokCampaigns.length === 0 && (
        <div className="rounded-2xl border border-[#1a86ff]/30 bg-[#1a86ff]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Operação TikTok pronta para receber dados
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Importe seu relatório CSV do TikTok Ads Manager ou cadastre campanhas manualmente. Estes dados nunca se misturam com a OmegaPay.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("tiktok_ads")}
            className="btn-pressable inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-white text-xs font-semibold shrink-0 shadow-md shadow-[#1a86ff]/25"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar CSV / Cadastrar</span>
          </button>
        </div>
      )}

      {/* GRID PRINCIPAL DE INDICADORES — LINHA 1 (4 CARDS PRINCIPAIS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Faturamento Bruto / Receita Atribuída */}
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isTikTok ? "Receita Atribuída" : "Faturamento Bruto"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1a86ff]/15 border border-[#1a86ff]/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#38bdf8]" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(metrics.grossRevenue)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>
              {isTikTok
                ? `${metrics.approvedCount} conversões atribuídas`
                : `${metrics.approvedCount} vendas aprovadas`}
            </span>
            <span className="font-mono text-slate-300">
              {isTikTok ? "TikTok Ads" : "OmegaPay"}
            </span>
          </div>
        </SpotlightCard>

        {/* 2. Faturamento Líquido */}
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Faturamento Líquido
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(metrics.netRevenue)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>Após taxas ({formatBRL(metrics.checkoutOrPlatformFees + metrics.customFeesTotal)})</span>
            <span className="text-slate-300">Líquido real</span>
          </div>
        </SpotlightCard>

        {/* 3. Gastos com Anúncios */}
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Gastos com Anúncios
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(metrics.adExpenses)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>Outros custos: {formatBRL(metrics.otherExpenses)}</span>
            {isTikTok ? (
              <span className="font-mono text-slate-300">
                CPA: {formatBRL(metrics.cpa)}
              </span>
            ) : (
              <span className="font-mono text-slate-300">
                Ads + Tráfego
              </span>
            )}
          </div>
        </SpotlightCard>

        {/* 4. Lucro / Lucro Estimado */}
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isTikTok ? "Lucro Estimado" : "Lucro"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="my-3">
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${
                metrics.profit > 0
                  ? "text-emerald-400"
                  : metrics.profit < 0
                    ? "text-rose-400"
                    : "text-slate-300"
              }`}
            >
              {formatBRL(metrics.profit)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>{isTikTok ? "Receita atrib. - Custos" : "Líquido - Despesas"}</span>
            <span
              className={`font-mono font-semibold ${
                metrics.marginPct > 0
                  ? "text-emerald-400"
                  : metrics.marginPct < 0
                    ? "text-rose-400"
                    : "text-slate-300"
              }`}
            >
              Margem: {metrics.marginPct.toFixed(1)}%
            </span>
          </div>
        </SpotlightCard>
      </section>

      {/* GRID SECUNDÁRIO DE INDICADORES — LINHA 2 (5 CARDS COMPACTOS: ROAS, ROI, MARGEM, PENDENTES, APROVAÇÃO) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* ROAS */}
        <SpotlightCard className="p-4 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              ROAS
            </span>
            <Target className="w-4 h-4 text-[#1a86ff]" />
          </div>
          <div
            className={`mt-2.5 text-2xl font-bold font-mono tabular-nums ${
              metrics.roas !== null
                ? metrics.roas >= 1.5
                  ? "text-emerald-400"
                  : metrics.roas < 1
                    ? "text-rose-400"
                    : "text-white"
                : "text-slate-400"
            }`}
          >
            {metrics.roas !== null ? `${metrics.roas.toFixed(2)}x` : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Retorno sobre ads
          </div>
        </SpotlightCard>

        {/* ROI */}
        <SpotlightCard className="p-4 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              ROI
            </span>
            <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
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
              <span className="text-xs font-mono text-slate-400">
                ({metrics.roiMultiplier.toFixed(2)}x)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Retorno líquido total
          </div>
        </SpotlightCard>

        {/* Margem */}
        <SpotlightCard className="p-4 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Margem
            </span>
            <Percent className="w-4 h-4 text-blue-400" />
          </div>
          <div
            className={`mt-2.5 text-2xl font-bold font-mono tabular-nums ${
              metrics.marginPct > 0
                ? "text-emerald-400"
                : metrics.marginPct < 0
                  ? "text-rose-400"
                  : "text-slate-300"
            }`}
          >
            {metrics.marginPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Lucro / Faturamento
          </div>
        </SpotlightCard>

        {/* Vendas Pendentes (OmegaPay) ou CPC / CPM (TikTok) */}
        <SpotlightCard className="p-4 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isTikTok ? "CPC / CPM Médio" : "Vendas Pendentes"}
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          {isTikTok ? (
            <>
              <div className="mt-2.5 text-xl font-bold text-white font-mono tabular-nums">
                {formatBRL(metrics.cpc)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5 font-mono">
                CPM: {formatBRL(metrics.cpm)} &bull; {metrics.clicks.toLocaleString("pt-BR")} cliques
              </div>
            </>
          ) : (
            <>
              <div className="mt-2.5 text-xl font-bold text-white font-mono tabular-nums">
                {formatBRL(metrics.pendingAmount)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                {metrics.pendingCount} pedidos aguardando
              </div>
            </>
          )}
        </SpotlightCard>

        {/* Taxa de Aprovação */}
        <SpotlightCard className="p-4 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isTikTok ? "Taxa de Conversão" : "Taxa de Aprovação"}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-white font-mono tabular-nums">
            {metrics.approvalRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            {isTikTok
              ? `CTR: ${metrics.ctr.toFixed(2)}%`
              : `${metrics.approvedCount} de ${metrics.totalOrdersCount} pedidos`}
          </div>
        </SpotlightCard>
      </section>

      {/* GRÁFICO DE DESEMPENHO + VENDAS POR PRODUTO */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico Diário */}
        <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 bento-card flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1a86ff]" />
                <span>Desempenho Diário — {isTikTok ? "Operação TikTok" : "Operação OmegaPay"}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evolução de {isTikTok ? "receita atribuída" : "faturamento líquido"}, despesas e lucro
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1a86ff]" />
                {isTikTok ? "Receita Atrib." : "Faturamento"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400/80" />
                Despesas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                Lucro
              </span>
            </div>
          </div>

          {metrics.dailySeries.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#080f1e]/60 text-xs text-slate-400">
              <BarChart3 className="w-6 h-6 text-slate-600 mb-2" />
              <span>Sem movimentações registradas no período selecionado.</span>
            </div>
          ) : (
            <div className="relative h-60 w-full flex items-end gap-2 pt-8 pb-6 px-2 rounded-xl bg-[#070d1b] border border-slate-800/80">
              {metrics.dailySeries.map((day, idx) => {
                const revH = Math.max(4, (day.grossRevenue / maxChartVal) * 100);
                const expH = Math.max(
                  day.expenses > 0 ? 4 : 0,
                  (day.expenses / maxChartVal) * 100
                );
                const isHovered = hoveredIdx === idx;
                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer"
                  >
                    {isHovered && (
                      <div className="absolute -top-2 z-20 -translate-y-full w-44 rounded-xl border border-slate-700 bg-[#0a1326] p-2.5 shadow-xl text-[11px] pointer-events-none">
                        <div className="font-mono font-semibold text-white mb-1">
                          {formatDateBR(day.date)}
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Receita:</span>
                          <span className="font-mono text-[#38bdf8]">
                            {formatBRL(day.grossRevenue)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Despesas:</span>
                          <span className="font-mono text-rose-400">
                            {formatBRL(day.expenses)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-200 font-semibold pt-1 mt-1 border-t border-slate-800">
                          <span>Lucro:</span>
                          <span
                            className={`font-mono ${
                              day.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {formatBRL(day.profit)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="w-full h-full flex items-end justify-center gap-1 px-0.5">
                      <div
                        className="w-1/2 max-w-[18px] rounded-t-md bg-gradient-to-t from-[#1a86ff] to-[#38bdf8] transition-all duration-300 group-hover:brightness-110"
                        style={{ height: `${revH}%` }}
                      />
                      {day.expenses > 0 && (
                        <div
                          className="w-1/2 max-w-[14px] rounded-t-md bg-rose-500/75 transition-all duration-300 group-hover:bg-rose-400"
                          style={{ height: `${expH}%` }}
                        />
                      )}
                    </div>

                    <span className="absolute -bottom-5 text-[10px] font-mono text-slate-500 group-hover:text-slate-200 whitespace-nowrap">
                      {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SpotlightCard>

        {/* Vendas por Produto + Resumo de Saldo (OmegaPay) */}
        <SpotlightCard className="p-5 sm:p-6 bento-card flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1a86ff]" />
                <span>Vendas por Produto</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {metrics.productBreakdown.length} itens
              </span>
            </div>

            {metrics.productBreakdown.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
                Nenhum produto com vendas no período.
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.productBreakdown.slice(0, 5).map((prod) => (
                  <div key={prod.productName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium text-slate-200 truncate">
                        {prod.productName}
                      </span>
                      <span className="font-mono font-semibold text-white shrink-0">
                        {formatBRL(prod.grossRevenue)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1a86ff] to-[#38bdf8]"
                        style={{ width: `${Math.max(4, prod.sharePct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{prod.count} unid.</span>
                      <span>{prod.sharePct.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isTikTok && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Saldo Disponível OmegaPay</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {formatBRL(omegaBalance?.available ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Saldo Pendente</span>
                <span className="font-mono text-slate-300">
                  {formatBRL(omegaBalance?.pending ?? 0)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("saldo")}
                className="btn-pressable w-full mt-1 py-2 rounded-xl border border-slate-700/80 bg-[#080f1e] hover:border-[#1a86ff]/50 text-xs font-medium text-slate-200 hover:text-white flex items-center justify-center gap-1.5"
              >
                <span>Ver detalhes do Saldo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </SpotlightCard>
      </section>

      {/* TABELA RESUMIDA INFERIOR */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isTikTok
                ? "Resumo de Campanhas — Operação TikTok"
                : "Últimas Vendas — Operação OmegaPay"}
            </h3>
            <p className="text-xs text-slate-400">
              {isTikTok
                ? "Principais campanhas por receita atribuída e lucro estimado"
                : "Transações recebidas via webhook e API oficial"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab(isTikTok ? "tiktok_ads" : "vendas")}
            className="btn-pressable inline-flex items-center gap-1 text-xs font-semibold text-[#38bdf8] hover:text-white transition"
          >
            <span>{isTikTok ? "Abrir TikTok Ads" : "Ver todas as vendas"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isTikTok ? (
          topCampaigns.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
              Nenhuma campanha TikTok encontrada para os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/90">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#080f1e] text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-semibold">Campanha</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Investimento</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Conversões</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Receita Atribuída</th>
                    <th className="py-2.5 px-3 font-semibold text-right">ROAS</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lucro Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#0c1425]">
                  {topCampaigns.map((c) => {
                    const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                    const profit = c.revenue - c.spend;
                    return (
                      <tr key={c.name} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-white font-medium max-w-[240px] truncate">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          {formatBRL(c.spend)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          {c.conversions}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#38bdf8] font-semibold">
                          {formatBRL(c.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                          {c.spend > 0 ? `${roas.toFixed(2)}x` : "—"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-semibold ${
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
          <div className="py-8 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
            Nenhuma venda registrada no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/90">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#080f1e] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">Produto</th>
                  <th className="py-2.5 px-3 font-semibold">ID</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Bruto</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Líquido</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0c1425]">
                {recentTransactions.slice(0, 6).map((tx) => {
                  const meta = getTransactionStatusMeta(tx.status);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">
                        {formatDateBR(tx.paidAt || tx.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-white font-medium max-w-[200px] truncate">
                        {tx.productName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{tx.id}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatBRL(tx.grossAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                        {formatBRL(tx.netAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
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
