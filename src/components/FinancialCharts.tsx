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

    return sorted.slice(-14); // Mostra até os últimos 14 dias com movimentação no período
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
        color: EXPENSE_CATEGORIES[cat].color,
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Gráfico 1: Evolução Diária (Receita Líquida x Despesas x Lucro) */}
      <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Evolução Diária: Receita Líquida vs. Despesas
              </h3>
              <p className="text-xs text-zinc-400">
                Considera exclusivamente vendas efetivamente aprovadas (<code className="text-zinc-300">COMPLETED</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              Receita Líquida
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              Despesas
            </span>
          </div>
        </div>

        {dailySeries.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center border border-dashed border-white/[0.06] rounded-xl text-center px-4">
            <p className="text-sm text-zinc-400">
              Nenhuma venda aprovada ou despesa registrada no período selecionado.
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Receba webhooks da OmegaPay ou simule uma notificação na aba &ldquo;Integração &amp; Guia&rdquo;.
            </p>
          </div>
        ) : (
          <div className="relative pt-4">
            {hoveredDayIndex !== null && dailySeries[hoveredDayIndex] && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2 text-xs">
                <span className="font-medium text-zinc-200">
                  {formatDateBR(dailySeries[hoveredDayIndex].date)}
                </span>
                <div className="flex flex-wrap items-center gap-4 tabular-nums">
                  <span className="text-emerald-400">
                    Líquido: {formatBRL(dailySeries[hoveredDayIndex].netRevenue)}
                  </span>
                  <span className="text-rose-400">
                    Despesas: {formatBRL(dailySeries[hoveredDayIndex].expenses)}
                  </span>
                  <span
                    className={
                      dailySeries[hoveredDayIndex].profit >= 0
                        ? "text-emerald-300 font-semibold"
                        : "text-rose-300 font-semibold"
                    }
                  >
                    Lucro: {formatBRL(dailySeries[hoveredDayIndex].profit)}
                  </span>
                </div>
              </div>
            )}

            <div className="h-52 flex items-end gap-2 sm:gap-3 pt-4 pb-6 px-2 border-b border-white/[0.06]">
              {dailySeries.map((day, idx) => {
                const netHeightPct = Math.max(
                  day.netRevenue > 0 ? 4 : 0,
                  Math.round((day.netRevenue / maxDailyValue) * 100)
                );
                const expHeightPct = Math.max(
                  day.expenses > 0 ? 4 : 0,
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
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div
                        style={{ height: `${netHeightPct}%` }}
                        className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-300 group-hover:brightness-110"
                        title={`Receita Líquida: ${formatBRL(day.netRevenue)}`}
                      />
                      <div
                        style={{ height: `${expHeightPct}%` }}
                        className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-300 group-hover:brightness-110"
                        title={`Despesas: ${formatBRL(day.expenses)}`}
                      />
                    </div>
                    <span className="absolute -bottom-5 text-[10px] text-zinc-400 tabular-nums">
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gráfico 2: Composição de Despesas & Métodos de Pagamento */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between space-y-5">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Distribuição de Gastos &amp; Checkout
              </h3>
              <p className="text-xs text-zinc-400">
                Despesas manuais e métodos aprovados
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Despesas por Categoria
            </p>
            {expenseBreakdown.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{item.label}</span>
                  <span className="text-zinc-200 font-medium tabular-nums">
                    {formatBRL(item.amount)}{" "}
                    <span className="text-zinc-500 text-[11px]">
                      ({item.percent.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, item.percent)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Receita Líquida por Método (OmegaPay)
          </p>
          {paymentMethodBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Sem vendas aprovadas no período.
            </p>
          ) : (
            paymentMethodBreakdown.map((m) => (
              <div
                key={m.method}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-zinc-200 font-medium">{m.label}</span>
                  <span className="text-zinc-500">({m.count}x)</span>
                </div>
                <span className="text-emerald-300 font-medium tabular-nums">
                  {formatBRL(m.net)} ({m.percent.toFixed(0)}%)
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
