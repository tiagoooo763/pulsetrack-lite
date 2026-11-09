"use client";

import React, { useMemo, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  formatBRL,
  formatDateBR,
  getPaymentMethodLabel,
} from "@/lib/format";
import type {
  ExpenseCategory,
  ManualExpenseRecord,
  TransactionRecord,
} from "@/lib/db";
import { BarChart3, PieChart } from "lucide-react";
import { SpotlightCard } from "./SpotlightCard";

interface FinancialChartsProps {
  transactions: TransactionRecord[];
  expenses: ManualExpenseRecord[];
}

export function FinancialCharts({
  transactions,
  expenses,
}: FinancialChartsProps) {
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // Agrupa por dia (YYYY-MM-DD) apenas vendas confirmadas (COMPLETED) vs despesas manuais
  const dailySeries = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        grossRevenue: number;
        netRevenue: number;
        expenses: number;
        profit: number;
      }
    >();

    for (const tx of transactions) {
      if (tx.status !== "COMPLETED") continue;
      const day = (tx.paidAt || tx.createdAt).slice(0, 10);
      const entry = map.get(day) || {
        date: day,
        grossRevenue: 0,
        netRevenue: 0,
        expenses: 0,
        profit: 0,
      };
      entry.grossRevenue += tx.grossAmount;
      entry.netRevenue += tx.netAmount;
      entry.profit = entry.netRevenue - entry.expenses;
      map.set(day, entry);
    }

    for (const exp of expenses) {
      const day = exp.expenseDate.slice(0, 10);
      const entry = map.get(day) || {
        date: day,
        grossRevenue: 0,
        netRevenue: 0,
        expenses: 0,
        profit: 0,
      };
      entry.expenses += exp.amount;
      entry.profit = entry.netRevenue - entry.expenses;
      map.set(day, entry);
    }

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return sorted.slice(-14); // Últimos 14 dias com movimentação
  }, [transactions, expenses]);

  const maxDailyValue = useMemo(() => {
    let max = 100;
    for (const d of dailySeries) {
      if (d.netRevenue > max) max = d.netRevenue;
      if (d.expenses > max) max = d.expenses;
    }
    return max;
  }, [dailySeries]);

  const expenseBreakdown = useMemo(() => {
    const totals: Record<ExpenseCategory, number> = {
      META_ADS: 0,
      TIKTOK_ADS: 0,
      OTHER_ADS: 0,
      TOOLS: 0,
      OTHER: 0,
    };
    let grandTotal = 0;
    for (const e of expenses) {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
      grandTotal += e.amount;
    }

    return (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(
      (cat) => ({
        category: cat,
        label: EXPENSE_CATEGORIES[cat].label,
        amount: totals[cat],
        percent: grandTotal > 0 ? (totals[cat] / grandTotal) * 100 : 0,
      })
    );
  }, [expenses]);

  const paymentMethodBreakdown = useMemo(() => {
    const totals = new Map<string, { count: number; net: number }>();
    let totalNet = 0;

    for (const tx of transactions) {
      if (tx.status !== "COMPLETED") continue;
      const key = tx.paymentMethod || "PIX";
      const cur = totals.get(key) || { count: 0, net: 0 };
      cur.count += 1;
      cur.net += tx.netAmount;
      totalNet += tx.netAmount;
      totals.set(key, cur);
    }

    return Array.from(totals.entries())
      .map(([method, val]) => ({
        method,
        label: getPaymentMethodLabel(method),
        count: val.count,
        net: val.net,
        percent: totalNet > 0 ? (val.net / totalNet) * 100 : 0,
      }))
      .sort((a, b) => b.net - a.net);
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Gráfico 1: Evolução Diária */}
      <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 flex flex-col justify-between bento-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Evolução Diária de Vendas e Despesas
              </h3>
              <p className="text-xs text-zinc-400">
                Receita líquida vs. custos operacionais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-white inline-block shadow-sm" />
              Receita Líquida
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-600 inline-block" />
              Despesas
            </span>
          </div>
        </div>

        {dailySeries.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl text-center px-4 bg-white/[0.01]">
            <p className="text-xs text-zinc-400">
              Nenhuma movimentação registrada no período selecionado.
            </p>
          </div>
        ) : (
          <div className="relative pt-2">
            {hoveredDayIndex !== null && dailySeries[hoveredDayIndex] && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#08080a] border border-white/15 px-3.5 py-2 text-xs shadow-lg">
                <span className="font-medium text-white">
                  {formatDateBR(dailySeries[hoveredDayIndex].date)}
                </span>
                <div className="flex flex-wrap items-center gap-3 tabular-nums font-mono">
                  <span className="text-zinc-200">
                    Líquido: {formatBRL(dailySeries[hoveredDayIndex].netRevenue)}
                  </span>
                  <span className="text-zinc-400">
                    Despesas: {formatBRL(dailySeries[hoveredDayIndex].expenses)}
                  </span>
                  <span>
                    Lucro:{" "}
                    <span
                      className={
                        dailySeries[hoveredDayIndex].profit > 0
                          ? "text-emerald-400 font-semibold"
                          : dailySeries[hoveredDayIndex].profit < 0
                          ? "text-rose-400 font-semibold"
                          : "text-zinc-300 font-semibold"
                      }
                    >
                      {formatBRL(dailySeries[hoveredDayIndex].profit)}
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div className="h-48 flex items-end gap-2 sm:gap-3 pt-3 pb-6 px-1 border-b border-white/[0.08]">
              {dailySeries.map((day, idx) => {
                const netHeightPct = Math.max(
                  day.netRevenue > 0 ? 5 : 0,
                  Math.round((day.netRevenue / maxDailyValue) * 100)
                );
                const expHeightPct = Math.max(
                  day.expenses > 0 ? 5 : 0,
                  Math.round((day.expenses / maxDailyValue) * 100)
                );
                const shortDate = day.date.slice(5).split("-").reverse().join("/");

                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      <div
                        style={{ height: `${netHeightPct}%` }}
                        className="w-full max-w-[14px] rounded-t-sm bg-white transition-all duration-200 group-hover:bg-zinc-200 group-hover:scale-y-[1.03] origin-bottom shadow-sm"
                        title={`Receita Líquida: ${formatBRL(day.netRevenue)}`}
                      />
                      <div
                        style={{ height: `${expHeightPct}%` }}
                        className="w-full max-w-[14px] rounded-t-sm bg-zinc-600 transition-all duration-200 group-hover:bg-zinc-500 group-hover:scale-y-[1.03] origin-bottom"
                        title={`Despesas: ${formatBRL(day.expenses)}`}
                      />
                    </div>
                    <span className="absolute -bottom-5 text-[10px] text-zinc-500 font-mono tabular-nums group-hover:text-zinc-300 transition-colors">
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* Gráfico 2: Despesas e Formas de Pagamento */}
      <SpotlightCard className="p-5 sm:p-6 flex flex-col justify-between space-y-4 bento-card">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <PieChart className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Formas de Pagamento
            </h3>
          </div>

          {paymentMethodBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              Nenhuma venda aprovada.
            </p>
          ) : (
            <div className="space-y-3">
              {paymentMethodBreakdown.map((item) => (
                <div key={item.method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{item.label}</span>
                    <span className="text-white font-mono tabular-nums">
                      {formatBRL(item.net)}{" "}
                      <span className="text-zinc-500 text-[11px]">
                        ({item.percent.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/[0.08]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
            Distribuição de Despesas
          </h4>
          <div className="space-y-2">
            {expenseBreakdown
              .filter((e) => e.amount > 0)
              .map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-200 font-mono tabular-nums">
                    {formatBRL(item.amount)}
                  </span>
                </div>
              ))}
            {expenseBreakdown.every((e) => e.amount === 0) && (
              <p className="text-xs text-zinc-500 text-center py-2">
                Nenhum gasto cadastrado.
              </p>
            )}
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
