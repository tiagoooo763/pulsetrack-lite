"use client";

import React, { useState } from "react";
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileBarChart2,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Link2,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
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
  getTabsForMode,
  type DashboardConfigRecord,
  type DashboardOperationId,
  type DashboardOperationMode,
  type GlobalPageId,
  type NavigationLocation,
  type OperationTabId,
  type TabMenuItem,
} from "@/lib/dashfy-types";
import { DashfyBrand } from "./DashfyBrand";

interface SidebarProps {
  dashboards: DashboardConfigRecord[];
  location: NavigationLocation;
  collapsed: boolean;
  mobileOpen: boolean;
  userEmail: string;
  userName: string;
  onSelectGeneral: () => void;
  onSelectDashboardTab: (dashboardId: DashboardOperationId, tabId: OperationTabId) => void;
  onUpdateDashboardConfig: (
    dashboardId: string,
    updates: { name: string; mode: DashboardOperationMode }
  ) => Promise<void>;
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
  dashboards,
  location,
  collapsed,
  mobileOpen,
  userEmail,
  userName,
  onSelectGeneral,
  onSelectDashboardTab,
  onUpdateDashboardConfig,
  onSelectGlobalPage,
  onToggleCollapsed,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const [dashboardsGroupOpen, setDashboardsGroupOpen] = useState(true);
  const [expandedDashboards, setExpandedDashboards] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (location.kind === "dashboard") {
      initial[location.dashboardId] = true;
    } else if (dashboards[0]) {
      initial[dashboards[0].id] = true;
    }
    return initial;
  });

  // Edição inline do nome e modo da aba
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState<DashboardOperationMode>("tiktok");
  const [savingEdit, setSavingEdit] = useState(false);

  const activeDashboardId: DashboardOperationId | null =
    location.kind === "dashboard" ? location.dashboardId : null;

  function handleDashboardHeaderClick(dashId: string) {
    if (collapsed) {
      onSelectDashboardTab(dashId, "resumo");
      return;
    }
    const currentlyOpen = Boolean(expandedDashboards[dashId]);
    setExpandedDashboards((prev) => ({
      ...prev,
      [dashId]: !currentlyOpen,
    }));
    // Ao abrir uma aba que não estava ativa, navega para o Resumo dela;
    // Ao clicar numa aba já aberta, ela fecha normalmente!
    if (!currentlyOpen && activeDashboardId !== dashId) {
      onSelectDashboardTab(dashId, "resumo");
    }
  }

  function startEditing(dash: DashboardConfigRecord, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(dash.id);
    setEditName(dash.name);
    setEditMode(dash.mode);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdateDashboardConfig(editingId, {
        name: editName.trim(),
        mode: editMode,
      });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
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
              onSelectGeneral();
              onCloseMobile();
            }}
            className="flex items-center focus:outline-none"
            aria-label="Ir para o Dash Geral"
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
          {/* ABA DASH GERAL — RESUMO DE TODAS AS OPERAÇÕES */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectGeneral();
                onCloseMobile();
              }}
              title="Dash Geral (Todas as Operações)"
              className={`btn-pressable w-full flex items-center ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5"
              } rounded-xl text-xs font-medium transition-all ${
                location.kind === "general"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Dash Geral</span>}
            </button>
          </div>

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
                {dashboards.map((dash) => {
                  const isDashActive = activeDashboardId === dash.id;
                  const isExpanded = Boolean(expandedDashboards[dash.id]);
                  const isEditing = editingId === dash.id;
                  const tabs = getTabsForMode(dash.mode);

                  return (
                    <div key={dash.id} className="space-y-0.5">
                      {/* Cabeçalho da Aba (abre e fecha normalmente + botão renomear) */}
                      <div
                        className={`group flex items-center rounded-xl transition-all ${
                          isDashActive
                            ? "bg-white/10 text-white border border-white/15"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleDashboardHeaderClick(dash.id)}
                          title={`${dash.name} (${dash.mode === "tiktok" ? "TikTok" : "OmegaPay"})`}
                          className={`flex-1 min-w-0 flex items-center ${
                            collapsed ? "justify-center px-2 py-2.5" : "justify-between pl-3 pr-1.5 py-2"
                          } text-xs font-medium text-left`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isDashActive ? "bg-white" : "bg-zinc-500"
                              }`}
                            />
                            {!collapsed && (
                              <span className="truncate font-semibold">{dash.name}</span>
                            )}
                          </span>
                          {!collapsed &&
                            (isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1" />
                            ))}
                        </button>

                        {!collapsed && (
                          <button
                            type="button"
                            onClick={(e) => startEditing(dash, e)}
                            title="Renomear aba ou trocar modo (TikTok / OmegaPay)"
                            aria-label={`Editar ${dash.name}`}
                            className="p-1.5 mr-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Formulário inline de renomeação & troca de tipo */}
                      {!collapsed && isEditing && (
                        <form
                          onSubmit={handleSaveEdit}
                          className="mx-1 mt-1 p-2.5 rounded-xl border border-white/15 bg-[#0c0c0e] space-y-2 animate-fade-in-up"
                        >
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                              Nome da aba
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={40}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              placeholder="Ex: TikTok Loja 01"
                              className="w-full rounded-lg border border-white/15 bg-[#050507] px-2.5 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                              Tipo de operação
                            </label>
                            <select
                              value={editMode}
                              onChange={(e) =>
                                setEditMode(e.target.value as DashboardOperationMode)
                              }
                              className="w-full rounded-lg border border-white/15 bg-[#050507] px-2 py-1.5 text-xs text-white focus:border-white focus:outline-none"
                            >
                              <option value="tiktok">TikTok Ads</option>
                              <option value="omegapay">OmegaPay</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="btn-pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-100 text-[11px] font-semibold disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>{savingEdit ? "..." : "Salvar"}</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Submenu lateral da aba */}
                      {!collapsed && isExpanded && (
                        <div className="ml-3 pl-2.5 border-l border-white/[0.08] space-y-0.5 py-1">
                          {tabs.map((tab) => {
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
