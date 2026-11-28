"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Bot,
  Calculator,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import type {
  CampaignMetricConfigRecord,
  MetricAlertLogRecord,
  TikTokCampaignRecord,
  UserMetricTemplateRecord,
} from "@/lib/db";
import type { PeriodPreset } from "@/lib/dashfy-types";
import {
  ALL_METRIC_IDS,
  BUILT_IN_METRIC_TEMPLATES,
  calculateTargetCpaAndRoas,
  DEFAULT_ALERT_SETTINGS,
  evaluateCampaignSummary,
  evaluateMetricAlerts,
  evaluateMetricCard,
  formatMetricValue,
  generateCampaignAssistantInsights,
  getDefaultMetricSetup,
  METRIC_CATEGORY_LABELS,
  METRIC_DEFINITIONS,
  OBJECTIVE_LABELS,
  splitRowsByPeriod,
  type CampaignObjective,
  type EvaluatedMetricCard,
  type MetricAlertSettings,
  type MetricEvalStatus,
  type MetricGoalConfig,
  type MetricGoalType,
  type MetricId,
  type MetricTemplateDefinition,
} from "@/lib/my-metrics";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";
import { DetailedMetricChart, MiniMetricSparkline } from "./MyMetricsCharts";

export const OPERATION_DEFAULT_KEY = "__DEFAULT__";

interface CampaignOption {
  key: string;
  campaignName: string;
  adAccount: string;
  rows: TikTokCampaignRecord[];
}

interface MyMetricsViewProps {
  dashboardId: string;
  dashboardName: string;
  campaigns: TikTokCampaignRecord[];
  initialCampaignKey?: string | null;
}

function getStatusBadgeStyles(status: MetricEvalStatus) {
  switch (status) {
    case "on_target":
      return {
        pill: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
        bar: "bg-emerald-400",
        Icon: CheckCircle2,
      };
    case "attention":
      return {
        pill: "border-amber-500/35 bg-amber-500/10 text-amber-300",
        bar: "bg-amber-400",
        Icon: AlertTriangle,
      };
    case "off_target":
      return {
        pill: "border-rose-500/35 bg-rose-500/10 text-rose-300",
        bar: "bg-rose-400",
        Icon: XCircle,
      };
    default:
      return {
        pill: "border-zinc-700 bg-white/[0.04] text-zinc-400",
        bar: "bg-zinc-600",
        Icon: HelpCircle,
      };
  }
}

