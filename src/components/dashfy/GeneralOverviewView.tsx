"use client";

import React from "react";
import {
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  DollarSign,
  Layers,
  Megaphone,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { BalanceSnapshotRecord } from "@/lib/db";
import type {
  DashboardOperationId,
  OperationTabId,
  PeriodPreset,
  SummaryFilterState,
} from "@/lib/dashfy-types";
import type { GeneralOverviewSummary } from "@/lib/dashfy-metrics";
import { formatBRL } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";
import {
  FinancialBreakdownDonut,
  RevenueTrendChart,
} from "./AnalyticsCharts";

interface GeneralOverviewViewProps {
  summary: GeneralOverviewSummary;
  filters: SummaryFilterState;
  onFiltersChange: (next: SummaryFilterState) => void;
  omegaBalance: BalanceSnapshotRecord | null;
  onOpenOperation: (dashboardId: DashboardOperationId, tabId: OperationTabId) => void;
}

const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "month", label: "Mês" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Custom" },
];

export function GeneralOverviewView({
  summary,
  filters,
  onFiltersChange,
  omegaBalance,
  onOpenOperation,
}: GeneralOverviewViewProps) {
  const omegaAvailable = omegaBalance?.available ?? 0;
  const omegaPending = omegaBalance?.pending ?? 0;
  const omegaLock = omegaBalance?.fundLock ?? 0;
  const omegaTotal = omegaAvailable + omegaPending + omegaLock;

  return (
    <div className="space-y-6">
      {/* Barra de Período do Dash Geral */}
      <div className="dashfy-surface p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base sm:text-lg font-semibold text-white tracking-tight">
            Resumo Consolidado de Todas as Operações
          </h2>
          <p className="text-xs text-slate-400">
            Soma em tempo real de {summary.operations.length} operação(ões) configuradas na Dashfy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-[#5ea1ff]" />
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-[#050b18] border border-blue-200/10 rounded-xl p-1 text-xs">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onFiltersChange({ ...filters, period: p.id })}
                className={`btn-pressable px-3 py-1.5 rounded-lg transition-all ${
                  filters.period === p.id
                    ? "bg-[#1d74ff] text-white font-semibold shadow-[0_6px_16px_-5px_rgba(29,116,255,0.75)]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {filters.period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.customFrom}
                onChange={(e) =>
                  onFiltersChange({ ...filters, customFrom: e.target.value })
                }
                className="dashfy-input h-9 px-2.5 text-xs"
              />
              <span className="text-slate-500 text-xs">até</span>
              <input
                type="date"
                value={filters.customTo}
                onChange={(e) =>
                  onFiltersChange({ ...filters, customTo: e.target.value })
                }
                className="dashfy-input h-9 px-2.5 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* LINHA 1 — 4 CARDS CONSOLIDADOS MESTRES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Faturamento Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(summary.grossRevenue)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span>Todas as operações</span>
            <span className="tabular-nums font-medium text-slate-200">
              {summary.totalApprovedOrders} vendas/conv.
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Receita Líquida Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(summary.netRevenue)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span className="tabular-nums">Taxas: {formatBRL(summary.totalFees)}</span>
            <span className="font-medium text-slate-300">Pós-taxas</span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Anúncios &amp; Despesas
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/12 border border-[#3b8bff]/25 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3.5">
            <div className="dashfy-kpi-value text-2xl sm:text-[28px] font-bold text-white leading-tight">
              {formatBRL(summary.adExpenses + summary.otherExpenses)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span className="tabular-nums">Ads: {formatBRL(summary.adExpenses)}</span>
            <span className="tabular-nums font-medium text-slate-200">
              Outros: {formatBRL(summary.otherExpenses)}
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Lucro Consolidado
            </span>
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                summary.profit > 0
                  ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-400"
                  : summary.profit < 0
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
                summary.profit > 0
                  ? "text-emerald-400"
                  : summary.profit < 0
                    ? "text-rose-400"
                    : "text-slate-200"
              }`}
            >
              {formatBRL(summary.profit)}
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span>Resultado geral</span>
            <span
              className={`tabular-nums font-semibold ${
                summary.marginPct > 0
                  ? "text-emerald-400"
                  : summary.marginPct < 0
                    ? "text-rose-400"
                    : "text-slate-300"
              }`}
            >
              Margem: {summary.marginPct.toFixed(1)}%
            </span>
          </div>
        </SpotlightCard>
      </section>

      {/* LINHA 2 — 4 CARDS DE EFICIÊNCIA GERAL */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              ROAS Geral
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div
            className={`dashfy-kpi-value my-3 text-2xl font-bold ${
              summary.roas !== null
                ? summary.roas >= 1
                  ? "text-emerald-400"
                  : "text-rose-400"
                : "text-slate-400"
            }`}
          >
            {summary.roas !== null ? `${summary.roas.toFixed(2)}x` : "—"}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
            Faturamento total / Ads
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              ROI Geral
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`dashfy-kpi-value text-2xl font-bold ${
                summary.roiPct !== null
                  ? summary.roiPct >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {summary.roiPct !== null
                ? `${summary.roiPct >= 0 ? "+" : ""}${summary.roiPct.toFixed(1)}%`
                : "—"}
            </span>
            {summary.roiMultiplier !== null && (
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({summary.roiMultiplier.toFixed(2)}x)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10">
            Retorno líquido consolidado
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Saldo em Caixa
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="dashfy-kpi-value my-3 text-2xl font-bold text-white">
            {formatBRL(omegaTotal)}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span className="tabular-nums">Disp: {formatBRL(omegaAvailable)}</span>
            <span className="tabular-nums font-medium text-slate-300">
              Pend: {formatBRL(omegaPending)}
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">
              Vendas &amp; Conversões
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/10 border border-blue-200/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#5ea1ff]" />
            </div>
          </div>
          <div className="dashfy-kpi-value my-3 text-2xl font-bold text-white">
            {summary.totalApprovedOrders}
          </div>
          <div className="text-xs text-slate-400 pt-2.5 border-t border-blue-200/10 flex items-center justify-between gap-2">
            <span>{summary.operations.length} abas ativas</span>
            {summary.totalPendingCount > 0 && (
              <span className="tabular-nums font-medium text-amber-300">
                +{summary.totalPendingCount} pend.
              </span>
            )}
          </div>
        </SpotlightCard>
      </section>

      {/* COMPARATIVO DE TODAS AS OPERAÇÕES */}
      <SpotlightCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1d74ff]/15 border border-[#3b8bff]/30 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-[#5ea1ff]" />
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight">
                Resumo por Operação
              </h3>
              <p className="text-xs text-slate-400">
                Desempenho individual de cada aba no período selecionado
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-blue-200/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-blue-200/10 bg-[#050b18] text-slate-400 uppercase tracking-[0.06em] text-[10px]">
                <th className="py-3 px-4 font-semibold">Operação / Aba</th>
                <th className="py-3 px-4 font-semibold">Modo</th>
                <th className="py-3 px-4 font-semibold text-right">Faturamento</th>
                <th className="py-3 px-4 font-semibold text-right">Despesas / Ads</th>
                <th className="py-3 px-4 font-semibold text-right">Taxas</th>
                <th className="py-3 px-4 font-semibold text-right">ROAS</th>
                <th className="py-3 px-4 font-semibold text-right">ROI</th>
                <th className="py-3 px-4 font-semibold text-right">Lucro</th>
                <th className="py-3 px-4 font-semibold text-right">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
              {summary.operations.map((op) => {
                const totalOpCosts = op.metrics.adExpenses + op.metrics.otherExpenses;
                const totalOpFees =
                  op.metrics.checkoutOrPlatformFees + op.metrics.customFeesTotal;
                return (
                  <tr
                    key={op.dashboardId}
                    className="hover:bg-[#1d74ff]/[0.06] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{op.name}</div>
                      <div className="mt-1.5 w-28 h-1.5 rounded-full bg-blue-200/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#1d74ff] to-[#5ea1ff]"
                          style={{
                            width: `${Math.max(
                              op.metrics.grossRevenue > 0 ? 6 : 0,
                              op.revenueSharePct
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-[#3b8bff]/25 bg-[#1d74ff]/12 text-sky-200">
                        {op.mode === "tiktok" ? "TikTok Ads" : "OmegaPay"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-white font-semibold whitespace-nowrap">
                      {formatBRL(op.metrics.grossRevenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-300 whitespace-nowrap">
                      {formatBRL(totalOpCosts)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-400 whitespace-nowrap">
                      {formatBRL(totalOpFees)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-200 font-medium whitespace-nowrap">
                      {op.metrics.roas !== null ? `${op.metrics.roas.toFixed(2)}x` : "—"}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right tabular-nums font-medium whitespace-nowrap ${
                        op.metrics.roiPct !== null
                          ? op.metrics.roiPct >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {op.metrics.roiPct !== null
                        ? `${op.metrics.roiPct >= 0 ? "+" : ""}${op.metrics.roiPct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right tabular-nums font-semibold whitespace-nowrap ${
                        op.metrics.profit > 0
                          ? "text-emerald-400"
                          : op.metrics.profit < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                      }`}
                    >
                      {formatBRL(op.metrics.profit)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenOperation(op.dashboardId, "resumo")}
                        className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3b8bff]/25 bg-[#1d74ff]/10 hover:bg-[#1d74ff] hover:border-[#1d74ff] text-[11px] font-semibold text-sky-200 hover:text-white transition"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      {/* GRÁFICOS CONSOLIDADOS: EVOLUÇÃO DIÁRIA (CURVA/BARRAS) + COMPOSIÇÃO FINANCEIRA (DONUT) */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <SpotlightCard className="xl:col-span-8 p-5 sm:p-6">
          <RevenueTrendChart
            series={summary.dailySeries}
            title="Evolução Diária Consolidada"
            subtitle="Faturamento total, lucro líquido e despesas somando todas as operações"
            revenueLabel="Faturamento"
          />
        </SpotlightCard>

        <SpotlightCard className="xl:col-span-4 p-5 sm:p-6 flex flex-col justify-between">
          <FinancialBreakdownDonut
            profit={summary.profit}
            adExpenses={summary.adExpenses}
            fees={summary.totalFees}
            otherExpenses={summary.otherExpenses}
            marginPct={summary.marginPct}
          />
        </SpotlightCard>
      </section>
    </div>
  );
}
