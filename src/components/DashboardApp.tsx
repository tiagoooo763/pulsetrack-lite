"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BalanceSnapshotRecord,
  ExpenseCategory,
  ManualExpenseRecord,
  TransactionRecord,
  TransferRecord,
  WebhookEventRecord,
} from "@/lib/db";
import {
  EXPENSE_CATEGORIES,
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  getPaymentMethodLabel,
  getTransactionStatusMeta,
} from "@/lib/format";
import { FinancialCharts } from "./FinancialCharts";
import { IntegrationAndGuideTab } from "./IntegrationAndGuideTab";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Filter,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";
type ActiveTab = "overview" | "sales" | "expenses" | "integration";

interface IntegrationStatus {
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: string;
  apiBaseUrl: string;
  isDefaultPassword: boolean;
}

interface DashboardPayload {
  transactions: TransactionRecord[];
  transfers: TransferRecord[];
  expenses: ManualExpenseRecord[];
  balance: BalanceSnapshotRecord | null;
  recentWebhooks: WebhookEventRecord[];
  integrationStatus: IntegrationStatus;
}

interface DashboardAppProps {
  onLogout: () => void;
}

export function DashboardApp({ onLogout }: DashboardAppProps) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filtro de período
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Atualização pontual de saldo (GET /gateway/producer/balance)
  const [syncingBalance, setSyncingBalance] = useState(false);
  const [balanceNotice, setBalanceNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filtros do Histórico de Vendas
  const [salesSearch, setSalesSearch] = useState("");
  const [salesStatusFilter, setSalesStatusFilter] = useState<string>("ALL");

  // Formulário de Despesas Manuais
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("META_ADS");
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as DashboardPayload;
        setData(json);
      }
    } catch {
      // Falha de rede silenciosa
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Cálculo de intervalo de datas para os filtros
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date = now;

    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === "7d") {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
    } else if (period === "30d") {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (period === "custom") {
      start = new Date(`${customFrom}T00:00:00`);
      end = new Date(`${customTo}T23:59:59`);
    } else {
      start = null; // Tudo
    }

    return { startDate: start, endDate: end };
  }, [period, customFrom, customTo]);

  // Transações filtradas pelo período
  const periodTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (!startDate) return data.transactions;
    return data.transactions.filter((tx) => {
      const dateToCompare = new Date(tx.paidAt || tx.createdAt);
      return dateToCompare >= startDate && dateToCompare <= endDate;
    });
  }, [data?.transactions, startDate, endDate]);

  // Transferências filtradas pelo período
  const periodTransfers = useMemo(() => {
    if (!data?.transfers) return [];
    if (!startDate) return data.transfers;
    return data.transfers.filter((tr) => {
      const d = new Date(tr.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data?.transfers, startDate, endDate]);

  // Despesas manuais filtradas pelo período
  const periodExpenses = useMemo(() => {
    if (!data?.expenses) return [];
    if (!startDate) return data.expenses;
    return data.expenses.filter((exp) => {
      const d = new Date(`${exp.expenseDate}T12:00:00`);
      return d >= startDate && d <= endDate;
    });
  }, [data?.expenses, startDate, endDate]);

  // Métricas Consolidadas do Dashboard
  const metrics = useMemo(() => {
    const approvedSales = periodTransactions.filter(
      (tx) => tx.status === "COMPLETED"
    );
    const pendingSales = periodTransactions.filter(
      (tx) => tx.status === "PENDING"
    );
    const refundedOrCanceledSales = periodTransactions.filter(
      (tx) =>
        tx.status === "REFUNDED" ||
        tx.status === "CANCELED" ||
        tx.status === "CHARGED_BACK"
    );

    const grossRevenue = approvedSales.reduce((acc, tx) => acc + tx.grossAmount, 0);
    const pendingGross = pendingSales.reduce((acc, tx) => acc + tx.grossAmount, 0);
    const checkoutFees = approvedSales.reduce((acc, tx) => acc + tx.feeAmount, 0);
    const netRevenue = approvedSales.reduce((acc, tx) => acc + tx.netAmount, 0);

    const approvalRate =
      periodTransactions.length > 0
        ? (approvedSales.length / periodTransactions.length) * 100
        : 0;

    const completedTransfers = periodTransfers.filter(
      (tr) => tr.status === "COMPLETED"
    );
    const pendingTransfers = periodTransfers.filter(
      (tr) => tr.status === "PENDING"
    );
    const receivedAmount = completedTransfers.reduce(
      (acc, tr) => acc + tr.receivedAmount,
      0
    );
    const pendingTransferAmount = pendingTransfers.reduce(
      (acc, tr) => acc + tr.amount,
      0
    );

    const adExpenses = periodExpenses
      .filter(
        (e) =>
          e.category === "META_ADS" ||
          e.category === "TIKTOK_ADS" ||
          e.category === "OTHER_ADS"
      )
      .reduce((acc, e) => acc + e.amount, 0);

    const metaAdsTotal = periodExpenses
      .filter((e) => e.category === "META_ADS")
      .reduce((acc, e) => acc + e.amount, 0);

    const tiktokAdsTotal = periodExpenses
      .filter((e) => e.category === "TIKTOK_ADS")
      .reduce((acc, e) => acc + e.amount, 0);

    const toolsAndOtherExpenses = periodExpenses
      .filter((e) => e.category === "TOOLS" || e.category === "OTHER")
      .reduce((acc, e) => acc + e.amount, 0);

    const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);

    // Lucro estimado = Receita líquida - Despesas
    const estimatedProfit = netRevenue - totalExpenses;
    const netMarginPct =
      netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;

    const roasNet = adExpenses > 0 ? netRevenue / adExpenses : null;
    const roasGross = adExpenses > 0 ? grossRevenue / adExpenses : null;

    return {
      grossRevenue,
      approvedCount: approvedSales.length,
      totalTxCount: periodTransactions.length,
      pendingCount: pendingSales.length,
      pendingGross,
      refundedOrCanceledCount: refundedOrCanceledSales.length,
      approvalRate,
      checkoutFees,
      netRevenue,
      receivedAmount,
      completedTransfersCount: completedTransfers.length,
      pendingTransferAmount,
      adExpenses,
      metaAdsTotal,
      tiktokAdsTotal,
      toolsAndOtherExpenses,
      totalExpenses,
      estimatedProfit,
      netMarginPct,
      roasNet,
      roasGross,
    };
  }, [periodTransactions, periodTransfers, periodExpenses]);

  // Filtro de busca na tabela de vendas
  const filteredSalesTable = useMemo(() => {
    return periodTransactions.filter((tx) => {
      if (salesStatusFilter !== "ALL" && tx.status !== salesStatusFilter) {
        return false;
      }
      if (!salesSearch.trim()) return true;
      const q = salesSearch.toLowerCase();
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.productName.toLowerCase().includes(q) ||
        (tx.clientIdentifier && tx.clientIdentifier.toLowerCase().includes(q))
      );
    });
  }, [periodTransactions, salesStatusFilter, salesSearch]);

  // Consulta pontual de saldo
  async function handleFetchOmegaPayBalance() {
    setSyncingBalance(true);
    setBalanceNotice(null);
    try {
      const res = await fetch("/api/omegapay/balance", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBalanceNotice({
          type: "error",
          message:
            json.error ||
            "Não foi possível consultar o saldo. Verifique as permissões da chave na OmegaPay.",
        });
      } else {
        setBalanceNotice({
          type: "success",
          message: "Saldo atualizado diretamente na OmegaPay.",
        });
        await fetchDashboard();
      }
    } catch {
      setBalanceNotice({
        type: "error",
        message: "Erro de conexão ao consultar saldo.",
      });
    } finally {
      setSyncingBalance(false);
    }
  }

  // Cadastrar despesa
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpenseError(null);
    const numericAmount = Number(expAmount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setExpenseError("Informe um valor válido maior que zero.");
      return;
    }
    setSubmittingExpense(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          title:
            expDescription.trim() || EXPENSE_CATEGORIES[expCategory].label,
          amount: numericAmount,
          expenseDate: expDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setExpenseError(json.error || "Erro ao registrar despesa.");
      } else {
        setExpDescription("");
        setExpAmount("");
        await fetchDashboard();
      }
    } catch {
      setExpenseError("Erro ao salvar despesa no servidor.");
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Excluir despesa
  async function handleDeleteExpense(id: string) {
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch {
      // Silencioso
    }
  }

  async function handleLogoutClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050507] text-zinc-300">
        <div className="flex items-center gap-3 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-white" />
          <span>Carregando PulseTrack Lite...</span>
        </div>
      </div>
    );
  }

  const omegaBalanceAvailable = data.balance?.available ?? null;
  const omegaBalancePending = data.balance?.pending ?? null;
  const omegaBalanceFundLock = data.balance?.fundLock ?? null;
  const omegaBalanceTotal =
    omegaBalanceAvailable !== null
      ? omegaBalanceAvailable +
        (omegaBalancePending ?? 0) +
        (omegaBalanceFundLock ?? 0)
      : null;

  const navItems = [
    {
      id: "overview" as ActiveTab,
      label: "Visão Geral",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "sales" as ActiveTab,
      label: "Histórico de Vendas",
      icon: ShoppingBag,
      badge: periodTransactions.length,
    },
    {
      id: "expenses" as ActiveTab,
      label: "Despesas Manuais",
      icon: Receipt,
      badge: periodExpenses.length,
    },
    {
      id: "integration" as ActiveTab,
      label: "Integração & API",
      icon: Sliders,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex">
      {/* ==================== SIDEBAR LATERAL ESQUERDA ==================== */}
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 border-r border-white/10 bg-[#08080a] z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm">
                <Activity className="w-4 h-4 text-black stroke-[2.8]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">
                    PulseTrack
                  </span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                    Lite
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">OmegaPay Finance</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="p-3 flex-1 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Menu Principal
            </div>
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-black text-white"
                          : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick Actions in Sidebar */}
            <div className="pt-4 mt-4 border-t border-white/[0.08] px-3 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Ações Rápidas
              </span>
              <button
                type="button"
                onClick={handleFetchOmegaPayBalance}
                disabled={syncingBalance}
                className="w-full flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncingBalance ? "animate-spin" : ""
                  }`}
                />
                <span className="truncate">
                  {syncingBalance ? "Consultando..." : "Atualizar Saldo"}
                </span>
              </button>
            </div>
          </div>

          {/* User Profile & Logout Footer */}
          <div className="p-4 border-t border-white/[0.08] bg-[#050507]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  T
                </div>
                <div className="truncate">
                  <span className="text-xs font-medium text-white block truncate">
                    mendoncat831@gmail.com
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    Administrador
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ==================== ÁREA DE CONTEÚDO PRINCIPAL ==================== */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050507]/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {activeTab === "overview" && "Visão Geral Financeira"}
                {activeTab === "sales" && "Histórico de Transações"}
                {activeTab === "expenses" && "Controle de Despesas Manuais"}
                {activeTab === "integration" && "Integração & Documentação"}
              </h2>
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0c0c0e] border border-white/10 rounded-xl p-1 text-xs">
            {(
              [
                { id: "today", label: "Hoje" },
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "month", label: "Mês" },
                { id: "all", label: "Tudo" },
                { id: "custom", label: "Custom" },
              ] as { id: PeriodPreset; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 rounded-lg transition ${
                  period === p.id
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <div className="flex items-center gap-1 pl-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#050507] px-2 py-0.5 text-xs text-white"
                />
                <span className="text-zinc-500">-</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#050507] px-2 py-0.5 text-xs text-white"
                />
              </div>
            )}
          </div>
        </header>

        {/* Notices */}
        <div className="px-4 sm:px-6 pt-4">
          {balanceNotice && (
            <div
              className={`rounded-xl border p-3.5 text-xs flex items-center justify-between ${
                balanceNotice.type === "success"
                  ? "border-white/20 bg-white/5 text-zinc-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              <span>{balanceNotice.message}</span>
              <button
                type="button"
                onClick={() => setBalanceNotice(null)}
                className="text-zinc-400 hover:text-white ml-3"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-5">
          {/* ==================== ABA 1: VISÃO GERAL ==================== */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* LINHA 1 — 4 CARDS MESTRES ENCAIXADOS */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Faturamento Bruto */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Faturamento Bruto
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <DollarSign className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {formatBRL(metrics.grossRevenue)}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>Vendas aprovadas</span>
                    {metrics.pendingGross > 0 && (
                      <span className="text-zinc-300 font-mono">
                        +{formatBRL(metrics.pendingGross)} pend.
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Receita Líquida */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Receita Líquida
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Banknote className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {formatBRL(metrics.netRevenue)}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>Após taxas do checkout</span>
                    <span className="text-zinc-300">Base do Lucro</span>
                  </div>
                </div>

                {/* 3. Lucro Estimado — HERÓI (NÚMERO VERDE SE LUCRO, VERMELHO SE PREJUÍZO) */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Lucro Estimado
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      {metrics.estimatedProfit >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                  </div>
                  <div className="my-3">
                    <div
                      className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight ${
                        metrics.estimatedProfit >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {formatBRL(metrics.estimatedProfit)}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>Líquido - Despesas</span>
                    <span className="font-mono text-zinc-300">
                      Margem: {metrics.netMarginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 4. Vendas Aprovadas */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Vendas Aprovadas
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {metrics.approvedCount}
                    </div>
                    <span className="text-xs text-zinc-400">
                      ({metrics.approvalRate.toFixed(1)}% conv.)
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>{metrics.pendingCount} pendentes</span>
                    <span>{metrics.refundedOrCanceledCount} cancel./reemb.</span>
                  </div>
                </div>
              </section>

              {/* LINHA 2 — SALDO OMEGAPAY & OPERACIONAL (4 CARDS ENCAIXADOS) */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 5. Saldo Informado OmegaPay */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Saldo OmegaPay
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>

                  {omegaBalanceAvailable === null ? (
                    <div className="my-2.5">
                      <span className="text-xs text-zinc-400">
                        Não sincronizado ainda
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Use o botão Atualizar Saldo na barra lateral.
                      </p>
                    </div>
                  ) : (
                    <div className="my-2 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Disponível:</span>
                        <span className="font-mono text-white font-semibold">
                          {formatBRL(omegaBalanceAvailable)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-500">Pendente:</span>
                        <span className="font-mono text-zinc-300">
                          {formatBRL(omegaBalancePending ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-500">Retido:</span>
                        <span className="font-mono text-zinc-400">
                          {formatBRL(omegaBalanceFundLock ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>
                      {data.balance?.fetchedAt
                        ? formatDateBR(data.balance.fetchedAt)
                        : "GET /producer/balance"}
                    </span>
                    {omegaBalanceTotal !== null && (
                      <span className="font-mono text-white font-medium">
                        Total: {formatBRL(omegaBalanceTotal)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 6. Valor Recebido / Transferido */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Valor Recebido
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Landmark className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {formatBRL(metrics.receivedAmount)}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>{metrics.completedTransfersCount} saques concluídos</span>
                    {metrics.pendingTransferAmount > 0 && (
                      <span className="text-zinc-300 font-mono">
                        +{formatBRL(metrics.pendingTransferAmount)} em proc.
                      </span>
                    )}
                  </div>
                </div>

                {/* 7. Taxas do Checkout */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Taxas do Checkout
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Percent className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {formatBRL(metrics.checkoutFees)}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>Taxas OmegaPay</span>
                    <span className="text-zinc-300 font-mono">
                      {metrics.grossRevenue > 0
                        ? `${((metrics.checkoutFees / metrics.grossRevenue) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>

                {/* 8. Gastos com Anúncios & ROAS */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Anúncios &amp; ROAS
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Megaphone className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3 flex items-baseline justify-between">
                    <div className="text-2xl sm:text-3xl font-semibold text-white font-mono tabular-nums tracking-tight">
                      {formatBRL(metrics.adExpenses)}
                    </div>
                    <div className="text-xs font-mono font-medium text-zinc-300">
                      ROAS: {metrics.roasNet !== null ? `${metrics.roasNet.toFixed(2)}x` : "—"}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>Meta + TikTok + Ads</span>
                    <span className="text-zinc-300 font-mono">
                      Outros: {formatBRL(metrics.toolsAndOtherExpenses)}
                    </span>
                  </div>
                </div>
              </section>

              {/* GRÁFICOS FINANCEIROS */}
              <FinancialCharts
                transactions={periodTransactions}
                expenses={periodExpenses}
              />

              {/* ÚLTIMAS TRANSAÇÕES E RESUMO */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#0c0c0e] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Últimas Transações
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Vendas registradas em tempo real via webhook
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sales")}
                      className="text-xs text-white hover:underline font-medium"
                    >
                      Ver todas &rarr;
                    </button>
                  </div>

                  {periodTransactions.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-white/10 rounded-lg text-xs text-zinc-500">
                      Nenhuma transação no período selecionado.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-zinc-500 uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-2 font-medium">Data</th>
                            <th className="py-2.5 px-2 font-medium">Produto</th>
                            <th className="py-2.5 px-2 font-medium">ID Transação</th>
                            <th className="py-2.5 px-2 font-medium text-right">Bruto</th>
                            <th className="py-2.5 px-2 font-medium text-right">Líquido</th>
                            <th className="py-2.5 px-2 font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {periodTransactions.slice(0, 6).map((tx) => {
                            const meta = getTransactionStatusMeta(tx.status);
                            return (
                              <tr key={tx.id} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 px-2 text-zinc-400 font-mono whitespace-nowrap">
                                  {formatDateBR(tx.paidAt || tx.createdAt)}
                                </td>
                                <td className="py-2.5 px-2 text-white font-medium truncate max-w-[180px]">
                                  {tx.productName}
                                </td>
                                <td className="py-2.5 px-2 text-zinc-400 font-mono">
                                  {tx.id}
                                </td>
                                <td className="py-2.5 px-2 text-right text-zinc-300 font-mono">
                                  {formatBRL(tx.grossAmount)}
                                </td>
                                <td className="py-2.5 px-2 text-right text-white font-mono font-medium">
                                  {formatBRL(tx.netAmount)}
                                </td>
                                <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`}
                                    />
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

                {/* Resumo Rápido de Despesas */}
                <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">
                        Despesas do Período
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("expenses")}
                        className="text-xs text-white hover:underline"
                      >
                        + Lançar
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs py-1 border-b border-white/[0.05]">
                        <span className="text-zinc-400">Meta Ads:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.metaAdsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/[0.05]">
                        <span className="text-zinc-400">TikTok Ads:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.tiktokAdsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b border-white/[0.05]">
                        <span className="text-zinc-400">Ferramentas / Outros:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.toolsAndOtherExpenses)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 font-semibold">
                        <span className="text-zinc-200">Total de Despesas:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.08] text-[11px] text-zinc-500">
                    O lucro estimado é calculado instantaneamente subtraindo as despesas cadastradas da receita líquida.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ABA 2: HISTÓRICO DE VENDAS ==================== */}
          {activeTab === "sales" && (
            <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Histórico Completo de Vendas
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {filteredSalesTable.length} transações encontradas
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      placeholder="Buscar por ID ou produto..."
                      className="rounded-lg border border-white/10 bg-[#050507] pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  </div>

                  <select
                    value={salesStatusFilter}
                    onChange={(e) => setSalesStatusFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#050507] px-3 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                  >
                    <option value="ALL">Todos os status</option>
                    <option value="COMPLETED">Aprovadas</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="REFUNDED">Reembolsadas</option>
                    <option value="CANCELED">Canceladas</option>
                    <option value="CHARGED_BACK">Chargeback</option>
                  </select>
                </div>
              </div>

              {filteredSalesTable.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-lg text-xs text-zinc-500">
                  Nenhuma transação encontrada com os filtros atuais.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3 font-medium">Data</th>
                        <th className="py-2.5 px-3 font-medium">Produto</th>
                        <th className="py-2.5 px-3 font-medium">ID Transação</th>
                        <th className="py-2.5 px-3 font-medium">Método</th>
                        <th className="py-2.5 px-3 font-medium text-right">Bruto</th>
                        <th className="py-2.5 px-3 font-medium text-right">Taxa</th>
                        <th className="py-2.5 px-3 font-medium text-right">Líquido</th>
                        <th className="py-2.5 px-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredSalesTable.map((tx) => {
                        const meta = getTransactionStatusMeta(tx.status);
                        return (
                          <tr key={tx.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-zinc-400 font-mono whitespace-nowrap">
                              {formatDateTimeBR(tx.paidAt || tx.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 text-white font-medium max-w-[200px] truncate">
                              {tx.productName}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400 font-mono">
                              {tx.id}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400">
                              {getPaymentMethodLabel(tx.paymentMethod)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-zinc-300 font-mono">
                              {formatBRL(tx.grossAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-zinc-400 font-mono">
                              {formatBRL(tx.feeAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-white font-mono font-medium">
                              {formatBRL(tx.netAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`}
                                />
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
          )}

          {/* ==================== ABA 3: DESPESAS MANUAIS ==================== */}
          {activeTab === "expenses" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Formulário */}
              <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Adicionar Despesa Manual
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Cadastre gastos sem conectar APIs externas
                  </p>
                </div>

                {expenseError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                    {expenseError}
                  </div>
                )}

                <form onSubmit={handleAddExpense} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Categoria
                    </label>
                    <select
                      value={expCategory}
                      onChange={(e) =>
                        setExpCategory(e.target.value as ExpenseCategory)
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
                    >
                      {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Descrição / Campanha
                    </label>
                    <input
                      type="text"
                      value={expDescription}
                      onChange={(e) => setExpDescription(e.target.value)}
                      placeholder="Ex: Campanha Topo de Funil"
                      className="w-full rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Data da Despesa
                    </label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingExpense}
                    className="w-full rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-50 font-semibold text-xs py-2 px-4 transition"
                  >
                    {submittingExpense ? "Salvando..." : "Registrar Despesa"}
                  </button>
                </form>
              </div>

              {/* Lista de Despesas */}
              <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#0c0c0e] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Despesas Registradas no Período
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Total: {formatBRL(metrics.totalExpenses)}
                    </p>
                  </div>
                </div>

                {periodExpenses.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-lg text-xs text-zinc-500">
                    Nenhuma despesa cadastrada no período selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3 font-medium">Data</th>
                          <th className="py-2 px-3 font-medium">Categoria</th>
                          <th className="py-2 px-3 font-medium">Descrição</th>
                          <th className="py-2 px-3 font-medium text-right">Valor</th>
                          <th className="py-2 px-3 font-medium text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {periodExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-zinc-400 font-mono whitespace-nowrap">
                              {formatDateBR(exp.expenseDate)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/10 bg-white/[0.04] text-zinc-300">
                                {EXPENSE_CATEGORIES[exp.category]?.label || exp.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-white">
                              {exp.title}
                            </td>
                            <td className="py-2.5 px-3 text-right text-white font-mono font-medium">
                              {formatBRL(exp.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="text-zinc-500 hover:text-rose-400 transition p-1"
                                title="Excluir despesa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== ABA 4: INTEGRAÇÃO & GUIA ==================== */}
          {activeTab === "integration" && (
            <IntegrationAndGuideTab
              integrationStatus={data.integrationStatus}
              recentWebhooks={data.recentWebhooks}
              onRefreshDashboard={fetchDashboard}
            />
          )}
        </main>
      </div>
    </div>
  );
}
