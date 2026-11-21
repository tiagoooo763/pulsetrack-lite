"use client";

import React, { useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileBarChart2,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Layers,
  Link2,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plug,
  Receipt,
  Settings,
  ShoppingBag,
  Sliders,
  UserCircle2,
  Wallet,
  X,
} from "lucide-react";
import {
  DASHBOARD_DEFINITIONS,
  type DashboardOperationId,
  type GlobalPageId,
  type NavigationLocation,
  type OperationTabId,
  type TabMenuItem,
} from "@/lib/dashfy-types";
import { DashfyBrand } from "./DashfyBrand";

interface SidebarProps {
  location: NavigationLocation;
  collapsed: boolean;
  mobileOpen: boolean;
  userEmail: string;
  userName: string;
  onSelectDashboardTab: (dashboardId: DashboardOperationId, tabId: OperationTabId) => void;
  onSelectGlobalPage: (pageId: GlobalPageId) => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}

function getTabIcon(iconName: TabMenuItem["iconName"]) {
  switch (iconName) {
    case "layout":
      return LayoutDashboard;
    case "megaphone":
      return Megaphone;
    case "link":
      return Link2;
    case "plug":
      return Plug;
    case "sliders":
      return Sliders;
    case "percent":
      return Percent;
    case "receipt":
      return Receipt;
    case "file":
      return FileBarChart2;
    case "shopping":
      return ShoppingBag;
    case "activity":
      return Activity;
    case "bell":
      return Bell;
    case "dollar":
      return DollarSign;
    case "landmark":
      return Landmark;
    case "wallet":
      return Wallet;
    default:
      return LayoutDashboard;
  }
}

export function Sidebar({
  location,
  collapsed,
  mobileOpen,
  userEmail,
  userName,
  onSelectDashboardTab,
  onSelectGlobalPage,
  onToggleCollapsed,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const [dashboardsGroupOpen, setDashboardsGroupOpen] = useState(true);
  const [expandedDashboards, setExpandedDashboards] = useState<
    Record<DashboardOperationId, boolean>
  >({
    tiktok: location.kind === "dashboard" ? location.dashboardId === "tiktok" : false,
    omegapay: location.kind === "dashboard" ? location.dashboardId === "omegapay" : true,
  });

  const activeDashboardId: DashboardOperationId | null =
    location.kind === "dashboard" ? location.dashboardId : null;

  function handleDashboardHeaderClick(dashId: DashboardOperationId) {
    if (collapsed) {
      onSelectDashboardTab(dashId, "resumo");
      return;
    }
    setExpandedDashboards((prev) => ({
      ...prev,
      [dashId]: activeDashboardId === dashId ? !prev[dashId] : true,
    }));
    if (activeDashboardId !== dashId) {
      onSelectDashboardTab(dashId, "resumo");
    }
  }

  const globalItems: Array<{
    id: GlobalPageId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "minha_conta", label: "Minha conta", icon: UserCircle2 },
    { id: "configuracoes", label: "Configurações", icon: Settings },
    { id: "suporte", label: "Suporte", icon: HelpCircle },
  ];

  const initials = (userName || userEmail || "T")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-md transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 border-r border-white/10 bg-[#08080a] flex flex-col justify-between transition-all duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* TOPO DA SIDEBAR: LOGO DASHFY */}
        <div
          className={`p-5 border-b border-white/[0.08] flex items-center ${
            collapsed ? "justify-center px-3" : "justify-between"
          } shrink-0`}
        >
          <button
            type="button"
            onClick={() => {
              const targetDash = activeDashboardId || "omegapay";
              onSelectDashboardTab(targetDash, "resumo");
              onCloseMobile();
            }}
            className="flex items-center focus:outline-none"
            aria-label="Ir para o Resumo Dashfy"
          >
            <DashfyBrand collapsed={collapsed} size="md" />
          </button>

          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
                title="Recolher menu lateral"
                aria-label="Recolher menu lateral"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1 rounded-lg text-zinc-400 hover:text-white"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {collapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-white/[0.06]">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MENU PRINCIPAL */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setDashboardsGroupOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] transition"
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-zinc-300" />
                  <span>Dashboards</span>
                </span>
                {dashboardsGroupOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
            ) : (
              <div className="px-1 py-1 text-[10px] text-center font-semibold uppercase tracking-wider text-zinc-500">
                Ops
              </div>
            )}

            {(dashboardsGroupOpen || collapsed) && (
              <div className={collapsed ? "space-y-1.5" : "space-y-1.5 pl-1"}>
                {DASHBOARD_DEFINITIONS.map((dash) => {
                  const isDashActive = activeDashboardId === dash.id;
                  const isExpanded = expandedDashboards[dash.id] || isDashActive;

                  return (
                    <div key={dash.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleDashboardHeaderClick(dash.id)}
                        title={dash.name}
                        className={`btn-pressable w-full flex items-center ${
                          collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2"
                        } rounded-xl text-xs font-medium transition-all ${
                          isDashActive
                            ? "bg-white/10 text-white font-semibold border border-white/15"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isDashActive ? "bg-white" : "bg-zinc-500"
                            }`}
                          />
                          {!collapsed && <span className="truncate">{dash.name}</span>}
                        </span>
                        {!collapsed &&
                          (isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          ))}
                      </button>

                      {!collapsed && isExpanded && (
                        <div className="ml-3 pl-2.5 border-l border-white/[0.08] space-y-0.5 py-1">
                          {dash.tabs.map((tab) => {
                            const Icon = getTabIcon(tab.iconName);
                            const isTabActive =
                              location.kind === "dashboard" &&
                              location.dashboardId === dash.id &&
                              location.tabId === tab.id;

                            return (
                              <button
                                key={`${dash.id}-${tab.id}`}
                                type="button"
                                onClick={() => {
                                  onSelectDashboardTab(dash.id, tab.id);
                                  onCloseMobile();
                                }}
                                className={`btn-pressable w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isTabActive
                                    ? "bg-white text-black font-semibold shadow-sm"
                                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ITENS GLOBAIS */}
          <div className="pt-3 border-t border-white/[0.08] space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Conta &amp; Sistema
              </div>
            )}
            {globalItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.kind === "global" && location.pageId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectGlobalPage(item.id);
                    onCloseMobile();
                  }}
                  title={item.label}
                  className={`btn-pressable w-full flex items-center ${
                    collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
                  } rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* RODAPÉ: PERFIL + SAIR */}
        <div className="p-4 border-t border-white/[0.08] bg-[#050507]/80 shrink-0">
          <div
            className={`flex items-center ${
              collapsed ? "justify-center flex-col gap-2" : "justify-between gap-2"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                onSelectGlobalPage("minha_conta");
                onCloseMobile();
              }}
              className="flex items-center gap-2.5 min-w-0 text-left"
              title={`${userName} (${userEmail})`}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initials || "T"}
              </div>
              {!collapsed && (
                <div className="truncate">
                  <span className="text-xs font-medium text-white block truncate">
                    {userEmail}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    Administrador &bull; Supabase Live
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="btn-pressable p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition shrink-0"
              title="Sair"
              aria-label="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
