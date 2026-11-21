"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { CheckCircle2, Menu, RefreshCw, Zap } from "lucide-react";
import {
  DEFAULT_DASHBOARDS,
  getTabsForMode,
  type DashfyDashboardPayload,
  type DashboardConfigRecord,
  type DashboardOperationId,
  type DashboardOperationMode,
  type GlobalPageId,
  type NavigationLocation,
  type OperationTabId,
  type SummaryFilterState,
} from "@/lib/dashfy-types";
import {
  computeGeneralOverview,
  computeOmegaPaySummary,
  computeTikTokSummary,
  getDateRange,
  getTodayLocalDate,
  isDateInRange,
} from "@/lib/dashfy-metrics";
import { formatBRL } from "@/lib/format";
import { Sidebar } from "./dashfy/Sidebar";
import { GeneralOverviewView } from "./dashfy/GeneralOverviewView";
import { SummaryView } from "./dashfy/SummaryView";
import { TikTokAdsView } from "./dashfy/TikTokAdsView";
import { UtmsView } from "./dashfy/UtmsView";
import { RulesView } from "./dashfy/RulesView";
import { ExpensesView, FeesView } from "./dashfy/ExpensesAndFeesView";
import {
  OmegaPayBalanceView,
  OmegaPayReceivablesView,
  OmegaPaySalesView,
} from "./dashfy/OmegaPayViews";
import { IntegrationsView } from "./dashfy/IntegrationsView";
import {
  EventsView,
  NotificationsView,
  OrdersView,
  ReportsView,
} from "./dashfy/OperationsExtraViews";
import { GlobalPagesView } from "./dashfy/GlobalPagesView";

interface DashboardAppProps {
  onLogout: () => void;
}

function createDefaultFilters(): SummaryFilterState {
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    period: "30d",
    customFrom: from.toISOString().slice(0, 10),
    customTo: getTodayLocalDate(),
    adAccount: "ALL",
    campaign: "ALL",
    trafficSource: "ALL",
    product: "ALL",
    platform: "ALL",
    status: "ALL",
    paymentMethod: "ALL",
  };
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#050507] flex">
      <div className="hidden lg:block w-64 border-r border-white/10 bg-[#08080a] p-4 space-y-4">
        <div className="h-8 w-36 rounded-lg bg-white/10 animate-pulse" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-lg bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-5">
        <div className="h-12 rounded-2xl bg-[#0c0c0e] border border-white/[0.08] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-[#0c0c0e] border border-white/[0.08] animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-[#0c0c0e] border border-white/[0.08] animate-pulse" />
      </div>
    </div>
  );
}

