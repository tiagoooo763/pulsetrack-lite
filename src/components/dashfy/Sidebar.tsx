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
  Target,
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
  companyName?: string;
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
    case "target":
      return Target;
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
  companyName,
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
          className="fixed inset-0 bg-[#020612]/80 z-40 lg:hidden backdrop-blur-md transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 border-r border-blue-200/10 bg-[#071022] flex flex-col justify-between transition-all duration-300 ease-in-out shadow-[8px_0_32px_-16px_rgba(2,6,18,0.85)] ${
          collapsed ? "w-[72px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* TOPO DA SIDEBAR: LOGO DASHFY */}
        <div
          className={`h-16 px-4 border-b border-blue-200/10 bg-gradient-to-b from-[#1d74ff]/[0.08] to-transparent flex items-center ${
            collapsed ? "justify-center px-3" : "justify-between"
          } shrink-0`}
        >
          <button
            type="button"
            onClick={() => {
              onSelectGeneral();
              onCloseMobile();
            }}
            className="flex items-center focus:outline-none rounded-lg"
            aria-label="Ir para o Dash Geral"
          >
            <DashfyBrand collapsed={collapsed} size="md" />
          </button>

          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1d74ff]/15 transition"
                title="Recolher menu lateral"
                aria-label="Recolher menu lateral"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {collapsed && (
          <div className="hidden lg:flex justify-center py-2.5 border-b border-blue-200/10">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1d74ff]/15 transition"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MENU PRINCIPAL */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* ABA DASH GERAL — RESUMO DE TODAS AS OPERAÇÕES */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Visão Geral
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectGeneral();
                onCloseMobile();
              }}
              title="Dash Geral (Todas as Operações)"
              className={`btn-pressable w-full flex items-center ${
                collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5"
              } rounded-xl text-[13px] font-medium transition-all ${
                location.kind === "general"
                  ? "bg-[#1d74ff] text-white font-semibold shadow-[0_8px_22px_-6px_rgba(29,116,255,0.58)]"
                  : "text-slate-300 hover:text-white hover:bg-[#1d74ff]/10"
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Dash Geral</span>}
            </button>
          </div>

          <div className="space-y-1.5">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setDashboardsGroupOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] transition"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#5ea1ff]" />
                  <span>Operações</span>
                </span>
                {dashboardsGroupOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            ) : (
              <div className="px-1 py-1 text-[10px] text-center font-semibold uppercase tracking-wider text-slate-500">
                Ops
              </div>
            )}

            {(dashboardsGroupOpen || collapsed) && (
              <div className={collapsed ? "space-y-1.5" : "space-y-1.5"}>
                {dashboards.map((dash) => {
                  const isDashActive = activeDashboardId === dash.id;
                  const isExpanded = Boolean(expandedDashboards[dash.id]);
                  const isEditing = editingId === dash.id;
                  const tabs = getTabsForMode(dash.mode);

                  return (
                    <div key={dash.id} className="space-y-1">
                      {/* Cabeçalho da Aba (abre e fecha normalmente + botão renomear) */}
                      <div
                        className={`group flex items-center rounded-xl transition-all ${
                          isDashActive
                            ? "bg-[#1d74ff]/[0.14] text-white border border-[#3b8bff]/30"
                            : "text-slate-300 hover:text-white hover:bg-[#1d74ff]/[0.08] border border-transparent"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleDashboardHeaderClick(dash.id)}
                          title={`${dash.name} (${dash.mode === "tiktok" ? "TikTok" : "OmegaPay"})`}
                          className={`flex-1 min-w-0 flex items-center ${
                            collapsed ? "justify-center px-2 py-2.5" : "justify-between pl-3 pr-1.5 py-2.5"
                          } text-[13px] font-medium text-left`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                                isDashActive
                                  ? "bg-[#3b8bff] shadow-[0_0_8px_rgba(59,139,255,0.9)]"
                                  : "bg-slate-500 group-hover:bg-[#5ea1ff]"
                              }`}
                            />
                            {!collapsed && (
                              <span className="truncate font-semibold">{dash.name}</span>
                            )}
                          </span>
                          {!collapsed &&
                            (isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
                            ))}
                        </button>

                        {!collapsed && (
                          <button
                            type="button"
                            onClick={(e) => startEditing(dash, e)}
                            title="Renomear operação ou escolher integração (TikTok / Gateway)"
                            aria-label={`Editar ${dash.name}`}
                            className="p-1.5 mr-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1d74ff]/20 transition shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Formulário inline de renomeação & troca de tipo */}
                      {!collapsed && isEditing && (
                        <form
                          onSubmit={handleSaveEdit}
                          className="mx-1 mt-1 p-3 rounded-xl border border-[#3b8bff]/30 bg-[#0a1529] space-y-2.5 animate-fade-in-up shadow-lg"
                        >
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
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
                              className="dashfy-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Integração principal
                            </label>
                            <select
                              value={editMode}
                              onChange={(e) =>
                                setEditMode(e.target.value as DashboardOperationMode)
                              }
                              className="dashfy-input w-full px-2.5 py-1.5 text-xs"
                            >
                              <option value="tiktok">TikTok Ads</option>
                              <option value="omegapay">Gateway (OmegaPay / Nexus)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white transition"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="btn-pressable dashfy-btn-primary px-2.5 py-1 text-[11px] disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>{savingEdit ? "..." : "Salvar"}</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Submenu lateral da aba */}
                      {!collapsed && isExpanded && (
                        <div className="ml-3.5 pl-2.5 border-l border-blue-200/10 space-y-0.5 py-1">
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
                                className={`btn-pressable w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                                  isTabActive
                                    ? "bg-[#1d74ff] text-white font-semibold shadow-[0_6px_18px_-6px_rgba(29,116,255,0.65)]"
                                    : "text-slate-400 hover:text-white hover:bg-[#1d74ff]/10"
                                }`}
                              >
                                <Icon
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isTabActive ? "text-white" : "text-slate-400"
                                  }`}
                                />
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
          <div className="pt-4 border-t border-blue-200/10 space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                  } rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-[#1d74ff] text-white font-semibold shadow-[0_8px_22px_-6px_rgba(29,116,255,0.58)]"
                      : "text-slate-400 hover:text-white hover:bg-[#1d74ff]/10"
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
        <div className="p-3.5 border-t border-blue-200/10 bg-[#050b18]/90 shrink-0">
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
              className="flex items-center gap-2.5 min-w-0 text-left group rounded-lg p-1 -m-1 hover:bg-[#1d74ff]/10 transition"
              title={`${userName} (${userEmail})`}
            >
              <div className="w-8 h-8 rounded-full bg-[#1d74ff]/20 border border-[#3b8bff]/40 flex items-center justify-center text-xs font-semibold text-sky-200 shrink-0">
                {initials || "T"}
              </div>
              {!collapsed && (
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-100 block truncate group-hover:text-white">
                    {userEmail}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {companyName || "Dashfy Workspace"}
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="btn-pressable p-2 text-slate-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition shrink-0"
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