export function MyMetricsView({
  dashboardId,
  dashboardName,
  campaigns,
  initialCampaignKey,
}: MyMetricsViewProps) {
  // Lista de campanhas únicas na operação (reutiliza 100% dos dados já carregados do TikTok Ads)
  const campaignOptions = useMemo<CampaignOption[]>(() => {
    const map = new Map<string, CampaignOption>();
    for (const row of campaigns) {
      const key = `${row.adAccount}::${row.campaignName}`;
      const existing = map.get(key) || {
        key,
        campaignName: row.campaignName,
        adAccount: row.adAccount,
        rows: [],
      };
      existing.rows.push(row);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => {
      const spendA = a.rows.reduce((s, r) => s + r.spend, 0);
      const spendB = b.rows.reduce((s, r) => s + r.spend, 0);
      return spendB - spendA;
    });
  }, [campaigns]);

  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string>(() => {
    if (initialCampaignKey) return initialCampaignKey;
    return campaignOptions[0]?.key || OPERATION_DEFAULT_KEY;
  });

  useEffect(() => {
    if (initialCampaignKey) {
      setSelectedCampaignKey(initialCampaignKey);
    } else if (
      selectedCampaignKey === OPERATION_DEFAULT_KEY &&
      campaignOptions.length > 0
    ) {
      setSelectedCampaignKey(campaignOptions[0].key);
    }
  }, [initialCampaignKey, campaignOptions, selectedCampaignKey]);

  // Estado persistido carregado sob demanda da API
  const [savedConfigs, setSavedConfigs] = useState<CampaignMetricConfigRecord[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserMetricTemplateRecord[]>([]);
  const [alertLogs, setAlertLogs] = useState<MetricAlertLogRecord[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);

  // Estado editável da visualização atual
  const [viewName, setViewName] = useState("Padrão");
  const [objective, setObjective] = useState<CampaignObjective>("conversion");
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>(
    () => getDefaultMetricSetup().selectedMetrics
  );
  const [goals, setGoals] = useState<Record<string, MetricGoalConfig>>(
    () => getDefaultMetricSetup().goals
  );
  const [alertSettings, setAlertSettings] = useState<MetricAlertSettings>(
    () => ({ ...DEFAULT_ALERT_SETTINGS })
  );
  const [showSparklines, setShowSparklines] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modais e painéis auxiliares
  const [activeDetailMetricId, setActiveDetailMetricId] = useState<MetricId | null>(null);
  const [addMetricOpen, setAddMetricOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [newViewModalOpen, setNewViewModalOpen] = useState(false);
  const [newViewInput, setNewViewInput] = useState("");

  // Salvar modelo + aplicar em lote
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [bulkTemplate, setBulkTemplate] = useState<MetricTemplateDefinition | null>(null);
  const [bulkSelectedKeys, setBulkSelectedKeys] = useState<string[]>([]);
  const [bulkOverwrite, setBulkOverwrite] = useState(false);

  // Calculadora CPA / ROAS
  const [calcTicket, setCalcTicket] = useState("197");
  const [calcCost, setCalcCost] = useState("35");
  const [calcFeePct, setCalcFeePct] = useState("5.5");
  const [calcMarginPct, setCalcMarginPct] = useState("30");

  // Status de ações
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadRemoteData = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const [cfgRes, tplRes, alertRes] = await Promise.all([
        fetch(`/api/metrics/configs?dashboardId=${encodeURIComponent(dashboardId)}`, {
          cache: "no-store",
        }),
        fetch("/api/metrics/templates", { cache: "no-store" }),
        fetch(`/api/metrics/alerts?dashboardId=${encodeURIComponent(dashboardId)}`, {
          cache: "no-store",
        }),
      ]);
      if (cfgRes.ok) {
        const j = (await cfgRes.json()) as { configs?: CampaignMetricConfigRecord[] };
        if (Array.isArray(j.configs)) setSavedConfigs(j.configs);
      }
      if (tplRes.ok) {
        const j = (await tplRes.json()) as { templates?: UserMetricTemplateRecord[] };
        if (Array.isArray(j.templates)) setUserTemplates(j.templates);
      }
      if (alertRes.ok) {
        const j = (await alertRes.json()) as { logs?: MetricAlertLogRecord[] };
        if (Array.isArray(j.logs)) setAlertLogs(j.logs);
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingRemote(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    void loadRemoteData();
  }, [loadRemoteData]);

  // Visualizações salvas para a campanha selecionada
  const campaignViews = useMemo(
    () => savedConfigs.filter((c) => c.campaignKey === selectedCampaignKey),
    [savedConfigs, selectedCampaignKey]
  );

  // Carrega a visualização ativa ao trocar de campanha ou receber configs do banco
  const applyConfigToEditor = useCallback((cfg: CampaignMetricConfigRecord | null) => {
    if (!cfg) {
      const def = getDefaultMetricSetup();
      setViewName("Padrão");
      setObjective(def.objective);
      setPeriod("30d");
      setSelectedMetrics(def.selectedMetrics);
      setGoals(def.goals);
      setAlertSettings(def.alertSettings);
      setHasUnsavedChanges(false);
      return;
    }

    const validMetrics = (cfg.selectedMetrics || []).filter((m): m is MetricId =>
      ALL_METRIC_IDS.includes(m as MetricId)
    );
    const defaults = getDefaultMetricSetup();
    setViewName(cfg.viewName || "Padrão");
    setObjective(cfg.objective || "conversion");
    setPeriod((cfg.periodPreset as PeriodPreset) || "30d");
    setSelectedMetrics(validMetrics.length > 0 ? validMetrics : defaults.selectedMetrics);
    setGoals(
      cfg.goals && Object.keys(cfg.goals).length > 0
        ? (cfg.goals as Record<string, MetricGoalConfig>)
        : defaults.goals
    );
    setAlertSettings({
      ...DEFAULT_ALERT_SETTINGS,
      ...((cfg.alertSettings || {}) as Partial<MetricAlertSettings>),
    });
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (loadingRemote) return;
    const directViews = savedConfigs.filter(
      (c) => c.campaignKey === selectedCampaignKey
    );
    const activeDirect = directViews.find((v) => v.isActive) || directViews[0];
    if (activeDirect) {
      applyConfigToEditor(activeDirect);
      return;
    }
    // Herda a meta padrão da operação (se existir) para campanhas novas sem personalização própria
    const defaultOp = savedConfigs.find(
      (c) => c.campaignKey === OPERATION_DEFAULT_KEY
    );
    applyConfigToEditor(defaultOp || null);
  }, [selectedCampaignKey, savedConfigs, loadingRemote, applyConfigToEditor]);

  const activeCampaignOption = useMemo(
    () => campaignOptions.find((c) => c.key === selectedCampaignKey) || null,
    [campaignOptions, selectedCampaignKey]
  );

  // Linhas da campanha (ou de toda a operação quando estiver editando o Padrão da Operação)
  const scopedRows = useMemo(() => {
    if (selectedCampaignKey === OPERATION_DEFAULT_KEY) return campaigns;
    return activeCampaignOption?.rows || [];
  }, [selectedCampaignKey, campaigns, activeCampaignOption]);

  const { currentRows, previousRows, periodLabel } = useMemo(
    () => splitRowsByPeriod(scopedRows, period),
    [scopedRows, period]
  );

  // Avaliação de todos os cartões selecionados
  const evaluatedCards = useMemo<EvaluatedMetricCard[]>(() => {
    return selectedMetrics.map((metricId) =>
      evaluateMetricCard({
        metricId,
        goal: goals[metricId] || null,
        currentRows,
        previousRows,
      })
    );
  }, [selectedMetrics, goals, currentRows, previousRows]);

  const summary = useMemo(
    () => evaluateCampaignSummary(evaluatedCards, currentRows),
    [evaluatedCards, currentRows]
  );

  const activeCampaignLabel =
    selectedCampaignKey === OPERATION_DEFAULT_KEY
      ? `Padrão de ${dashboardName}`
      : activeCampaignOption?.campaignName || "Campanha";

  const assistantInsights = useMemo(
    () =>
      generateCampaignAssistantInsights({
        campaignName: activeCampaignLabel,
        objective,
        cards: evaluatedCards,
        summary,
        currentRows,
      }),
    [activeCampaignLabel, objective, evaluatedCards, summary, currentRows]
  );

  const liveAlerts = useMemo(
    () =>
      evaluateMetricAlerts({
        campaignKey: selectedCampaignKey,
        campaignName: activeCampaignLabel,
        cards: evaluatedCards,
        summary,
        settings: alertSettings,
      }),
    [selectedCampaignKey, activeCampaignLabel, evaluatedCards, summary, alertSettings]
  );

  // Sincroniza alertas disparados com cooldown no backend (1x por campanha/estado)
  const alertSyncSignature = useMemo(
    () => liveAlerts.map((a) => `${a.dedupeKey}:${a.severity}`).join("|"),
    [liveAlerts]
  );

  useEffect(() => {
    if (loadingRemote || liveAlerts.length === 0) return;
    const timer = setTimeout(() => {
      void fetch("/api/metrics/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId,
          cooldownHours: alertSettings.cooldownHours,
          alerts: liveAlerts.map((a) => ({
            ...a,
            campaignKey: selectedCampaignKey,
          })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.ok && Array.isArray(j.logs)) setAlertLogs(j.logs);
        })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [
    alertSyncSignature,
    loadingRemote,
    dashboardId,
    selectedCampaignKey,
    alertSettings.cooldownHours,
    liveAlerts,
  ]);

  const allTemplates = useMemo<MetricTemplateDefinition[]>(() => {
    const custom: MetricTemplateDefinition[] = userTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || "Modelo personalizado salvo na sua conta.",
      objective: t.objective,
      isBuiltIn: false,
      selectedMetrics: t.selectedMetrics.filter((m): m is MetricId =>
        ALL_METRIC_IDS.includes(m as MetricId)
      ),
      goals: (t.goals || {}) as Record<string, MetricGoalConfig>,
      alertSettings: {
        ...DEFAULT_ALERT_SETTINGS,
        ...((t.alertSettings || {}) as Partial<MetricAlertSettings>),
      },
    }));
    return [...BUILT_IN_METRIC_TEMPLATES, ...custom];
  }, [userTemplates]);

  const calcResult = useMemo(
    () =>
      calculateTargetCpaAndRoas({
        averageTicket: Number(calcTicket.replace(",", ".")),
        productCost: Number(calcCost.replace(",", ".")),
        gatewayFeePct: Number(calcFeePct.replace(",", ".")),
        desiredProfitMarginPct: Number(calcMarginPct.replace(",", ".")),
      }),
    [calcTicket, calcCost, calcFeePct, calcMarginPct]
  );

  // ==================== AÇÕES DE PERSONALIZAÇÃO ====================

  function handleMoveMetric(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= selectedMetrics.length) return;
    setSelectedMetrics((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setHasUnsavedChanges(true);
  }

  function handleRemoveMetric(metricId: MetricId) {
    if (selectedMetrics.length <= 1) {
      setNotice({
        type: "info",
        text: "Mantenha ao menos 1 indicador ativo na visualização.",
      });
      return;
    }
    setSelectedMetrics((prev) => prev.filter((id) => id !== metricId));
    setHasUnsavedChanges(true);
  }

  function handleAddMetric(metricId: MetricId) {
    if (selectedMetrics.includes(metricId)) return;
    const def = METRIC_DEFINITIONS[metricId];
    setSelectedMetrics((prev) => [...prev, metricId]);
    setGoals((prev) => {
      if (prev[metricId]) return prev;
      return {
        ...prev,
        [metricId]: {
          metricId,
          enabled: true,
          goalType: def.defaultGoalType,
          targetValue: def.defaultTarget,
          maxValue: def.defaultMaxTarget,
          attentionTolerancePct: 15,
          alertEnabled: true,
        },
      };
    });
    setHasUnsavedChanges(true);
  }

  function handleUpdateGoal(metricId: MetricId, updates: Partial<MetricGoalConfig>) {
    const def = METRIC_DEFINITIONS[metricId];
    setGoals((prev) => {
      const cur: MetricGoalConfig = prev[metricId] || {
        metricId,
        enabled: true,
        goalType: def.defaultGoalType,
        targetValue: def.defaultTarget,
        maxValue: def.defaultMaxTarget,
        attentionTolerancePct: 15,
        alertEnabled: true,
      };
      return {
        ...prev,
        [metricId]: { ...cur, ...updates },
      };
    });
    setHasUnsavedChanges(true);
  }

  async function handleSavePreferences(customViewName?: string) {
    setSaving(true);
    setNotice(null);
    const targetView = (customViewName || viewName).trim() || "Padrão";
    try {
      const res = await fetch("/api/metrics/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          dashboardId,
          adAccount: activeCampaignOption?.adAccount || "",
          campaignKey: selectedCampaignKey,
          campaignName: activeCampaignLabel,
          viewName: targetView,
          isActive: true,
          objective,
          periodPreset: period,
          selectedMetrics,
          goals,
          alertSettings,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNotice({
          type: "error",
          text: json.error || "Não foi possível salvar suas preferências.",
        });
      } else {
        if (Array.isArray(json.configs)) setSavedConfigs(json.configs);
        setViewName(targetView);
        setHasUnsavedChanges(false);
        setNotice({
          type: "success",
          text: json.message || "Preferências e metas salvas na sua conta!",
        });
      }
    } catch {
      setNotice({ type: "error", text: "Erro de rede ao salvar preferências." });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefaults() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/metrics/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_default",
          dashboardId,
          adAccount: activeCampaignOption?.adAccount || "",
          campaignKey: selectedCampaignKey,
          campaignName: activeCampaignLabel,
          viewName,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        if (Array.isArray(json.configs)) setSavedConfigs(json.configs);
        if (json.config) applyConfigToEditor(json.config);
        setNotice({
          type: "success",
          text: "Configurações restauradas para o padrão.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteView(id: string) {
    const res = await fetch(`/api/metrics/configs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSavedConfigs((prev) => prev.filter((c) => c.id !== id));
      setNotice({ type: "info", text: "Visualização removida." });
    }
  }

  function handleApplyTemplateHere(tpl: MetricTemplateDefinition) {
    setObjective(tpl.objective);
    setSelectedMetrics([...tpl.selectedMetrics]);
    setGoals(JSON.parse(JSON.stringify(tpl.goals)));
    setAlertSettings({ ...tpl.alertSettings });
    setHasUnsavedChanges(true);
    setTemplatesOpen(false);
    setNotice({
      type: "info",
      text: `Modelo "${tpl.name}" carregado. Clique em "Salvar preferências" para confirmar.`,
    });
  }

  async function handleCreateCustomTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/metrics/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim(),
          objective,
          selectedMetrics,
          goals,
          alertSettings,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        if (Array.isArray(json.templates)) setUserTemplates(json.templates);
        setNewTemplateName("");
        setNewTemplateDesc("");
        setNotice({
          type: "success",
          text: json.message || "Modelo personalizado salvo!",
        });
      } else {
        setNotice({ type: "error", text: json.error || "Erro ao salvar modelo." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustomTemplate(id: string) {
    const res = await fetch(`/api/metrics/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function handleConfirmBulkApply() {
    if (!bulkTemplate || bulkSelectedKeys.length === 0) return;
    setSaving(true);
    try {
      const targets = campaignOptions
        .filter((c) => bulkSelectedKeys.includes(c.key))
        .map((c) => ({
          campaignKey: c.key,
          campaignName: c.campaignName,
          adAccount: c.adAccount,
        }));
      const res = await fetch("/api/metrics/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_apply",
          dashboardId,
          targets,
          overwriteExisting: bulkOverwrite,
          objective: bulkTemplate.objective,
          periodPreset: period,
          selectedMetrics: bulkTemplate.selectedMetrics,
          goals: bulkTemplate.goals,
          alertSettings: bulkTemplate.alertSettings,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        if (Array.isArray(json.configs)) setSavedConfigs(json.configs);
        setBulkTemplate(null);
        setBulkSelectedKeys([]);
        setBulkOverwrite(false);
        setTemplatesOpen(false);
        setNotice({ type: "success", text: json.message });
      } else {
        setNotice({ type: "error", text: json.error || "Erro ao aplicar em lote." });
      }
    } finally {
      setSaving(false);
    }
  }

  function handleApplyCalculatorGoals() {
    if (!calcResult.feasible) return;
    if (!selectedMetrics.includes("cpa")) {
      setSelectedMetrics((prev) => ["cpa", ...prev]);
    }
    if (!selectedMetrics.includes("roas")) {
      setSelectedMetrics((prev) => [...prev, "roas"]);
    }
    handleUpdateGoal("cpa", {
      enabled: true,
      goalType: "max",
      targetValue: calcResult.targetMaxCpa,
    });
    handleUpdateGoal("roas", {
      enabled: true,
      goalType: "min",
      targetValue: calcResult.targetMinRoas,
    });
    setNotice({
      type: "success",
      text: `Metas atualizadas: CPA máx. ${formatBRL(calcResult.targetMaxCpa)} e ROAS mín. ${calcResult.targetMinRoas.toFixed(2)}x. Clique em "Salvar preferências" para persistir.`,
    });
  }

  const activeDetailCard = useMemo(
    () =>
      activeDetailMetricId
        ? evaluatedCards.find((c) => c.definition.id === activeDetailMetricId) || null
        : null,
    [activeDetailMetricId, evaluatedCards]
  );

  // Breakdown por conjunto de anúncios para o modal detalhado
  const adgroupBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; spend: number; clicks: number; impressions: number; conversions: number; revenue: number }
    >();
    for (const r of currentRows) {
      const k = r.adgroupName || "Conjunto Principal";
      const cur = map.get(k) || {
        name: k,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        revenue: 0,
      };
      cur.spend += r.spend;
      cur.clicks += r.clicks;
      cur.impressions += r.impressions;
      cur.conversions += r.conversions;
      cur.revenue += r.attributedRevenue;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [currentRows]);

  const existingConfiguredCampaignKeys = useMemo(
    () => new Set(savedConfigs.map((c) => c.campaignKey)),
    [savedConfigs]
  );

  return (
    <div className="space-y-5">
      {/* BARRA DE CONTROLE SUPERIOR: CAMPANHA, PERÍODO, VISUALIZAÇÕES E AÇÕES */}
      <SpotlightCard className="p-4 sm:p-5 bento-card space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/35 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-[#5ea1ff]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Minhas Métricas &amp; Metas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/[0.04] text-zinc-300">
                  {OBJECTIVE_LABELS[objective]}
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/35 bg-amber-500/10 text-amber-300">
                    Alterações não salvas
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Personalize indicadores, metas, visualizações e alertas por campanha no TikTok Ads ({periodLabel}).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-[#08080a] hover:bg-white/[0.06] text-xs font-medium text-zinc-200"
            >
              <Layers className="w-3.5 h-3.5 text-[#5ea1ff]" />
              <span>Modelos</span>
            </button>

            <button
              type="button"
              onClick={() => setCalcOpen((v) => !v)}
              className={`btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium ${
                calcOpen
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "border-white/15 bg-[#08080a] hover:bg-white/[0.06] text-zinc-200"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calc. CPA/ROAS</span>
            </button>

            <button
              type="button"
              onClick={() => setAlertsModalOpen(true)}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-[#08080a] hover:bg-white/[0.06] text-xs font-medium text-zinc-200"
            >
              <Bell className="w-3.5 h-3.5 text-amber-300" />
              <span>Alertas ({liveAlerts.length})</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving}
              className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-[#08080a] hover:border-white/25 text-xs font-medium text-zinc-300 disabled:opacity-50"
              title="Restaurar métricas e metas padrão"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar padrão</span>
            </button>

            <button
              type="button"
              onClick={() => handleSavePreferences()}
              disabled={saving}
              className="btn-pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Salvando..." : "Salvar preferências"}</span>
            </button>
          </div>
        </div>

        {/* SELETORES DE CAMPANHA, OBJETIVO, PERÍODO E VISUALIZAÇÕES SALVAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/10">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Campanha analisada
            </label>
            <select
              value={selectedCampaignKey}
              onChange={(e) => setSelectedCampaignKey(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
            >
              <option value={OPERATION_DEFAULT_KEY}>
                ★ Padrão da Operação ({dashboardName})
              </option>
              {campaignOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.campaignName} ({opt.adAccount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Período de análise
            </label>
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodPreset);
                setHasUnsavedChanges(true);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
            >
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="month">Mês atual</option>
              <option value="all">Todo o período</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Objetivo da campanha
            </label>
            <select
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value as CampaignObjective);
                setHasUnsavedChanges(true);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
            >
              {(Object.keys(OBJECTIVE_LABELS) as CampaignObjective[]).map((obj) => (
                <option key={obj} value={obj}>
                  {OBJECTIVE_LABELS[obj]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Visualização salva
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={viewName}
                onChange={(e) => {
                  const chosen = campaignViews.find((v) => v.viewName === e.target.value);
                  if (chosen) applyConfigToEditor(chosen);
                  else setViewName(e.target.value);
                }}
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              >
                {campaignViews.length === 0 && <option value="Padrão">Padrão</option>}
                {campaignViews.map((v) => (
                  <option key={v.id} value={v.viewName}>
                    {v.viewName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNewViewInput("");
                  setNewViewModalOpen(true);
                }}
                className="p-2 rounded-xl border border-white/10 bg-[#08080a] hover:bg-white/10 text-zinc-300 hover:text-white shrink-0"
                title="Criar nova visualização para esta campanha"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {campaignViews.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const cur = campaignViews.find((v) => v.viewName === viewName);
                    if (cur) void handleDeleteView(cur.id);
                  }}
                  className="p-2 rounded-xl border border-white/10 bg-[#08080a] hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 shrink-0"
                  title="Excluir visualização atual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div
            role={notice.type === "error" ? "alert" : "status"}
            className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-2 ${
              notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : notice.type === "error"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-200"
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SpotlightCard>

      {/* CALCULADORA INTEGRADA DE CPA MÁXIMO & ROAS MÍNIMO */}
      {calcOpen && (
        <SpotlightCard className="p-5 bento-card border-emerald-500/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">
                Calculadora de CPA Máximo e ROAS Mínimo
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setCalcOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Ticket médio (R$)
              </label>
              <input
                type="text"
                value={calcTicket}
                onChange={(e) => setCalcTicket(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Custo do produto (R$)
              </label>
              <input
                type="text"
                value={calcCost}
                onChange={(e) => setCalcCost(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Taxas / Gateway (%)
              </label>
              <input
                type="text"
                value={calcFeePct}
                onChange={(e) => setCalcFeePct(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Margem de lucro alvo (%)
              </label>
              <input
                type="text"
                value={calcMarginPct}
                onChange={(e) => setCalcMarginPct(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="rounded-xl border border-white/10 bg-[#08080a] p-3">
              <div className="text-[10px] uppercase text-zinc-400">CPA Empate</div>
              <div className="text-sm font-mono font-semibold text-zinc-200 mt-0.5">
                {formatBRL(calcResult.breakEvenCpa)}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#08080a] p-3">
              <div className="text-[10px] uppercase text-zinc-400">ROAS Empate</div>
              <div className="text-sm font-mono font-semibold text-zinc-200 mt-0.5">
                {calcResult.breakEvenRoas.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase text-emerald-300">CPA Máximo Ideal</div>
              <div className="text-sm font-mono font-bold text-emerald-200 mt-0.5">
                {calcResult.feasible ? formatBRL(calcResult.targetMaxCpa) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase text-emerald-300">ROAS Mínimo Ideal</div>
              <div className="text-sm font-mono font-bold text-emerald-200 mt-0.5">
                {calcResult.feasible ? `${calcResult.targetMinRoas.toFixed(2)}x` : "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
            <p className="text-xs text-zinc-300">{calcResult.note}</p>
            <button
              type="button"
              disabled={!calcResult.feasible}
              onClick={handleApplyCalculatorGoals}
              className="btn-pressable px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-semibold shrink-0 disabled:opacity-40"
            >
              Aplicar como metas desta campanha
            </button>
          </div>
        </SpotlightCard>
      )}

      {/* RESUMO VISUAL DA CAMPANHA (SEÇÃO 5) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SpotlightCard className="p-4 bento-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Metas configuradas
          </div>
          <div className="text-2xl font-mono font-semibold text-white mt-1.5">
            {summary.configuredCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {selectedMetrics.length} cartões ativos
          </div>
        </SpotlightCard>

        <SpotlightCard className="p-4 bento-card border-emerald-500/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Atingidas</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-emerald-400 mt-1.5">
            {summary.achievedCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Dentro do objetivo</div>
        </SpotlightCard>

        <SpotlightCard className="p-4 bento-card border-amber-500/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Atenção</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-amber-300 mt-1.5">
            {summary.attentionCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Próximas do limite</div>
        </SpotlightCard>

        <SpotlightCard className="p-4 bento-card border-rose-500/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Fora da meta</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-rose-400 mt-1.5">
            {summary.missedCount}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Requer investigação</div>
        </SpotlightCard>

        <SpotlightCard className="p-4 bento-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Sem dados</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-300 mt-1.5">
            {summary.insufficientDataCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Amostra insuficiente</div>
        </SpotlightCard>

        <SpotlightCard className="p-4 bento-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Tendência &amp; Financeiro
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {summary.overallTrend === "improving" ? (
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : summary.overallTrend === "declining" ? (
              <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Minus className="w-4 h-4 text-zinc-400 shrink-0" />
            )}
            <span className="text-xs font-semibold text-white truncate">
              {summary.overallTrendLabel}
            </span>
          </div>
          <div
            className={`text-[11px] font-mono mt-1 truncate ${
              summary.financialHealth === "profitable"
                ? "text-emerald-400"
                : summary.financialHealth === "losing"
                  ? "text-rose-400"
                  : "text-zinc-400"
            }`}
          >
            {summary.financialHealthLabel}
          </div>
        </SpotlightCard>
      </section>

      {/* ALERTA DE DISTINÇÃO TRÁFEGO vs FINANCEIRO */}
      {summary.financialWarning && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{summary.financialWarning}</span>
        </div>
      )}

      {/* CABEÇALHO DA GRADE DE CARTÕES */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">
            Indicadores de {activeCampaignLabel}
          </h4>
          <p className="text-xs text-zinc-400">
            Clique em qualquer cartão para ver o gráfico detalhado, quebrar por conjunto e ajustar a meta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSparklines((v) => !v)}
            className="btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#08080a] text-xs text-zinc-300 hover:text-white"
          >
            {showSparklines ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{showSparklines ? "Ocultar mini gráficos" : "Exibir mini gráficos"}</span>
          </button>

          <button
            type="button"
            onClick={() => setAddMetricOpen((v) => !v)}
            className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar métrica</span>
          </button>
        </div>
      </div>

      {/* SELETOR RÁPIDO PARA ADICIONAR MÉTRICAS */}
      {addMetricOpen && (
        <SpotlightCard className="p-4 bento-card space-y-3 border-[#1d74ff]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Escolha os indicadores para acompanhar nesta campanha
            </span>
            <button
              type="button"
              onClick={() => setAddMetricOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_METRIC_IDS.map((mId) => {
              const def = METRIC_DEFINITIONS[mId];
              const active = selectedMetrics.includes(mId);
              return (
                <button
                  key={mId}
                  type="button"
                  onClick={() =>
                    active ? handleRemoveMetric(mId) : handleAddMetric(mId)
                  }
                  className={`text-left rounded-xl border p-3 transition flex items-start justify-between gap-2 ${
                    active
                      ? "border-[#1d74ff]/50 bg-[#1d74ff]/10"
                      : "border-white/10 bg-[#08080a] hover:border-white/25"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">
                        {def.shortLabel}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/10 bg-white/[0.04] text-zinc-400">
                        {METRIC_CATEGORY_LABELS[def.category]}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                      {def.description}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      active
                        ? "bg-white text-black"
                        : "border border-white/15 text-zinc-300"
                    }`}
                  >
                    {active ? "Ativo" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </SpotlightCard>
      )}

      {/* GRADE DE CARTÕES DE MÉTRICAS PERSONALIZADOS */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {evaluatedCards.map((card, index) => {
          const style = getStatusBadgeStyles(card.status);
          const StatusIcon = style.Icon;
          const def = card.definition;
          return (
            <SpotlightCard
              key={def.id}
              className="p-4 sm:p-5 bento-card flex flex-col justify-between gap-3.5 hover:border-white/25 transition"
            >
              {/* Topo do cartão: categoria + nome + reordenar/remover */}
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDetailMetricId(def.id)}
                  className="text-left min-w-0 flex-1 group"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border border-white/10 bg-white/[0.04] text-zinc-400">
                      {METRIC_CATEGORY_LABELS[def.category]}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {def.direction === "lower_is_better"
                        ? "Menor é melhor"
                        : "Maior é melhor"}
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-white mt-1 group-hover:text-[#5ea1ff] transition truncate">
                    {def.label}
                  </h5>
                </button>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveMetric(index, -1)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                    aria-label={`Mover ${def.shortLabel} para esquerda`}
                    title="Mover para esquerda"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === evaluatedCards.length - 1}
                    onClick={() => handleMoveMetric(index, 1)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30"
                    aria-label={`Mover ${def.shortLabel} para direita`}
                    title="Mover para direita"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveMetric(def.id)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                    aria-label={`Remover ${def.shortLabel}`}
                    title="Remover cartão"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Valor atual + Status visual (cor + ícone + texto) */}
              <button
                type="button"
                onClick={() => setActiveDetailMetricId(def.id)}
                className="text-left space-y-3 w-full"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-mono font-bold text-white tabular-nums">
                    {card.formattedCurrent}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${style.pill}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    <span>{card.statusLabel}</span>
                  </span>
                </div>

                {/* Meta configurada + Desvio absoluto e percentual */}
                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-xl border border-white/[0.06] bg-[#08080a] p-2.5">
                  <div>
                    <div className="text-zinc-500">Meta</div>
                    <div className="font-mono font-semibold text-zinc-200 truncate">
                      {card.formattedGoal}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-500">Desvio</div>
                    <div className="font-mono font-semibold text-zinc-200 truncate">
                      {card.formattedAbsDiff}{" "}
                      {card.formattedPctDiff !== "—" && (
                        <span className="text-zinc-400">({card.formattedPctDiff})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra visual de progresso / desvio */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${style.bar}`}
                      style={{ width: `${Math.max(4, Math.min(100, card.progressPct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="truncate pr-2">{card.statusReason}</span>
                    {card.trendDirection !== "unknown" && card.trendPct !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 font-mono shrink-0 ${
                          card.trendIsFavorable === true
                            ? "text-emerald-400"
                            : card.trendIsFavorable === false
                              ? "text-rose-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {card.trendDirection === "up" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : card.trendDirection === "down" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {Math.abs(card.trendPct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini gráfico histórico opcional */}
                {showSparklines && (
                  <MiniMetricSparkline
                    series={card.dailySeries}
                    status={card.status}
                    goal={card.goal}
                  />
                )}
              </button>

              {/* Rodapé do cartão */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                <span className="text-zinc-500">
                  {card.confidence === "low"
                    ? "Confiança baixa (poucos dados)"
                    : card.confidence === "high"
                      ? "Amostra confiável"
                      : "Aguardando dados"}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDetailMetricId(def.id)}
                  className="inline-flex items-center gap-1 text-[#5ea1ff] hover:text-white font-medium"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Meta &amp; Gráfico</span>
                </button>
              </div>
            </SpotlightCard>
          );
        })}
      </section>

      {/* ASSISTENTE INTELIGENTE + ALERTAS ATIVOS (SEÇÕES 7 e 8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <SpotlightCard className="lg:col-span-7 p-5 bento-card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/35 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#5ea1ff]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Assistente Inteligente de Campanhas
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Interpretação baseada nas suas metas, volume de dados e objetivo ({OBJECTIVE_LABELS[objective]})
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-[#5ea1ff] shrink-0" />
          </div>

          <div className="space-y-2.5">
            {assistantInsights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-xl border p-3.5 text-xs space-y-1 ${
                  insight.severity === "critical"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                    : insight.severity === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      : insight.severity === "positive"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border-white/10 bg-[#08080a] text-zinc-200"
                }`}
              >
                <div className="font-semibold flex items-center justify-between gap-2">
                  <span>{insight.title}</span>
                  {insight.metricId && (
                    <button
                      type="button"
                      onClick={() => setActiveDetailMetricId(insight.metricId!)}
                      className="text-[10px] underline opacity-85 hover:opacity-100 shrink-0"
                    >
                      Abrir gráfico
                    </button>
                  )}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {insight.message}
                </p>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="lg:col-span-5 p-5 bento-card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Alertas Inteligentes de Metas
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Cooldown: {alertSettings.cooldownHours}h • Mín. gasto:{" "}
                  {formatBRL(alertSettings.minSpendForAlerts)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertsModalOpen(true)}
              className="text-xs text-[#5ea1ff] hover:text-white font-medium"
            >
              Configurar
            </button>
          </div>

          {liveAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-400">
              Nenhum alerta crítico ativo para esta campanha no momento (respeitando seus limites mínimos de dados).
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveAlerts.map((al) => (
                <div
                  key={al.dedupeKey}
                  className={`rounded-xl border p-3 text-xs ${
                    al.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : al.severity === "positive"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <div className="font-semibold">{al.title}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">{al.message}</div>
                </div>
              ))}
            </div>
          )}

          {alertLogs.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Últimos alertas registrados
              </div>
              {alertLogs.slice(0, 3).map((lg) => (
                <div
                  key={lg.id}
                  className="flex items-center justify-between gap-2 text-[11px] text-zinc-400"
                >
                  <span className="truncate">{lg.title}</span>
                  <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                    {formatDateTimeBR(lg.triggeredAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SpotlightCard>
      </div>

      {/* ==================== MODAL 1: GRÁFICO DETALHADO + EDITOR DE META ==================== */}
      {activeDetailCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5ea1ff]">
                  {METRIC_CATEGORY_LABELS[activeDetailCard.definition.category]} •{" "}
                  {activeCampaignLabel}
                </div>
                <h3 className="text-base font-semibold text-white mt-0.5">
                  {activeDetailCard.definition.label}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {activeDetailCard.definition.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailMetricId(null)}
                className="p-1.5 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gráfico Histórico Detalhado com linha de meta */}
            <DetailedMetricChart
              series={activeDetailCard.dailySeries}
              unit={activeDetailCard.definition.unit}
              status={activeDetailCard.status}
              goal={activeDetailCard.goal}
              label={activeDetailCard.definition.shortLabel}
            />

            {/* Configuração de Meta Individual (4 tipos de meta) */}
            <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Configurar Meta Personalizada
                </h4>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(activeDetailCard.goal?.enabled)}
                    onChange={(e) =>
                      handleUpdateGoal(activeDetailCard.definition.id, {
                        enabled: e.target.checked,
                      })
                    }
                    className="accent-white"
                  />
                  <span>Meta ativa</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Tipo de meta
                  </label>
                  <select
                    value={
                      activeDetailCard.goal?.goalType ||
                      activeDetailCard.definition.defaultGoalType
                    }
                    onChange={(e) =>
                      handleUpdateGoal(activeDetailCard.definition.id, {
                        goalType: e.target.value as MetricGoalType,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white"
                  >
                    <option value="min">Valor mínimo desejado</option>
                    <option value="max">Valor máximo permitido</option>
                    <option value="range">Intervalo ideal (mín. e máx.)</option>
                    <option value="growth_pct">
                      Meta de evolução (%) vs período anterior
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {(activeDetailCard.goal?.goalType ||
                      activeDetailCard.definition.defaultGoalType) === "range"
                      ? "Limite mínimo ideal"
                      : (activeDetailCard.goal?.goalType ||
                            activeDetailCard.definition.defaultGoalType) === "growth_pct"
                        ? "Evolução desejada (%)"
                        : "Valor da meta"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      activeDetailCard.goal?.targetValue ??
                      activeDetailCard.definition.defaultTarget
                    }
                    onChange={(e) =>
                      handleUpdateGoal(activeDetailCard.definition.id, {
                        targetValue: Number(e.target.value || 0),
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                {(activeDetailCard.goal?.goalType ||
                  activeDetailCard.definition.defaultGoalType) === "range" ? (
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Limite máximo ideal
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        activeDetailCard.goal?.maxValue ??
                        activeDetailCard.definition.defaultMaxTarget ??
                        activeDetailCard.definition.defaultTarget * 2
                      }
                      onChange={(e) =>
                        handleUpdateGoal(activeDetailCard.definition.id, {
                          maxValue: Number(e.target.value || 0),
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      Faixa de atenção (%)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={40}
                      value={activeDetailCard.goal?.attentionTolerancePct ?? 15}
                      onChange={(e) =>
                        handleUpdateGoal(activeDetailCard.definition.id, {
                          attentionTolerancePct: Number(e.target.value || 15),
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={activeDetailCard.goal?.alertEnabled !== false}
                  onChange={(e) =>
                    handleUpdateGoal(activeDetailCard.definition.id, {
                      alertEnabled: e.target.checked,
                    })
                  }
                  className="accent-white"
                />
                <span>Ativar alertas inteligentes para este indicador</span>
              </label>
            </div>

            {/* Quebra por Grupo de Anúncios (para diagnosticar desvios rapidamente) */}
            {adgroupBreakdown.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Desempenho por Grupo de Anúncios no Período
                </h4>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#08080a] text-zinc-400 uppercase">
                      <tr>
                        <th className="p-2.5">Conjunto</th>
                        <th className="p-2.5 text-right">Invest.</th>
                        <th className="p-2.5 text-right">CTR</th>
                        <th className="p-2.5 text-right">CPA</th>
                        <th className="p-2.5 text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {adgroupBreakdown.slice(0, 6).map((ag) => {
                        const ctr =
                          ag.impressions > 0 ? (ag.clicks / ag.impressions) * 100 : 0;
                        const cpa = ag.conversions > 0 ? ag.spend / ag.conversions : null;
                        const roas = ag.spend > 0 ? ag.revenue / ag.spend : null;
                        return (
                          <tr key={ag.name}>
                            <td className="p-2.5 text-white font-medium truncate max-w-[180px]">
                              {ag.name}
                            </td>
                            <td className="p-2.5 text-right font-mono text-zinc-300">
                              {formatBRL(ag.spend)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-zinc-300">
                              {ctr.toFixed(2)}%
                            </td>
                            <td className="p-2.5 text-right font-mono text-zinc-200">
                              {cpa !== null ? formatBRL(cpa) : "—"}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-300">
                              {roas !== null ? `${roas.toFixed(2)}x` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveDetailMetricId(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSavePreferences();
                  setActiveDetailMetricId(null);
                }}
                disabled={saving}
                className="btn-pressable px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar meta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: NOVA VISUALIZAÇÃO ==================== */}
      {newViewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Criar Nova Visualização
              </h3>
              <button
                type="button"
                onClick={() => setNewViewModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Salve um conjunto alternativo de cartões e metas para alternar rapidamente nesta campanha (ex.: &quot;Escala&quot;, &quot;Criativos&quot;, &quot;Financeiro&quot;).
            </p>
            <input
              type="text"
              value={newViewInput}
              onChange={(e) => setNewViewInput(e.target.value)}
              placeholder="Nome da visualização..."
              className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewViewModalOpen(false)}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newViewInput.trim() || saving}
                onClick={async () => {
                  await handleSavePreferences(newViewInput.trim());
                  setNewViewModalOpen(false);
                }}
                className="btn-pressable px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-50"
              >
                Salvar visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: MODELOS DE MÉTRICAS (SEÇÃO 6) ==================== */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Modelos de Métricas e Metas
                </h3>
                <p className="text-xs text-zinc-400">
                  Aplique modelos prontos ou salve seus próprios presets reutilizáveis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTemplatesOpen(false);
                  setBulkTemplate(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkTemplate ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#1d74ff]/35 bg-[#1d74ff]/10 p-3.5 text-xs text-sky-100">
                  Aplicando modelo <strong>{bulkTemplate.name}</strong> em múltiplas campanhas de{" "}
                  <strong>{dashboardName}</strong>.
                </div>

                {campaignOptions.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    Nenhuma campanha cadastrada nesta operação ainda.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {campaignOptions.map((c) => {
                      const checked = bulkSelectedKeys.includes(c.key);
                      const hasOwn = existingConfiguredCampaignKeys.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl border border-white/10 bg-[#08080a] cursor-pointer text-xs"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setBulkSelectedKeys((prev) =>
                                  e.target.checked
                                    ? [...prev, c.key]
                                    : prev.filter((k) => k !== c.key)
                                )
                              }
                              className="accent-white"
                            />
                            <span className="text-white truncate">{c.campaignName}</span>
                          </span>
                          {hasOwn && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0">
                              Já personalizada
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkOverwrite}
                    onChange={(e) => setBulkOverwrite(e.target.checked)}
                    className="accent-white mt-0.5"
                  />
                  <span>
                    Confirmar sobrescrita de campanhas que já possuem metas personalizadas (se desmarcado, campanhas já configuradas serão preservadas).
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setBulkTemplate(null)}
                    className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={bulkSelectedKeys.length === 0 || saving}
                    onClick={handleConfirmBulkApply}
                    className="btn-pressable px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40"
                  >
                    {saving
                      ? "Aplicando..."
                      : `Aplicar em ${bulkSelectedKeys.length} campanha(s)`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="rounded-xl border border-white/10 bg-[#08080a] p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {tpl.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] border border-white/10 bg-white/[0.04] text-zinc-400">
                            {tpl.isBuiltIn ? "Dashfy" : "Meu modelo"}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          {tpl.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tpl.selectedMetrics.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] text-zinc-300"
                            >
                              {METRIC_DEFINITIONS[m]?.shortLabel || m}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => handleApplyTemplateHere(tpl)}
                          className="btn-pressable flex-1 py-1.5 px-2.5 rounded-lg bg-white text-black text-[11px] font-semibold"
                        >
                          Aplicar nesta campanha
                        </button>
                        {campaignOptions.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBulkTemplate(tpl);
                              setBulkSelectedKeys(campaignOptions.map((c) => c.key));
                              setBulkOverwrite(false);
                            }}
                            className="btn-pressable py-1.5 px-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] text-zinc-200"
                          >
                            Várias campanhas
                          </button>
                        )}
                        {!tpl.isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomTemplate(tpl.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400"
                            title="Excluir modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Salvar configuração atual como modelo personalizado */}
                <form
                  onSubmit={handleCreateCustomTemplate}
                  className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-3"
                >
                  <div className="text-xs font-semibold text-white">
                    Salvar configuração atual como novo modelo pessoal
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Ex.: Minha Escala High Ticket"
                      className="rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={newTemplateDesc}
                      onChange={(e) => setNewTemplateDesc(e.target.value)}
                      placeholder="Descrição curta (opcional)"
                      className="rounded-xl border border-white/10 bg-[#050507] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newTemplateName.trim() || saving}
                    className="btn-pressable px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-40"
                  >
                    Salvar modelo personalizado
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: CONFIGURAÇÃO DE ALERTAS INTELIGENTES ==================== */}
      {alertsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0c0c0e] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Configurar Alertas Inteligentes de Metas
                </h3>
                <p className="text-xs text-zinc-400">
                  Evite alertas falsos com limites mínimos de dados e intervalo de repetição (cooldown).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(
                [
                  { key: "enabled", label: "Ativar alertas inteligentes nesta campanha" },
                  { key: "alertOnCpaAbove", label: "Alertar quando o CPA ultrapassar o limite máximo" },
                  { key: "alertOnRoasBelow", label: "Alertar quando o ROAS cair abaixo da meta" },
                  { key: "alertOnCtrDrop", label: "Alertar quando o CTR cair significativamente" },
                  { key: "alertOnNegativeProfit", label: "Alertar quando o lucro estimado ficar negativo" },
                  { key: "alertOnGoalAchieved", label: "Celebrar quando uma meta importante for atingida" },
                  {
                    key: "alertOnSpendWithoutPurchases",
                    label: "Alertar quando gastar sem gerar compras atribuídas",
                  },
                ] as Array<{ key: keyof MetricAlertSettings; label: string }>
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#08080a] cursor-pointer text-xs text-zinc-200"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(alertSettings[item.key])}
                    onChange={(e) => {
                      setAlertSettings((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-4 h-4 accent-white"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Gasto mín. p/ alertar (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  value={alertSettings.minSpendForAlerts}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      minSpendForAlerts: Number(e.target.value || 0),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Cliques mín. p/ CTR
                </label>
                <input
                  type="number"
                  min={0}
                  value={alertSettings.minClicksForAlerts}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      minClicksForAlerts: Number(e.target.value || 0),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Compras mín. p/ CPA
                </label>
                <input
                  type="number"
                  min={0}
                  value={alertSettings.minConversionsForAlerts}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      minConversionsForAlerts: Number(e.target.value || 0),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Queda mín. CTR (%)
                </label>
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={alertSettings.ctrDropThresholdPct}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      ctrDropThresholdPct: Number(e.target.value || 20),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Gasto sem compras (R$)
                </label>
                <input
                  type="number"
                  min={1}
                  value={alertSettings.spendWithoutPurchasesThreshold}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      spendWithoutPurchasesThreshold: Number(e.target.value || 60),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Intervalo cooldown (h)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={alertSettings.cooldownHours}
                  onChange={(e) => {
                    setAlertSettings((prev) => ({
                      ...prev,
                      cooldownHours: Number(e.target.value || 12),
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#08080a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAlertsModalOpen(false)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await handleSavePreferences();
                  setAlertsModalOpen(false);
                }}
                className="btn-pressable px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-50"
              >
                Salvar alertas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
