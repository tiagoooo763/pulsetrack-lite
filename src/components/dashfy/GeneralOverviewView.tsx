"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
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
import { formatBRL, formatDateBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const omegaAvailable = omegaBalance?.available ?? 0;
  const omegaPending = omegaBalance?.pending ?? 0;
  const omegaLock = omegaBalance?.fundLock ?? 0;
  const omegaTotal = omegaAvailable + omegaPending + omegaLock;

  const maxChartVal = Math.max(
    1,
    ...summary.dailySeries.map((d) =>
      Math.max(d.grossRevenue, d.netRevenue, d.expenses, Math.abs(d.profit))
    )
  );

  return (
    <div className="space-y-4">
      {/* Barra de Período do Dash Geral */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0e] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Resumo Consolidado de Todas as Operações
          </h2>
          <p className="text-xs text-zinc-400">
            Soma em tempo real de {summary.operations.length} operação(ões) configuradas no Dashfy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-[#050507] border border-white/10 rounded-xl p-1 text-xs">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onFiltersChange({ ...filters, period: p.id })}
                className={`btn-pressable px-3 py-1 rounded-lg transition-all ${
                  filters.period === p.id
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {filters.period === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.customFrom}
                onChange={(e) =>
                  onFiltersChange({ ...filters, customFrom: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-[#050507] px-2.5 py-1 text-xs text-white focus:border-white focus:outline-none"
              />
              <span className="text-zinc-500 text-xs">-</span>
              <input
                type="date"
                value={filters.customTo}
                onChange={(e) =>
                  onFiltersChange({ ...filters, customTo: e.target.value })
                }
                className="rounded-lg border border-white/10 bg-[#050507] px-2.5 py-1 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* LINHA 1 — 4 CARDS CONSOLIDADOS MESTRES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Faturamento Total
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(summary.grossRevenue)}
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>Todas as operações</span>
            <span className="font-mono text-zinc-300">
              {summary.totalApprovedOrders} vendas/conv.
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Receita Líquida Total
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Banknote className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(summary.netRevenue)}
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>Taxas: {formatBRL(summary.totalFees)}</span>
            <span className="text-zinc-300">Pós-taxas</span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Anúncios &amp; Despesas
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
              {formatBRL(summary.adExpenses + summary.otherExpenses)}
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>Ads: {formatBRL(summary.adExpenses)}</span>
            <span className="font-mono text-zinc-300">
              Outros: {formatBRL(summary.otherExpenses)}
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Lucro Consolidado
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
            </div>
          </div>
          <div className="my-3">
            <div
              className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight ${
                summary.profit > 0
                  ? "text-emerald-400"
                  : summary.profit < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
              }`}
            >
              {formatBRL(summary.profit)}
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>Resultado geral</span>
            <span
              className={`font-mono ${
                summary.marginPct > 0
                  ? "text-emerald-400"
                  : summary.marginPct < 0
                    ? "text-rose-400"
                    : "text-zinc-300"
              }`}
            >
              Margem: {summary.marginPct.toFixed(1)}%
            </span>
          </div>
        </SpotlightCard>
      </section>

      {/* LINHA 2 — 4 CARDS DE EFICIÊNCIA GERAL */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              ROAS Geral
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div
            className={`my-2.5 text-2xl font-semibold font-mono tabular-nums ${
              summary.roas !== null
                ? summary.roas >= 1
                  ? "text-emerald-400"
                  : "text-rose-400"
                : "text-zinc-400"
            }`}
          >
            {summary.roas !== null ? `${summary.roas.toFixed(2)}x` : "—"}
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06]">
            Faturamento total / Ads
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              ROI Geral
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold font-mono tabular-nums ${
                summary.roiPct !== null
                  ? summary.roiPct >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                  : "text-zinc-400"
              }`}
            >
              {summary.roiPct !== null
                ? `${summary.roiPct >= 0 ? "+" : ""}${summary.roiPct.toFixed(1)}%`
                : "—"}
            </span>
            {summary.roiMultiplier !== null && (
              <span className="text-xs font-mono text-zinc-400">
                ({summary.roiMultiplier.toFixed(2)}x)
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06]">
            Retorno líquido consolidado
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Saldo em Caixa
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-2.5 text-2xl font-semibold text-white font-mono tabular-nums">
            {formatBRL(omegaTotal)}
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>Disp: {formatBRL(omegaAvailable)}</span>
            <span className="font-mono text-zinc-300">
              Pend: {formatBRL(omegaPending)}
            </span>
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Vendas &amp; Conversões
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="my-2.5 text-2xl font-semibold text-white font-mono tabular-nums">
            {summary.totalApprovedOrders}
          </div>
          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span>{summary.operations.length} abas ativas</span>
            {summary.totalPendingCount > 0 && (
              <span className="font-mono text-zinc-300">
                +{summary.totalPendingCount} pend.
              </span>
            )}
          </div>
        </SpotlightCard>
      </section>

      {/* COMPARATIVO DE TODAS AS OPERAÇÕES */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-300" />
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Resumo por Operação
              </h3>
              <p className="text-xs text-zinc-400">
                Desempenho individual de cada aba no período selecionado
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 font-medium">Operação / Aba</th>
                <th className="py-2.5 px-3 font-medium">Modo</th>
                <th className="py-2.5 px-3 font-medium text-right">Faturamento</th>
                <th className="py-2.5 px-3 font-medium text-right">Despesas / Ads</th>
                <th className="py-2.5 px-3 font-medium text-right">Taxas</th>
                <th className="py-2.5 px-3 font-medium text-right">ROAS</th>
                <th className="py-2.5 px-3 font-medium text-right">ROI</th>
                <th className="py-2.5 px-3 font-medium text-right">Lucro</th>
                <th className="py-2.5 px-3 font-medium text-right">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
              {summary.operations.map((op) => {
                const totalOpCosts = op.metrics.adExpenses + op.metrics.otherExpenses;
                const totalOpFees =
                  op.metrics.checkoutOrPlatformFees + op.metrics.customFeesTotal;
                return (
                  <tr
                    key={op.dashboardId}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{op.name}</div>
                      <div className="mt-1 w-28 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${Math.max(op.metrics.grossRevenue > 0 ? 6 : 0, op.revenueSharePct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/10 bg-white/[0.04] text-zinc-300">
                        {op.mode === "tiktok" ? "TikTok Ads" : "OmegaPay"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white font-medium whitespace-nowrap">
                      {formatBRL(op.metrics.grossRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                      {formatBRL(totalOpCosts)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-400 whitespace-nowrap">
                      {formatBRL(totalOpFees)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-300 whitespace-nowrap">
                      {op.metrics.roas !== null ? `${op.metrics.roas.toFixed(2)}x` : "—"}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono whitespace-nowrap ${
                        op.metrics.roiPct !== null
                          ? op.metrics.roiPct >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {op.metrics.roiPct !== null
                        ? `${op.metrics.roiPct >= 0 ? "+" : ""}${op.metrics.roiPct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                        op.metrics.profit > 0
                          ? "text-emerald-400"
                          : op.metrics.profit < 0
                            ? "text-rose-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {formatBRL(op.metrics.profit)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenOperation(op.dashboardId, "resumo")}
                        className="btn-pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white hover:text-black text-[11px] font-medium text-white transition"
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

      {/* GRÁFICO DIÁRIO CONSOLIDADO */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-300" />
              <span>Evolução Diária Consolidada</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Faturamento total vs despesas somando todas as operações
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-white" />
              Faturamento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-600" />
              Despesas
            </span>
          </div>
        </div>

        {summary.dailySeries.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-xs text-zinc-500">
            <BarChart3 className="w-6 h-6 text-zinc-600 mb-2" />
            <span>Sem movimentações registradas no período selecionado.</span>
          </div>
        ) : (
          <div className="relative h-56 w-full flex items-end gap-2 pt-8 pb-6 px-2 rounded-xl bg-[#08080a] border border-white/[0.06]">
            {summary.dailySeries.map((day, idx) => {
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
                    <div className="absolute -top-2 z-20 -translate-y-full w-44 rounded-xl border border-white/15 bg-[#0c0c0e] p-2.5 shadow-xl text-[11px] pointer-events-none">
                      <div className="font-mono font-semibold text-white mb-1">
                        {formatDateBR(day.date)}
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span>Faturamento:</span>
                        <span className="font-mono text-white">
                          {formatBRL(day.grossRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Despesas:</span>
                        <span className="font-mono text-zinc-300">
                          {formatBRL(day.expenses)}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-200 font-semibold pt-1 mt-1 border-t border-white/10">
                        <span>Lucro:</span>
                        <span
                          className={`font-mono ${
                            day.profit > 0
                              ? "text-emerald-400"
                              : day.profit < 0
                                ? "text-rose-400"
                                : "text-zinc-300"
                          }`}
                        >
                          {formatBRL(day.profit)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="w-full h-full flex items-end justify-center gap-1 px-0.5">
                    <div
                      className="w-1/2 max-w-[18px] rounded-t-md bg-white/90 transition-all duration-300 group-hover:bg-white"
                      style={{ height: `${revH}%` }}
                    />
                    {day.expenses > 0 && (
                      <div
                        className="w-1/2 max-w-[14px] rounded-t-md bg-zinc-600 transition-all duration-300 group-hover:bg-zinc-500"
                        style={{ height: `${expH}%` }}
                      />
                    )}
                  </div>

                  <span className="absolute -bottom-5 text-[10px] font-mono text-zinc-500 group-hover:text-zinc-200 whitespace-nowrap">
                    {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
