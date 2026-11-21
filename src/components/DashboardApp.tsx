"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  CheckCircle2,
  Menu,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  DASHBOARD_DEFINITIONS,
  type DashfyDashboardPayload,
  type DashboardOperationId,
  type GlobalPageId,
  type NavigationLocation,
  type OperationTabId,
  type SummaryFilterState,
} from "@/lib/dashfy-types";
import {
  computeOmegaPaySummary,
  computeTikTokSummary,
  getDateRange,
  getTodayLocalDate,
  isDateInRange,
} from "@/lib/dashfy-metrics";
import { formatBRL } from "@/lib/format";
import { Sidebar } from "./dashfy/Sidebar";
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
    <div className="min-h-screen bg-[#060b17] flex">
      <div className="hidden lg:block w-[268px] border-r border-slate-800/80 bg-[#0a1120] p-4 space-y-4">
        <div className="h-9 w-36 rounded-lg bg-slate-800/70 animate-pulse" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-lg bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-5">
        <div className="h-12 rounded-2xl bg-slate-900/80 border border-slate-800/80 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-slate-900/80 border border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-900/80 border border-slate-800/80 animate-pulse" />
      </div>
    </div>
  );
}

export function DashboardApp({ onLogout }: DashboardAppProps) {
  const [data, setData] = useState<DashfyDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Persistência do dashboard e aba ativa no localStorage
  const [location, setLocation] = useState<NavigationLocation>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dashfy_nav_location");
        if (saved) {
          const parsed = JSON.parse(saved) as NavigationLocation;
          if (parsed && (parsed.kind === "dashboard" || parsed.kind === "global")) {
            return parsed;
          }
        }
      } catch {}
    }
    return { kind: "dashboard", dashboardId: "omegapay", tabId: "resumo" };
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

  // Animação suave com GSAP ao navegar (respeita reduced motion)
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

  const activeDashboardId: DashboardOperationId =
    location.kind === "dashboard" ? location.dashboardId : "omegapay";

  const { startDate, endDate } = useMemo(
    () => getDateRange(filters.period, filters.customFrom, filters.customTo),
    [filters.period, filters.customFrom, filters.customTo]
  );

  // ==================== DADOS ISOLADOS: OPERAÇÃO OMEGAPAY ====================
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

  const omegaExpenses = useMemo(() => {
    if (!data) return [];
    return data.expenses.filter((e) => {
      if (e.dashboardId !== "omegapay") return false;
      return isDateInRange(e.expenseDate, startDate, endDate);
    });
  }, [data, startDate, endDate]);

  const omegaFees = useMemo(() => {
    if (!data) return [];
    return (data.customFees || []).filter((f) => {
      if (f.dashboardId !== "omegapay") return false;
      return isDateInRange(f.feeDate, startDate, endDate);
    });
  }, [data, startDate, endDate]);

  const omegaMetrics = useMemo(
    () =>
      computeOmegaPaySummary(
        omegaTransactions,
        omegaTransfers,
        omegaExpenses,
        omegaFees
      ),
    [omegaTransactions, omegaTransfers, omegaExpenses, omegaFees]
  );

  // ==================== DADOS ISOLADOS: OPERAÇÃO TIKTOK ====================
  const tiktokCampaignsFiltered = useMemo(() => {
    if (!data) return [];
    return (data.tiktokCampaigns || []).filter((c) => {
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
    startDate,
    endDate,
    filters.adAccount,
    filters.campaign,
    filters.trafficSource,
    filters.product,
    filters.status,
  ]);

  const tiktokExpenses = useMemo(() => {
    if (!data) return [];
    return data.expenses.filter((e) => {
      if (e.dashboardId !== "tiktok") return false;
      if (filters.campaign !== "ALL" && e.campaignName && e.campaignName !== filters.campaign) {
        return false;
      }
      return isDateInRange(e.expenseDate, startDate, endDate);
    });
  }, [data, startDate, endDate, filters.campaign]);

  const tiktokFees = useMemo(() => {
    if (!data) return [];
    return (data.customFees || []).filter((f) => {
      if (f.dashboardId !== "tiktok") return false;
      return isDateInRange(f.feeDate, startDate, endDate);
    });
  }, [data, startDate, endDate]);

  const tiktokMetrics = useMemo(
    () => computeTikTokSummary(tiktokCampaignsFiltered, tiktokExpenses, tiktokFees),
    [tiktokCampaignsFiltered, tiktokExpenses, tiktokFees]
  );

  // Opções dinâmicas para os selects do filtro horizontal
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
    if (activeDashboardId === "tiktok") {
      const all = data.tiktokCampaigns || [];
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
            .filter((e) => e.dashboardId === "omegapay" && e.campaignName)
            .map((e) => e.campaignName as string)
        )
      ),
      trafficSources: ["Direto / Checkout", "Meta Ads", "TikTok Ads"],
      products: Array.from(new Set(omegaTx.map((t) => t.productName).filter(Boolean))),
      platforms: ["OmegaPay v1"],
    };
  }, [data, activeDashboardId]);

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
          dashboardId: activeDashboardId,
          gateway: activeDashboardId === "omegapay" ? "OMEGAPAY" : "ALL",
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        showToast(
          "success",
          `+ ${formatBRL(data.quickExpensePreset.amount)} (${data.quickExpensePreset.title}) lançado na ${
            activeDashboardId === "tiktok" ? "Operação TikTok" : "Operação OmegaPay"
          }.`
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

  // Título e subtítulo do cabeçalho superior
  const activeDashDef = DASHBOARD_DEFINITIONS.find((d) => d.id === activeDashboardId)!;
  const activeTabDef =
    location.kind === "dashboard"
      ? activeDashDef.tabs.find((t) => t.id === location.tabId)
      : null;

  const pageTitle =
    location.kind === "global"
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
    <div className="min-h-screen bg-[#060b17] text-slate-100 flex">
      {/* SIDEBAR ESQUERDA FIXA E RECOLHÍVEL (ESTILO UTMIFY) */}
      <Sidebar
        location={location}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        userEmail={data.profile.username}
        userName={data.profile.displayName}
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
          sidebarCollapsed ? "lg:pl-[74px]" : "lg:pl-[268px]"
        }`}
      >
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-[#060b17]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white lg:hidden"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                {location.kind === "dashboard" ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-700/80 bg-[#0f172a] text-slate-200"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: activeDashDef.accentColor }}
                      />
                      {activeDashDef.name}
                    </span>
                    <span className="text-slate-600">/</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 font-medium">Dashfy</span>
                    <span className="text-slate-600">/</span>
                  </>
                )}
                <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                  {pageTitle}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Atalho rápido de lançamento de despesa */}
            {location.kind === "dashboard" && (
              <button
                type="button"
                onClick={handleQuickAddExpense}
                disabled={quickAdding}
                title={`Lançar + ${formatBRL(quickPreset.amount)} (${quickPreset.title}) em ${activeDashDef.name}`}
                className="btn-pressable hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 disabled:opacity-50"
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
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0f172a] hover:border-[#1a86ff]/50 text-xs font-medium text-slate-200 disabled:opacity-50"
              title="Atualizar dados do painel"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#38bdf8] ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* TOAST FEEDBACK */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4">
            <div
              className={`rounded-xl border p-3 text-xs flex items-center justify-between animate-fade-in-up ${
                toast.type === "success"
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {toast.message}
              </span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-3 opacity-75 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA PÁGINA ATIVA */}
        <main ref={contentRef} className="flex-1 p-4 sm:p-6">
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
              dashboardId={location.dashboardId}
              metrics={location.dashboardId === "tiktok" ? tiktokMetrics : omegaMetrics}
              filters={filters}
              filterOptions={filterOptions}
              onFiltersChange={setFilters}
              onFiltersReset={() => setFilters(createDefaultFilters())}
              onNavigateTab={(tabId: OperationTabId) =>
                setLocation({
                  kind: "dashboard",
                  dashboardId: location.dashboardId,
                  tabId,
                })
              }
              recentTransactions={omegaTransactions}
              tiktokCampaigns={tiktokCampaignsFiltered}
              omegaBalance={data.balances?.OMEGAPAY ?? data.balance}
            />
          )}

          {location.kind === "dashboard" &&
            location.dashboardId === "tiktok" &&
            location.tabId === "tiktok_ads" && (
              <TikTokAdsView
                campaigns={tiktokCampaignsFiltered}
                onRefresh={() => fetchDashboard(false)}
              />
            )}

          {location.kind === "dashboard" &&
            location.dashboardId === "tiktok" &&
            location.tabId === "utms" && (
              <UtmsView campaigns={tiktokCampaignsFiltered} />
            )}

          {location.kind === "dashboard" &&
            location.dashboardId === "tiktok" &&
            location.tabId === "regras" && (
              <RulesView
                rules={(data.automationRules || []).filter(
                  (r) => r.dashboardId === "tiktok"
                )}
                campaigns={tiktokCampaignsFiltered}
                onRefresh={() => fetchDashboard(false)}
              />
            )}

          {location.kind === "dashboard" &&
            location.dashboardId === "omegapay" &&
            location.tabId === "vendas" && (
              <OmegaPaySalesView transactions={omegaTransactions} />
            )}

          {location.kind === "dashboard" &&
            location.dashboardId === "omegapay" &&
            location.tabId === "recebimentos" && (
              <OmegaPayReceivablesView transfers={omegaTransfers} />
            )}

          {location.kind === "dashboard" &&
            location.dashboardId === "omegapay" &&
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
              dashboardId={location.dashboardId}
              expenses={location.dashboardId === "tiktok" ? tiktokExpenses : omegaExpenses}
              campaignSuggestions={filterOptions.campaigns}
              onRefresh={() => fetchDashboard(false)}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "taxas" && (
            <FeesView
              dashboardId={location.dashboardId}
              fees={location.dashboardId === "tiktok" ? tiktokFees : omegaFees}
              checkoutFeesTotal={
                location.dashboardId === "omegapay"
                  ? omegaMetrics.checkoutOrPlatformFees
                  : 0
              }
              revenueBase={
                location.dashboardId === "tiktok"
                  ? tiktokMetrics.grossRevenue
                  : omegaMetrics.grossRevenue
              }
              campaignSuggestions={filterOptions.campaigns}
              onRefresh={() => fetchDashboard(false)}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "integracoes" && (
            <IntegrationsView
              dashboardId={location.dashboardId}
              integrationStatus={data.integrationStatus}
              onRefresh={() => fetchDashboard(false)}
              onNavigateTab={(tabId) =>
                setLocation({
                  kind: "dashboard",
                  dashboardId: location.dashboardId,
                  tabId,
                })
              }
              onSyncOmegaBalance={handleSyncOmegaBalance}
              syncingBalance={syncingBalance}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "relatorios" && (
            <ReportsView
              dashboardId={location.dashboardId}
              metrics={location.dashboardId === "tiktok" ? tiktokMetrics : omegaMetrics}
              transactions={omegaTransactions}
              tiktokCampaigns={tiktokCampaignsFiltered}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "pedidos" && (
            <OrdersView
              dashboardId={location.dashboardId}
              transactions={omegaTransactions}
              tiktokCampaigns={tiktokCampaignsFiltered}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "eventos" && (
            <EventsView
              dashboardId={location.dashboardId}
              webhooks={data.recentWebhooks}
              tiktokCampaigns={tiktokCampaignsFiltered}
            />
          )}

          {location.kind === "dashboard" && location.tabId === "notificacoes" && (
            <NotificationsView
              dashboardId={location.dashboardId}
              integrationStatus={data.integrationStatus}
              transactions={omegaTransactions}
              rules={data.automationRules || []}
              prefs={data.profile.notificationPrefs}
              onRefresh={() => fetchDashboard(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