export function DashboardApp({ onLogout }: DashboardAppProps) {
  const [data, setData] = useState<DashfyDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [location, setLocation] = useState<NavigationLocation>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dashfy_nav_location");
        if (saved) {
          const parsed = JSON.parse(saved) as NavigationLocation;
          if (
            parsed &&
            (parsed.kind === "general" ||
              parsed.kind === "dashboard" ||
              parsed.kind === "global")
          ) {
            return parsed;
          }
        }
      } catch {}
    }
    return { kind: "general" };
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashfy_sidebar_collapsed") === "true";
    }
    return false;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filters, setFilters] = useState<SummaryFilterState>(() => createDefaultFilters());

  const [syncingBalance, setSyncingBalance] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("dashfy_nav_location", JSON.stringify(location));
    } catch {}
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem("dashfy_sidebar_collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchDashboard = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.status === 401) {
          onLogout();
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as DashfyDashboardPayload;
          setData(json);
        }
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLogout]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (typeof window === "undefined" || !contentRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = contentRef.current.querySelectorAll(".bento-card");
    if (cards.length > 0) {
      gsap.fromTo(
        cards,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.025,
          ease: "power2.out",
          clearProps: "all",
        }
      );
    }
  }, [location, filters.period]);

  // Lista dinâmica de abas/dashboards configuráveis (3 por padrão, renomeáveis e livres)
  const dashboards: DashboardConfigRecord[] = useMemo(() => {
    if (data?.dashboards && data.dashboards.length > 0) {
      return data.dashboards;
    }
    return DEFAULT_DASHBOARDS;
  }, [data?.dashboards]);

  const activeDashboardId: DashboardOperationId =
    location.kind === "dashboard"
      ? location.dashboardId
      : dashboards[0]?.id || "tiktok";

  const activeDashboard: DashboardConfigRecord = useMemo(() => {
    return (
      dashboards.find((d) => d.id === activeDashboardId) ||
      dashboards[0] ||
      DEFAULT_DASHBOARDS[0]
    );
  }, [dashboards, activeDashboardId]);

  const activeMode: DashboardOperationMode = activeDashboard.mode;

  const { startDate, endDate } = useMemo(
    () => getDateRange(filters.period, filters.customFrom, filters.customTo),
    [filters.period, filters.customFrom, filters.customTo]
  );

  // ==================== DADOS ISOLADOS DA ABA ATIVA ====================
  const omegaTransactions = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((tx) => {
      if ((tx.gateway || "OMEGAPAY") !== "OMEGAPAY") return false;
      if (!isDateInRange(tx.paidAt || tx.createdAt, startDate, endDate)) return false;
      if (filters.product !== "ALL" && tx.productName !== filters.product) return false;
      if (filters.status !== "ALL" && tx.status !== filters.status) return false;
      if (filters.paymentMethod !== "ALL" && tx.paymentMethod !== filters.paymentMethod) {
        return false;
      }
      return true;
    });
  }, [data, startDate, endDate, filters.product, filters.status, filters.paymentMethod]);

  const omegaTransfers = useMemo(() => {
    if (!data) return [];
    return data.transfers.filter((tf) => {
      if ((tf.gateway || "OMEGAPAY") !== "OMEGAPAY") return false;
      return isDateInRange(tf.updatedAt || tf.createdAt, startDate, endDate);
    });
  }, [data, startDate, endDate]);

  const activeExpenses = useMemo(() => {
    if (!data) return [];
    return data.expenses.filter((e) => {
      if (e.dashboardId !== activeDashboard.id) return false;
      if (
        activeMode === "tiktok" &&
        filters.campaign !== "ALL" &&
        e.campaignName &&
        e.campaignName !== filters.campaign
      ) {
        return false;
      }
      return isDateInRange(e.expenseDate, startDate, endDate);
    });
  }, [data, activeDashboard.id, activeMode, filters.campaign, startDate, endDate]);

  const activeFees = useMemo(() => {
    if (!data) return [];
    return (data.customFees || []).filter((f) => {
      if (f.dashboardId !== activeDashboard.id) return false;
      return isDateInRange(f.feeDate, startDate, endDate);
    });
  }, [data, activeDashboard.id, startDate, endDate]);

  const activeTikTokCampaigns = useMemo(() => {
    if (!data) return [];
    return (data.tiktokCampaigns || []).filter((c) => {
      if ((c.dashboardId || "tiktok") !== activeDashboard.id) return false;
      if (!isDateInRange(c.statDate, startDate, endDate)) return false;
      if (filters.adAccount !== "ALL" && c.adAccount !== filters.adAccount) return false;
      if (filters.campaign !== "ALL" && c.campaignName !== filters.campaign) return false;
      if (filters.trafficSource !== "ALL" && c.utmSource !== filters.trafficSource) {
        return false;
      }
      if (filters.product !== "ALL" && c.productName !== filters.product) return false;
      if (filters.status !== "ALL" && c.status !== filters.status) return false;
      return true;
    });
  }, [
    data,
    activeDashboard.id,
    startDate,
    endDate,
    filters.adAccount,
    filters.campaign,
    filters.trafficSource,
    filters.product,
    filters.status,
  ]);

  const activeRules = useMemo(() => {
    if (!data) return [];
    return (data.automationRules || []).filter(
      (r) => r.dashboardId === activeDashboard.id
    );
  }, [data, activeDashboard.id]);

  const activeMetrics = useMemo(() => {
    if (activeMode === "tiktok") {
      return computeTikTokSummary(activeTikTokCampaigns, activeExpenses, activeFees);
    }
    return computeOmegaPaySummary(
      omegaTransactions,
      omegaTransfers,
      activeExpenses,
      activeFees
    );
  }, [
    activeMode,
    activeTikTokCampaigns,
    omegaTransactions,
    omegaTransfers,
    activeExpenses,
    activeFees,
  ]);

  // ==================== RESUMO CONSOLIDADO (DASH GERAL) ====================
  const generalOverview = useMemo(() => {
    if (!data) {
      return computeGeneralOverview({
        dashboards,
        omegaTransactions: [],
        omegaTransfers: [],
        tiktokCampaigns: [],
        expenses: [],
        customFees: [],
      });
    }
    const periodOmegaTx = data.transactions.filter(
      (tx) =>
        (tx.gateway || "OMEGAPAY") === "OMEGAPAY" &&
        isDateInRange(tx.paidAt || tx.createdAt, startDate, endDate)
    );
    const periodOmegaTf = data.transfers.filter(
      (tf) =>
        (tf.gateway || "OMEGAPAY") === "OMEGAPAY" &&
        isDateInRange(tf.updatedAt || tf.createdAt, startDate, endDate)
    );
    const periodTikTok = (data.tiktokCampaigns || []).filter((c) =>
      isDateInRange(c.statDate, startDate, endDate)
    );
    const periodExp = data.expenses.filter((e) =>
      isDateInRange(e.expenseDate, startDate, endDate)
    );
    const periodFees = (data.customFees || []).filter((f) =>
      isDateInRange(f.feeDate, startDate, endDate)
    );

    return computeGeneralOverview({
      dashboards,
      omegaTransactions: periodOmegaTx,
      omegaTransfers: periodOmegaTf,
      tiktokCampaigns: periodTikTok,
      expenses: periodExp,
      customFees: periodFees,
    });
  }, [data, dashboards, startDate, endDate]);

  const filterOptions = useMemo(() => {
    if (!data) {
      return {
        adAccounts: [],
        campaigns: [],
        trafficSources: [],
        products: [],
        platforms: [],
      };
    }
    if (activeMode === "tiktok") {
      const all = (data.tiktokCampaigns || []).filter(
        (c) => (c.dashboardId || "tiktok") === activeDashboard.id
      );
      return {
        adAccounts: Array.from(new Set(all.map((c) => c.adAccount).filter(Boolean))),
        campaigns: Array.from(new Set(all.map((c) => c.campaignName).filter(Boolean))),
        trafficSources: Array.from(new Set(all.map((c) => c.utmSource).filter(Boolean))),
        products: Array.from(new Set(all.map((c) => c.productName).filter(Boolean))),
        platforms: ["TikTok Ads Manager"],
      };
    }
    const omegaTx = data.transactions.filter(
      (t) => (t.gateway || "OMEGAPAY") === "OMEGAPAY"
    );
    return {
      adAccounts: ["Conta Principal"],
      campaigns: Array.from(
        new Set(
          data.expenses
            .filter((e) => e.dashboardId === activeDashboard.id && e.campaignName)
            .map((e) => e.campaignName as string)
        )
      ),
      trafficSources: ["Direto / Checkout", "Meta Ads", "TikTok Ads"],
      products: Array.from(new Set(omegaTx.map((t) => t.productName).filter(Boolean))),
      platforms: ["OmegaPay v1"],
    };
  }, [data, activeMode, activeDashboard.id]);

  async function handleUpdateDashboardConfig(
    dashboardId: string,
    updates: { name: string; mode: DashboardOperationMode }
  ) {
    const nextDashboards = dashboards.map((d) =>
      d.id === dashboardId ? { ...d, name: updates.name, mode: updates.mode } : d
    );

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_dashboards_config",
        dashboards: nextDashboards,
      }),
    });

    if (res.ok) {
      // Se mudou o modo da aba ativa e o submenu atual não existe no novo modo, volta para Resumo
      if (location.kind === "dashboard" && location.dashboardId === dashboardId) {
        const validTabs = getTabsForMode(updates.mode);
        if (!validTabs.some((t) => t.id === location.tabId)) {
          setLocation({ kind: "dashboard", dashboardId, tabId: "resumo" });
        }
      }
      showToast("success", `Aba "${updates.name}" atualizada com sucesso.`);
      await fetchDashboard(false);
    } else {
      showToast("error", "Não foi possível salvar a alteração da aba.");
    }
  }

  async function handleSyncOmegaBalance() {
    setSyncingBalance(true);
    try {
      const res = await fetch("/api/omegapay/balance", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(
          "error",
          json.error || "Não foi possível consultar o saldo na OmegaPay."
        );
      } else {
        showToast("success", "Saldo sincronizado com sucesso via API OmegaPay.");
        await fetchDashboard();
      }
    } catch {
      showToast("error", "Erro de conexão ao consultar saldo na OmegaPay.");
    } finally {
      setSyncingBalance(false);
    }
  }

  async function handleQuickAddExpense() {
    if (!data?.quickExpensePreset) return;
    setQuickAdding(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: data.quickExpensePreset.category,
          title: data.quickExpensePreset.title,
          amount: data.quickExpensePreset.amount,
          expenseDate: getTodayLocalDate(),
          dashboardId: activeDashboard.id,
          gateway: activeMode === "omegapay" ? "OMEGAPAY" : "ALL",
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        showToast(
          "success",
          `+ ${formatBRL(data.quickExpensePreset.amount)} (${data.quickExpensePreset.title}) lançado em ${activeDashboard.name}.`
        );
        await fetchDashboard();
      } else {
        showToast("error", json.error || "Erro ao registrar gasto rápido.");
      }
    } finally {
      setQuickAdding(false);
    }
  }

  async function handleLogoutClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  }

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  const activeTabs = getTabsForMode(activeMode);
  const activeTabDef =
    location.kind === "dashboard"
      ? activeTabs.find((t) => t.id === location.tabId)
      : null;

  const pageTitle =
    location.kind === "general"
      ? "Dash Geral"
      : location.kind === "global"
        ? location.pageId === "minha_conta"
          ? "Minha conta"
          : location.pageId === "configuracoes"
            ? "Configurações"
            : "Suporte"
        : activeTabDef?.label || "Resumo";

  const quickPreset = data.quickExpensePreset || {
    category: "META_ADS" as const,
    title: "Meta Ads",
    amount: 50,
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex">
      {/* SIDEBAR ESQUERDA FIXA E RECOLHÍVEL */}
      <Sidebar
        dashboards={dashboards}
        location={location}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        userEmail={data.profile.username}
        userName={data.profile.displayName}
        onSelectGeneral={() => setLocation({ kind: "general" })}
        onSelectDashboardTab={(dashboardId, tabId) => {
          setLocation({ kind: "dashboard", dashboardId, tabId });
          if (dashboardId !== activeDashboardId) {
            setFilters((prev) => ({
              ...createDefaultFilters(),
              period: prev.period,
              customFrom: prev.customFrom,
              customTo: prev.customTo,
            }));
          }
        }}
        onUpdateDashboardConfig={handleUpdateDashboardConfig}
        onSelectGlobalPage={(pageId: GlobalPageId) =>
          setLocation({ kind: "global", pageId })
        }
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogoutClick}
      />

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#050507]/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                {location.kind === "dashboard" ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-white/10 bg-[#0c0c0e] text-zinc-300">
                      {activeDashboard.name}
                    </span>
                    <span className="text-zinc-600">/</span>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-400 font-medium">Dashfy</span>
                    <span className="text-zinc-600">/</span>
                  </>
                )}
                <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
                  {pageTitle}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {location.kind === "dashboard" && (
              <button
                type="button"
                onClick={handleQuickAddExpense}
                disabled={quickAdding}
                title={`Lançar + ${formatBRL(quickPreset.amount)} (${quickPreset.title}) em ${activeDashboard.name}`}
                className="btn-pressable hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-xs font-semibold text-amber-300 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>
                  {quickAdding
                    ? "Lançando..."
                    : `+ ${formatBRL(quickPreset.amount)} ${quickPreset.title}`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-white disabled:opacity-50"
              title="Atualizar dados do painel"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* TOAST FEEDBACK */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`rounded-xl border p-3.5 text-xs flex items-center justify-between animate-fade-in-up ${
                toast.type === "success"
                  ? "border-white/20 bg-white/5 text-zinc-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {toast.message}
              </span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-3 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA PÁGINA ATIVA */}
        <main ref={contentRef} className="flex-1 p-4 sm:p-6">
          {location.kind === "general" && (
            <GeneralOverviewView
              summary={generalOverview}
              filters={filters}
              onFiltersChange={setFilters}
              omegaBalance={data.balances?.OMEGAPAY ?? data.balance}
              onOpenOperation={(dashboardId, tabId) =>
                setLocation({ kind: "dashboard", dashboardId, tabId })
              }
            />
          )}

          {location.kind === "global" && (
            <GlobalPagesView
              pageId={location.pageId}
              data={data}
              onRefresh={() => fetchDashboard(false)}
              onNavigateDashboard={(dash, tab) =>
                setLocation({ kind: "dashboard", dashboardId: dash, tabId: tab })
              }
            />
          )}

          {location.kind === "dashboard" && location.tabId === "resumo" && (
            <SummaryView
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              metrics={activeMetrics}
              filters={filters}
              filterOptions={filterOptions}
              onFiltersChange={setFilters}
              onFiltersReset={() => setFilters(createDefaultFilters())}
              onNavigateTab={(tabId: OperationTabId) =>
                setLocation({
                  kind: "dashboard",
                  dashboardId: activeDashboard.id,
                  tabId,
                })
              }
              recentTransactions={omegaTransactions}
              tiktokCampaigns={activeTikTokCampaigns}
              omegaBalance={data.balances?.OMEGAPAY ?? data.balance}
            />
          )}

          {location.kind === "dashboard" &&
            activeMode === "tiktok" &&
            location.tabId === "tiktok_ads" && (
              <TikTokAdsView
                dashboardId={activeDashboard.id}
                dashboardName={activeDashboard.name}
                campaigns={activeTikTokCampaigns}
                onRefresh={() => fetchDashboard(false)}
              />
            )}

          {location.kind === "dashboard" &&
            activeMode === "tiktok" &&
            location.tabId === "utms" && (
              <UtmsView campaigns={activeTikTokCampaigns} />
            )}

          {location.kind === "dashboard" &&
            activeMode === "tiktok" &&
            location.tabId === "regras" && (
              <RulesView
                dashboardId={activeDashboard.id}
                rules={activeRules}
                campaigns={activeTikTokCampaigns}
                onRefresh={() => fetchDashboard(false)}
              />
            )}

          {location.kind === "dashboard" &&
            activeMode === "omegapay" &&
            location.tabId === "vendas" && (
              <OmegaPaySalesView transactions={omegaTransactions} />
            )}

          {location.kind === "dashboard" &&
            activeMode === "omegapay" &&
            location.tabId === "recebimentos" && (
              <OmegaPayReceivablesView transfers={omegaTransfers} />
            )}

          {location.kind === "dashboard" &&
            activeMode === "omegapay" &&
            location.tabId === "saldo" && (
              <OmegaPayBalanceView
                balance={data.balances?.OMEGAPAY ?? data.balance}
                syncEnabled={data.integrationStatus.syncEnabled}
                syncingBalance={syncingBalance}
                onSyncBalance={handleSyncOmegaBalance}
              />
            )}

          {location.kind === "dashboard" && location.tabId === "despesas" && (
            <ExpensesView
              dashboards={dashboards}
              dashboardId={activeDashboard.id}
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              expenses={activeExpenses}
              campaignSuggestions={filterOptions.campaigns}
              onRefresh={() => fetchDashboard(false)}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "taxas" && (
            <FeesView
              dashboards={dashboards}
              dashboardId={activeDashboard.id}
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              fees={activeFees}
              checkoutFeesTotal={
                activeMode === "omegapay"
                  ? activeMetrics.checkoutOrPlatformFees
                  : 0
              }
              revenueBase={activeMetrics.grossRevenue}
              campaignSuggestions={filterOptions.campaigns}
              onRefresh={() => fetchDashboard(false)}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "integracoes" && (
            <IntegrationsView
              dashboardMode={activeMode}
              integrationStatus={data.integrationStatus}
              onRefresh={() => fetchDashboard(false)}
              onNavigateTab={(tabId) =>
                setLocation({
                  kind: "dashboard",
                  dashboardId: activeDashboard.id,
                  tabId,
                })
              }
              onSyncOmegaBalance={handleSyncOmegaBalance}
              syncingBalance={syncingBalance}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "relatorios" && (
            <ReportsView
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              metrics={activeMetrics}
              transactions={omegaTransactions}
              tiktokCampaigns={activeTikTokCampaigns}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "pedidos" && (
            <OrdersView
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              transactions={omegaTransactions}
              tiktokCampaigns={activeTikTokCampaigns}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "eventos" && (
            <EventsView
              dashboardMode={activeMode}
              dashboardName={activeDashboard.name}
              webhooks={data.recentWebhooks}
              tiktokCampaigns={activeTikTokCampaigns}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "notificacoes" && (
            <NotificationsView
              dashboardMode={activeMode}
              integrationStatus={data.integrationStatus}
              transactions={omegaTransactions}
              rules={activeRules}
              prefs={data.profile.notificationPrefs}
              onRefresh={() => fetchDashboard(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
