"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SpotlightCard } from "./SpotlightCard";
import { gsap } from "gsap";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit3,
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
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";

export interface QuickExpensePreset {
  category: ExpenseCategory;
  title: string;
  amount: number;
}

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";
type ActiveTab = "overview" | "sales" | "expenses" | "integration";

interface IntegrationStatus {
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: string;
  apiBaseUrl: string;
  isDefaultPassword: boolean;
  nexus?: {
    hasApiCredentials: boolean;
    hasWebhookToken: boolean;
    apiBaseUrl: string;
  };
}

interface DashboardPayload {
  transactions: TransactionRecord[];
  transfers: TransferRecord[];
  expenses: ManualExpenseRecord[];
  balance: BalanceSnapshotRecord | null;
  balances?: {
    OMEGAPAY: BalanceSnapshotRecord | null;
    NEXUS: BalanceSnapshotRecord | null;
  };
  recentWebhooks: WebhookEventRecord[];
  integrationStatus: IntegrationStatus;
  quickExpensePreset?: QuickExpensePreset;
}

interface DashboardAppProps {
  onLogout: () => void;
}

export function DashboardApp({ onLogout }: DashboardAppProps) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

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

  // Atualização pontual de saldo OmegaPay
  const [syncingBalance, setSyncingBalance] = useState(false);
  const [balanceNotice, setBalanceNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal para ajuste do Saldo da Nexus / Saldo Adicional
  const [nexusModalOpen, setNexusModalOpen] = useState(false);
  const [nexusAvailInput, setNexusAvailInput] = useState("");
  const [nexusPendInput, setNexusPendInput] = useState("");
  const [savingNexusBalance, setSavingNexusBalance] = useState(false);
  const [nexusBalanceError, setNexusBalanceError] = useState<string | null>(null);

  // Filtros do Histórico de Vendas
  const [salesSearch, setSalesSearch] = useState("");
  const [salesStatusFilter, setSalesStatusFilter] = useState<string>("ALL");

  // Formulário de Despesas Manuais
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("META_ADS");
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(() => getTodayLocalDate());
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Ação Rápida de Despesa Pré-definida
  const [quickPreset, setQuickPreset] = useState<QuickExpensePreset>(() => {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("dashfy_quick_preset") || localStorage.getItem("pulsetrack_quick_preset");
        if (local) return JSON.parse(local);
      } catch {}
    }
    return {
      category: "META_ADS",
      title: "Meta Ads",
      amount: 50,
    };
  });

  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [presetAmount, setPresetAmount] = useState(String(quickPreset.amount));
  const [presetTitle, setPresetTitle] = useState(quickPreset.title);
  const [presetCategory, setPresetCategory] = useState<ExpenseCategory>(quickPreset.category);
  const [triggeringQuickExpense, setTriggeringQuickExpense] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [quickSuccessNotice, setQuickSuccessNotice] = useState<string | null>(null);

  // Sincroniza preset salvo no servidor
  useEffect(() => {
    if (data?.quickExpensePreset) {
      setQuickPreset(data.quickExpensePreset);
      setPresetAmount(String(data.quickExpensePreset.amount));
      setPresetTitle(data.quickExpensePreset.title);
      setPresetCategory(data.quickExpensePreset.category);
    }
  }, [data?.quickExpensePreset]);

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

  // Animação suave com GSAP ao trocar abas ou períodos (respeita reduced motion)
  useEffect(() => {
    if (typeof window === "undefined" || !contentRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const cards = contentRef.current.querySelectorAll(".bento-card");
    if (cards.length > 0) {
      gsap.fromTo(
        cards,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.03,
          ease: "power2.out",
          clearProps: "all",
        }
      );
    }
  }, [activeTab, period]);

  // Lock no body quando drawer mobile estiver aberto
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (mobileMenuOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
  }, [mobileMenuOpen]);

  // Cálculo de intervalo de datas para os filtros
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === "7d") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === "30d") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === "custom") {
      if (customFrom) {
        const [fy, fm, fd] = customFrom.split("-").map(Number);
        start = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
      }
      if (customTo) {
        const [ty, tm, td] = customTo.split("-").map(Number);
        end = new Date(ty, tm - 1, td, 23, 59, 59, 999);
      }
    } else if (period === "all") {
      start = null;
    }

    return { startDate: start, endDate: end };
  }, [period, customFrom, customTo]);

  // Filtra dados pelo período de data
  const periodTransactions = useMemo(() => {
    if (!data) return [];
    if (!startDate) return data.transactions;
    return data.transactions.filter((tx) => {
      const d = new Date(tx.paidAt || tx.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data, startDate, endDate]);

  const periodTransfers = useMemo(() => {
    if (!data) return [];
    if (!startDate) return data.transfers;
    return data.transfers.filter((tf) => {
      const d = new Date(tf.updatedAt || tf.createdAt);
      return d >= startDate && d <= endDate;
    });
  }, [data, startDate, endDate]);

  const periodExpenses = useMemo(() => {
    if (!data) return [];
    if (!startDate) return data.expenses;
    return data.expenses.filter((e) => {
      if (!e.expenseDate) return false;
      const parts = e.expenseDate.slice(0, 10).split("-");
      if (parts.length !== 3) return false;
      const [y, m, d] = parts.map(Number);
      const expenseD = new Date(y, m - 1, d, 12, 0, 0);
      return expenseD >= startDate && expenseD <= endDate;
    });
  }, [data, startDate, endDate]);

  // Métricas Consolidadas do Dashboard
  const metrics = useMemo(() => {
    const approvedSales = periodTransactions.filter(
      (t) => t.status === "COMPLETED"
    );
    const pendingSales = periodTransactions.filter(
      (t) => t.status === "PENDING"
    );
    const refundedOrCanceledSales = periodTransactions.filter(
      (t) =>
        t.status === "REFUNDED" ||
        t.status === "CANCELED" ||
        t.status === "CHARGED_BACK"
    );

    const grossRevenue = approvedSales.reduce((acc, t) => acc + t.grossAmount, 0);
    const netRevenue = approvedSales.reduce((acc, t) => acc + t.netAmount, 0);
    const checkoutFees = approvedSales.reduce((acc, t) => acc + t.feeAmount, 0);
    const pendingGross = pendingSales.reduce((acc, t) => acc + t.grossAmount, 0);

    const approvalRate =
      periodTransactions.length > 0
        ? (approvedSales.length / periodTransactions.length) * 100
        : 0;

    const completedTransfers = periodTransfers.filter(
      (tf) => tf.status === "COMPLETED"
    );
    const receivedAmount = completedTransfers.reduce(
      (acc, tf) => acc + tf.amount,
      0
    );

    const pendingTransfers = periodTransfers.filter(
      (tf) => tf.status === "PENDING" || tf.status === "PROCESSING"
    );
    const pendingTransferAmount = pendingTransfers.reduce(
      (acc, tf) => acc + tf.amount,
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

    // ROI: Retorno sobre Investimento como Multiplicador e Percentual
    const roiMultiplier =
      totalExpenses > 0 ? netRevenue / totalExpenses : null;
    const roiGrossMultiplier =
      totalExpenses > 0 ? grossRevenue / totalExpenses : null;
    const roiProfitPct =
      totalExpenses > 0
        ? (estimatedProfit / totalExpenses) * 100
        : (netRevenue > 0 ? 100 : 0);

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
      roiMultiplier,
      roiGrossMultiplier,
      roiProfitPct,
    };
  }, [periodTransactions, periodTransfers, periodExpenses]);

  // Saldo OmegaPay Oficial
  const omegaBal = data?.balances?.OMEGAPAY ?? data?.balance ?? null;
  const omegaAvailable = omegaBal?.available ?? null;
  const omegaPending = omegaBal?.pending ?? null;
  const omegaFundLock = omegaBal?.fundLock ?? null;
  const omegaTotal =
    omegaAvailable !== null
      ? omegaAvailable + (omegaPending ?? 0) + (omegaFundLock ?? 0)
      : null;

  // Saldo Nexus / Adicional informado
  const nexusBal = data?.balances?.NEXUS ?? null;
  const nexusAvailable = nexusBal?.available ?? 0;
  const nexusPending = nexusBal?.pending ?? 0;
  const nexusTotal = nexusAvailable + nexusPending;
  const hasNexusBalance = nexusTotal > 0;

  // Saldo Geral Combinado
  const combinedTotal = (omegaTotal ?? 0) + nexusTotal;

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

  // Consulta pontual de saldo OmegaPay
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
          message: "Saldo da OmegaPay sincronizado com sucesso.",
        });
        await fetchDashboard();
      }
    } catch {
      setBalanceNotice({
        type: "error",
        message: "Erro de conexão ao consultar saldo da OmegaPay.",
      });
    } finally {
      setSyncingBalance(false);
    }
  }

  // Atualização pontual do saldo da Nexus Pay
  async function handleSaveNexusBalance(e: React.FormEvent) {
    e.preventDefault();
    setNexusBalanceError(null);

    const cleanAvail = Number(nexusAvailInput.trim().replace(/\s/g, "").replace(",", "."));
    const cleanPend = Number(nexusPendInput.trim().replace(/\s/g, "").replace(",", "."));

    if (!Number.isFinite(cleanAvail) || cleanAvail < 0) {
      setNexusBalanceError("Informe um saldo disponível válido (ex: 1500,00).");
      return;
    }

    setSavingNexusBalance(true);
    try {
      const res = await fetch("/api/nexus/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available: cleanAvail,
          pending: Number.isFinite(cleanPend) ? cleanPend : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNexusBalanceError(json.error || "Erro ao salvar saldo da Nexus.");
      } else {
        setNexusModalOpen(false);
        setQuickSuccessNotice("Saldo da Nexus atualizado com sucesso!");
        setTimeout(() => setQuickSuccessNotice(null), 4000);
        await fetchDashboard();
      }
    } catch {
      setNexusBalanceError("Erro ao comunicar com o servidor.");
    } finally {
      setSavingNexusBalance(false);
    }
  }

  // Cadastrar despesa manual
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpenseError(null);
    const cleanAmount = expAmount.trim().replace(/\s/g, "").replace(",", ".");
    const numericAmount = Number(cleanAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setExpenseError("Informe um valor válido maior que zero (ex: 50,00).");
      return;
    }
    setSubmittingExpense(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          gateway: "ALL",
          title:
            expDescription.trim() || EXPENSE_CATEGORIES[expCategory].label,
          amount: numericAmount,
          expenseDate: expDate || getTodayLocalDate(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setExpenseError(json.error || "Erro ao registrar despesa.");
      } else {
        setExpDescription("");
        setExpAmount("");
        setExpDate(getTodayLocalDate());
        setQuickSuccessNotice("Despesa registrada com sucesso!");
        setTimeout(() => setQuickSuccessNotice(null), 4000);
        await fetchDashboard();
      }
    } catch {
      setExpenseError("Erro ao salvar despesa no servidor.");
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Ação Rápida: Lança o gasto pré-configurado instantaneamente
  async function handleQuickAddExpense() {
    setTriggeringQuickExpense(true);
    setExpenseError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: quickPreset.category,
          gateway: "ALL",
          title: quickPreset.title,
          amount: quickPreset.amount,
          expenseDate: getTodayLocalDate(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setExpenseError(json.error || "Erro ao registrar gasto rápido.");
      } else {
        setQuickSuccessNotice(
          `+ ${formatBRL(quickPreset.amount)} (${quickPreset.title}) lançado com sucesso!`
        );
        setTimeout(() => setQuickSuccessNotice(null), 4500);
        await fetchDashboard();
      }
    } catch {
      setExpenseError("Erro ao comunicar com o servidor.");
    } finally {
      setTriggeringQuickExpense(false);
    }
  }

  // Salvar configuração do gasto rápido pré-definido
  async function handleSaveQuickPreset(e: React.FormEvent) {
    e.preventDefault();
    const cleanAmount = Number(presetAmount.trim().replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      alert("Informe um valor válido maior que zero.");
      return;
    }

    const newPreset: QuickExpensePreset = {
      category: presetCategory,
      title: presetTitle.trim() || EXPENSE_CATEGORIES[presetCategory].label,
      amount: cleanAmount,
    };

    setQuickPreset(newPreset);
    try {
      localStorage.setItem("dashfy_quick_preset", JSON.stringify(newPreset));
    } catch {}

    setSavingPreset(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_quick_expense_preset",
          preset: newPreset,
        }),
      });
      setQuickSuccessNotice(
        `Ação rápida configurada para + ${formatBRL(newPreset.amount)} (${newPreset.title})`
      );
      setTimeout(() => setQuickSuccessNotice(null), 4000);
    } catch {
      // Já salvo no localStorage
    } finally {
      setSavingPreset(false);
      setQuickModalOpen(false);
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
        <div className="flex items-center gap-3 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-white" />
          <span>Carregando Dashfy...</span>
        </div>
      </div>
    );
  }

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
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-md transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 border-r border-white/10 bg-[#08080a] z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                <Activity className="w-4 h-4 text-black stroke-[2.8]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-white font-sans">
                    Dashfy
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 border border-white/10">
                    Pro
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">Inteligência Financeira</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white md:hidden"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="p-3 flex-1 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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
                  className={`btn-pressable w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">
                Ações Rápidas
              </span>
              <button
                type="button"
                onClick={handleFetchOmegaPayBalance}
                disabled={syncingBalance}
                className="btn-pressable w-full flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncingBalance ? "animate-spin" : ""
                  }`}
                />
                <span className="truncate">
                  {syncingBalance ? "Consultando..." : "Atualizar Saldo Omega"}
                </span>
              </button>
            </div>
          </div>

          {/* User Profile & Logout Footer */}
          <div className="p-4 border-t border-white/[0.08] bg-[#050507]/80">
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
                    Administrador &bull; Supabase Live
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="btn-pressable p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                title="Sair"
                aria-label="Encerrar sessão"
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
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-subtle" />
                <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                  {activeTab === "overview" && "Visão Geral Financeira"}
                  {activeTab === "sales" && "Histórico de Transações"}
                  {activeTab === "expenses" && "Controle de Despesas Manuais"}
                  {activeTab === "integration" && "Integração & Documentação"}
                </h2>
              </div>
            </div>
          </div>

          {/* Ação Rápida de Adição de Gasto + Seletor de Períodos */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão de Ação Rápida: Adiciona gasto pré-definido com 1 clique */}
            <div className="flex items-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={handleQuickAddExpense}
                disabled={triggeringQuickExpense}
                title={`Clique para lançar imediatamente: + ${formatBRL(quickPreset.amount)} (${quickPreset.title})`}
                className="btn-pressable flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 rounded-lg transition-all disabled:opacity-50"
              >
                <Zap
                  className={`w-3.5 h-3.5 text-amber-400 fill-amber-400 ${
                    triggeringQuickExpense ? "animate-spin" : ""
                  }`}
                />
                <span className="whitespace-nowrap">
                  {triggeringQuickExpense
                    ? "Lançando..."
                    : `+ ${formatBRL(quickPreset.amount)} ${quickPreset.title}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPresetAmount(String(quickPreset.amount));
                  setPresetTitle(quickPreset.title);
                  setPresetCategory(quickPreset.category);
                  setQuickModalOpen(true);
                }}
                title="Editar valor, nome e categoria do gasto pré-definido"
                className="btn-pressable p-1.5 text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/20 rounded-lg transition-all"
                aria-label="Editar configuração de gasto rápido"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Period Selector Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-[#0c0c0e] border border-white/10 rounded-xl p-1 text-xs">
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
                  className={`btn-pressable px-3 py-1 rounded-lg transition-all ${
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
          </div>
        </header>

        {/* Notices */}
        <div className="px-4 sm:px-6 pt-4 space-y-2">
          {quickSuccessNotice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs flex items-center justify-between text-emerald-300 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{quickSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickSuccessNotice(null)}
                className="text-emerald-400 hover:text-emerald-200 ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {balanceNotice && (
            <div
              className={`rounded-xl border p-3.5 text-xs flex items-center justify-between animate-fade-in-up ${
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
        <main ref={contentRef} className="flex-1 p-4 sm:p-6 space-y-5">
          {/* ==================== ABA 1: VISÃO GERAL ==================== */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* LINHA 1 — 4 CARDS MESTRES ENCAIXADOS COM SPOTLIGHT */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Faturamento Bruto */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
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
                </SpotlightCard>

                {/* 2. Receita Líquida */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
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
                </SpotlightCard>

                {/* 3. Lucro Estimado — HERÓI (NÚMERO VERDE SE LUCRO, VERMELHO SE PREJUÍZO — SOMENTE NO NÚMERO) */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Lucro Estimado
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
                    </div>
                  </div>
                  <div className="my-3">
                    <div
                      className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight ${
                        metrics.estimatedProfit > 0
                          ? "text-emerald-400"
                          : metrics.estimatedProfit < 0
                          ? "text-rose-400"
                          : "text-zinc-300"
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
                </SpotlightCard>

                {/* 4. Vendas Aprovadas */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
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
                </SpotlightCard>
              </section>

              {/* LINHA 2 — SALDO OMEGAPAY & OPERACIONAL (4 CARDS ENCAIXADOS) */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 5. Saldo da Conta (OmegaPay + Saldo Adicional Nexus Opcional) */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Saldo da Conta
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (nexusBal?.available !== undefined && nexusBal?.available !== null) {
                            setNexusAvailInput(String(nexusBal.available));
                            setNexusPendInput(String(nexusBal.pending ?? 0));
                          }
                          setNexusModalOpen(true);
                        }}
                        className="btn-pressable p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                        title="Ajustar saldo adicional (ex: Nexus Pay)"
                        aria-label="Ajustar saldo adicional"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchOmegaPayBalance}
                        disabled={syncingBalance}
                        className="btn-pressable p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition disabled:opacity-50"
                        title="Sincronizar saldo da OmegaPay"
                        aria-label="Sincronizar saldo OmegaPay"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingBalance ? "animate-spin" : ""}`} />
                      </button>
                      <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <Wallet className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </div>

                  {omegaAvailable === null && !hasNexusBalance ? (
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
                        <span className="text-zinc-400">Disponível Omega:</span>
                        <span className="font-mono text-white font-semibold">
                          {formatBRL(omegaAvailable ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-500">Pendente Omega:</span>
                        <span className="font-mono text-zinc-300">
                          {formatBRL(omegaPending ?? 0)}
                        </span>
                      </div>
                      {omegaFundLock !== null && omegaFundLock > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-zinc-500">Retido Omega:</span>
                          <span className="font-mono text-zinc-400">
                            {formatBRL(omegaFundLock)}
                          </span>
                        </div>
                      )}
                      {hasNexusBalance && (
                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/[0.05] text-cyan-300">
                          <span>Nexus Adicional:</span>
                          <span className="font-mono font-medium">
                            +{formatBRL(nexusTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>
                      {omegaBal?.fetchedAt
                        ? formatDateBR(omegaBal.fetchedAt)
                        : "GET /producer/balance"}
                    </span>
                    <span className="font-mono text-white font-medium">
                      Total: {formatBRL(hasNexusBalance ? combinedTotal : (omegaTotal ?? 0))}
                    </span>
                  </div>
                </SpotlightCard>

                {/* 6. Valor Recebido / Transferido */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
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
                </SpotlightCard>

                {/* 7. Retorno sobre Investimento (ROI) */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      ROI (Retorno do Inv.)
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="my-3 flex items-baseline justify-between gap-2">
                    <div
                      className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight ${
                        metrics.roiMultiplier !== null
                          ? metrics.roiMultiplier >= 1
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {metrics.roiMultiplier !== null
                        ? `${metrics.roiMultiplier.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`
                        : "—"}
                    </div>
                    {metrics.totalExpenses > 0 ? (
                      <span
                        className={`text-xs font-mono font-medium ${
                          metrics.roiProfitPct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                        title="Lucro sobre investimento (%)"
                      >
                        {metrics.roiProfitPct >= 0 ? "+" : ""}
                        {metrics.roiProfitPct.toFixed(1)}%
                      </span>
                    ) : metrics.roiGrossMultiplier !== null ? (
                      <span
                        className="text-xs font-mono font-medium text-zinc-400"
                        title="ROI considerando faturamento bruto"
                      >
                        Bruto: {metrics.roiGrossMultiplier.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <span>
                      {metrics.totalExpenses > 0 ? "Receita Líq. / Despesas" : "Sem despesas"}
                    </span>
                    <span
                      className="text-zinc-300 font-mono"
                      title={`Taxas pagas no checkout: ${formatBRL(metrics.checkoutFees)}`}
                    >
                      Taxas: {formatBRL(metrics.checkoutFees)}
                    </span>
                  </div>
                </SpotlightCard>

                {/* 8. Gastos com Anúncios & ROAS */}
                <SpotlightCard className="p-5 flex flex-col justify-between bento-card">
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
                </SpotlightCard>
              </section>

              {/* GRÁFICOS FINANCEIROS */}
              <FinancialCharts
                transactions={periodTransactions}
                expenses={periodExpenses}
              />

              {/* ÚLTIMAS TRANSAÇÕES E RESUMO */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 space-y-4 bento-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white tracking-tight">
                        Últimas Transações
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Vendas registradas em tempo real via webhook
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sales")}
                      className="btn-pressable text-xs text-white hover:underline font-medium"
                    >
                      Ver todas &rarr;
                    </button>
                  </div>

                  {periodTransactions.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-white/10 rounded-xl text-xs text-zinc-500 bg-white/[0.01]">
                      Nenhuma transação no período selecionado.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3 font-medium">Data</th>
                            <th className="py-2.5 px-3 font-medium">Produto</th>
                            <th className="py-2.5 px-3 font-medium">ID Transação</th>
                            <th className="py-2.5 px-3 font-medium text-right">Bruto</th>
                            <th className="py-2.5 px-3 font-medium text-right">Líquido</th>
                            <th className="py-2.5 px-3 font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                          {periodTransactions.slice(0, 6).map((tx) => {
                            const meta = getTransactionStatusMeta(tx.status);
                            return (
                              <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                                <td className="py-2.5 px-3 text-zinc-400 font-mono whitespace-nowrap">
                                  {formatDateBR(tx.paidAt || tx.createdAt)}
                                </td>
                                <td className="py-2.5 px-3 text-white font-medium truncate max-w-[180px]">
                                  {tx.productName}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-400 font-mono">
                                  {tx.id}
                                </td>
                                <td className="py-2.5 px-3 text-right text-zinc-300 font-mono">
                                  {formatBRL(tx.grossAmount)}
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
                </SpotlightCard>

                {/* Resumo Rápido de Despesas */}
                <SpotlightCard className="p-5 sm:p-6 space-y-4 flex flex-col justify-between bento-card">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white tracking-tight">
                        Despesas do Período
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("expenses")}
                        className="btn-pressable text-xs text-white hover:underline"
                      >
                        + Lançar
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs py-1.5 border-b border-white/[0.05]">
                        <span className="text-zinc-400">Meta Ads:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.metaAdsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-white/[0.05]">
                        <span className="text-zinc-400">TikTok Ads:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.tiktokAdsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-white/[0.05]">
                        <span className="text-zinc-400">Ferramentas / Outros:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.toolsAndOtherExpenses)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-2 font-semibold">
                        <span className="text-zinc-200">Total de Despesas:</span>
                        <span className="font-mono text-white">
                          {formatBRL(metrics.totalExpenses)}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Ação Rápida no Card */}
                    <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        Gasto rápido:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleQuickAddExpense}
                          disabled={triggeringQuickExpense}
                          className="btn-pressable flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
                          title="Lançar gasto pré-definido hoje"
                        >
                          <span>+ {formatBRL(quickPreset.amount)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetAmount(String(quickPreset.amount));
                            setPresetTitle(quickPreset.title);
                            setPresetCategory(quickPreset.category);
                            setQuickModalOpen(true);
                          }}
                          className="btn-pressable p-1 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                          title="Configurar valor pré-definido"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.08] text-[11px] text-zinc-500">
                    O lucro estimado é calculado instantaneamente subtraindo as despesas da receita líquida.
                  </div>
                </SpotlightCard>
              </div>
            </div>
          )}

          {/* ==================== ABA 2: HISTÓRICO DE VENDAS ==================== */}
          {activeTab === "sales" && (
            <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Histórico Completo de Vendas
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
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
                      className="rounded-xl border border-white/10 bg-[#050507] pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  </div>

                  <select
                    value={salesStatusFilter}
                    onChange={(e) => setSalesStatusFilter(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#050507] px-3 py-1.5 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
                <div className="py-12 text-center border border-dashed border-white/10 rounded-xl text-xs text-zinc-500 bg-white/[0.01]">
                  Nenhuma transação encontrada com os filtros atuais.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                      {filteredSalesTable.map((tx) => {
                        const meta = getTransactionStatusMeta(tx.status);
                        return (
                          <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
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
            </SpotlightCard>
          )}

          {/* ==================== ABA 3: DESPESAS MANUAIS ==================== */}
          {activeTab === "expenses" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Formulário */}
              <SpotlightCard className="p-5 sm:p-6 space-y-4 bento-card">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Adicionar Despesa Manual
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Cadastre gastos sem conectar APIs externas
                  </p>
                </div>

                {/* Banner de Lançamento Rápido Pré-definido */}
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      Ação Rápida Pré-definida
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPresetAmount(String(quickPreset.amount));
                        setPresetTitle(quickPreset.title);
                        setPresetCategory(quickPreset.category);
                        setQuickModalOpen(true);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-200 underline font-medium"
                    >
                      Editar valor
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Lança um gasto de{" "}
                    <strong className="text-white">
                      {formatBRL(quickPreset.amount)}
                    </strong>{" "}
                    em{" "}
                    <strong className="text-white">
                      {quickPreset.title}
                    </strong>{" "}
                    para hoje com apenas 1 clique:
                  </p>
                  <button
                    type="button"
                    onClick={handleQuickAddExpense}
                    disabled={triggeringQuickExpense}
                    className="btn-pressable w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 fill-amber-400 ${triggeringQuickExpense ? "animate-spin" : ""}`} />
                    <span>
                      {triggeringQuickExpense
                        ? "Lançando..."
                        : `Lançar Agora (+ ${formatBRL(quickPreset.amount)})`}
                    </span>
                  </button>
                </div>

                {expenseError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
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
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Valor (R$) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="Ex: 50,00 ou 100.00"
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingExpense}
                    className="btn-pressable w-full rounded-xl bg-white text-black hover:bg-zinc-100 disabled:opacity-50 font-semibold text-xs py-2 px-4 shadow-sm transition"
                  >
                    {submittingExpense ? "Salvando..." : "Registrar Despesa"}
                  </button>
                </form>
              </SpotlightCard>

              {/* Lista de Despesas */}
              <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 space-y-4 bento-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      Despesas Registradas no Período
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Total: {formatBRL(metrics.totalExpenses)}
                    </p>
                  </div>
                </div>

                {periodExpenses.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-xl text-xs text-zinc-500 bg-white/[0.01]">
                    Nenhuma despesa cadastrada no período selecionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#08080a] text-zinc-400 uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3 font-medium">Data</th>
                          <th className="py-2 px-3 font-medium">Categoria</th>
                          <th className="py-2 px-3 font-medium">Descrição</th>
                          <th className="py-2 px-3 font-medium text-right">Valor</th>
                          <th className="py-2 px-3 font-medium text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] bg-[#0c0c0e]">
                        {periodExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-white/[0.03] transition-colors">
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
                                className="btn-pressable text-zinc-500 hover:text-rose-400 transition p-1"
                                title="Excluir despesa"
                                aria-label={`Excluir despesa ${exp.title}`}
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
              </SpotlightCard>
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

      {/* ==================== MODAL DE SALDO ADICIONAL / NEXUS ==================== */}
      {nexusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 sm:p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Saldo Adicional (Nexus Pay)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Defina o valor da Nexus para somar ao saldo geral
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNexusModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {nexusBalanceError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {nexusBalanceError}
              </div>
            )}

            <form onSubmit={handleSaveNexusBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Saldo Disponível (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-zinc-500">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={nexusAvailInput}
                    onChange={(e) => setNexusAvailInput(e.target.value)}
                    placeholder="Ex: 1500,00"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] pl-9 pr-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Valor liberado na Nexus Pay (se deixar 0, não soma nada).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Saldo Pendente (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-zinc-500">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={nexusPendInput}
                    onChange={(e) => setNexusPendInput(e.target.value)}
                    placeholder="Ex: 450,00"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] pl-9 pr-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400">
                💡 Este valor é somado ao saldo da OmegaPay no card principal, dando a você a visão do saldo total da sua operação.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setNexusModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNexusBalance}
                  className="btn-pressable px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-100 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {savingNexusBalance ? "Salvando..." : "Salvar Saldo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL DE CONFIGURAÇÃO DE GASTO RÁPIDO ==================== */}
      {quickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 sm:p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Editar Botão de Gasto Rápido
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Defina o valor e detalhes para adicionar com 1 clique
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPreset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Valor Pré-definido (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono text-zinc-500">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={presetAmount}
                    onChange={(e) => setPresetAmount(e.target.value)}
                    placeholder="50,00"
                    className="w-full rounded-xl border border-white/10 bg-[#050507] pl-9 pr-3 py-2 text-xs text-white font-mono focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Ex: 50,00 ou 100,00 (valor que será adicionado a cada clique)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Categoria
                </label>
                <select
                  value={presetCategory}
                  onChange={(e) =>
                    setPresetCategory(e.target.value as ExpenseCategory)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
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
                  Título / Nome da Despesa
                </label>
                <input
                  type="text"
                  value={presetTitle}
                  onChange={(e) => setPresetTitle(e.target.value)}
                  placeholder="Ex: Meta Ads Diário"
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                />
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400">
                💡 <strong className="text-zinc-200">Como funciona:</strong> Ao clicar no botão de ação rápida na barra superior ou no painel, este gasto é registrado para a data de hoje e as métricas de faturamento, lucro e ROI são recalculadas na hora.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setQuickModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPreset}
                  className="btn-pressable px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-100 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {savingPreset ? "Salvando..." : "Salvar Pré-definição"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
