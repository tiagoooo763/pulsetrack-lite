"use client";

import React, { useState } from "react";
import { Calendar, Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import type {
  DashboardOperationMode,
  PeriodPreset,
  SummaryFilterState,
} from "@/lib/dashfy-types";

interface SummaryFiltersBarProps {
  dashboardMode: DashboardOperationMode;
  filters: SummaryFilterState;
  onChange: (next: SummaryFilterState) => void;
  onReset: () => void;
  options: {
    adAccounts: string[];
    campaigns: string[];
    trafficSources: string[];
    products: string[];
    platforms: string[];
  };
}

const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "month", label: "Mês" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Custom" },
];

export function SummaryFiltersBar({
  dashboardMode,
  filters,
  onChange,
  onReset,
  options,
}: SummaryFiltersBarProps) {
  const [showMore, setShowMore] = useState(false);

  const activeExtraCount = [
    filters.adAccount !== "ALL",
    filters.campaign !== "ALL",
    filters.trafficSource !== "ALL",
    filters.product !== "ALL",
    filters.platform !== "ALL",
    filters.status !== "ALL",
    filters.paymentMethod !== "ALL",
  ].filter(Boolean).length;

  const setField = <K extends keyof SummaryFilterState>(
    key: K,
    value: SummaryFilterState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="dashfy-surface p-4 sm:p-5 space-y-4">
      {/* Linha 1: Período + Mais filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-[#5ea1ff]" />
            <span>Período:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-[#050b18] border border-blue-200/10 rounded-xl p-1 text-xs">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setField("period", p.id)}
                className={`btn-pressable px-3 py-1.5 rounded-lg transition-all ${
                  filters.period === p.id
                    ? "bg-[#1d74ff] text-white font-semibold shadow-[0_6px_16px_-5px_rgba(29,116,255,0.75)]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {filters.period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.customFrom}
                onChange={(e) => setField("customFrom", e.target.value)}
                className="dashfy-input h-9 px-2.5 text-xs"
              />
              <span className="text-slate-500 text-xs">até</span>
              <input
                type="date"
                value={filters.customTo}
                onChange={(e) => setField("customTo", e.target.value)}
                className="dashfy-input h-9 px-2.5 text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeExtraCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="btn-pressable dashfy-btn-secondary h-9 px-3 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#5ea1ff]" />
              <span>Limpar ({activeExtraCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className={`btn-pressable h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl border text-xs font-medium transition ${
              showMore
                ? "bg-[#1d74ff] text-white border-[#3b8bff] font-semibold shadow-[0_6px_16px_-5px_rgba(29,116,255,0.65)]"
                : "border-blue-200/15 bg-[#050b18] text-slate-300 hover:text-white hover:border-[#3b8bff]/40"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Mais filtros</span>
          </button>
        </div>
      </div>

      {/* Linha 2: Filtros horizontais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3.5 border-t border-blue-200/10">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
            Conta de Anúncio
          </label>
          <select
            value={filters.adAccount}
            onChange={(e) => setField("adAccount", e.target.value)}
            className="dashfy-input w-full h-9 px-3 text-xs"
          >
            <option value="ALL">Todas as contas</option>
            {options.adAccounts.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
            Campanha
          </label>
          <select
            value={filters.campaign}
            onChange={(e) => setField("campaign", e.target.value)}
            className="dashfy-input w-full h-9 px-3 text-xs"
          >
            <option value="ALL">Todas as campanhas</option>
            {options.campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
            Fonte de Tráfego
          </label>
          <select
            value={filters.trafficSource}
            onChange={(e) => setField("trafficSource", e.target.value)}
            className="dashfy-input w-full h-9 px-3 text-xs"
          >
            <option value="ALL">Todas as fontes</option>
            {options.trafficSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
            Produto
          </label>
          <select
            value={filters.product}
            onChange={(e) => setField("product", e.target.value)}
            className="dashfy-input w-full h-9 px-3 text-xs"
          >
            <option value="ALL">Todos os produtos</option>
            {options.products.map((prod) => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
            Plataforma
          </label>
          <select
            value={filters.platform}
            onChange={(e) => setField("platform", e.target.value)}
            className="dashfy-input w-full h-9 px-3 text-xs"
          >
            <option value="ALL">
              {dashboardMode === "tiktok" ? "TikTok Ads" : "OmegaPay"}
            </option>
            {options.platforms.map((pl) => (
              <option key={pl} value={pl}>
                {pl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 3: Mais filtros */}
      {showMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5 border-t border-blue-200/10 animate-fade-in-up">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-[#5ea1ff]" />
                Status
              </span>
            </label>
            <select
              value={filters.status}
              onChange={(e) => setField("status", e.target.value)}
              className="dashfy-input w-full h-9 px-3 text-xs"
            >
              <option value="ALL">Todos os status</option>
              {dashboardMode === "tiktok" ? (
                <>
                  <option value="ACTIVE">Ativas</option>
                  <option value="PAUSED">Pausadas</option>
                </>
              ) : (
                <>
                  <option value="COMPLETED">Aprovadas</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="REFUNDED">Reembolsadas</option>
                  <option value="CANCELED">Canceladas</option>
                  <option value="CHARGED_BACK">Chargeback</option>
                </>
              )}
            </select>
          </div>

          {dashboardMode === "omegapay" && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Método de Pagamento
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setField("paymentMethod", e.target.value)}
                className="dashfy-input w-full h-9 px-3 text-xs"
              >
                <option value="ALL">Todos os métodos</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="BOLETO">Boleto</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
