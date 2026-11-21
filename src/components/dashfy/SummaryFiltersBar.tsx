"use client";

import React, { useState } from "react";
import { Calendar, Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import type {
  DashboardOperationId,
  PeriodPreset,
  SummaryFilterState,
} from "@/lib/dashfy-types";

interface SummaryFiltersBarProps {
  dashboardId: DashboardOperationId;
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
  { id: "month", label: "Este Mês" },
  { id: "all", label: "Todo Período" },
  { id: "custom", label: "Personalizado" },
];

export function SummaryFiltersBar({
  dashboardId,
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
    <div className="rounded-2xl border border-slate-800/90 bg-[#0f172a]/90 p-3.5 sm:p-4 space-y-3">
      {/* Linha 1: Período + Botão Mais Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
            <Calendar className="w-3.5 h-3.5 text-[#1a86ff]" />
            <span>Período:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-[#080f1e] border border-slate-800 rounded-xl p-1">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setField("period", p.id)}
                className={`btn-pressable px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filters.period === p.id
                    ? "bg-[#1a86ff] text-white font-semibold shadow-sm shadow-[#1a86ff]/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {filters.period === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.customFrom}
                onChange={(e) => setField("customFrom", e.target.value)}
                className="rounded-lg border border-slate-700/80 bg-[#080f1e] px-2.5 py-1 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
              />
              <span className="text-slate-500 text-xs">até</span>
              <input
                type="date"
                value={filters.customTo}
                onChange={(e) => setField("customTo", e.target.value)}
                className="rounded-lg border border-slate-700/80 bg-[#080f1e] px-2.5 py-1 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeExtraCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="btn-pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/50 text-xs text-slate-300 hover:text-white transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar ({activeExtraCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className={`btn-pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              showMore
                ? "border-[#1a86ff]/50 bg-[#1a86ff]/15 text-[#60a5fa]"
                : "border-slate-700/80 bg-[#080f1e] text-slate-300 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Mais filtros</span>
          </button>
        </div>
      </div>

      {/* Linha 2: Filtros horizontais principais (Conta, Campanha, Fonte, Produto, Plataforma) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1 border-t border-slate-800/70">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Conta de Anúncio
          </label>
          <select
            value={filters.adAccount}
            onChange={(e) => setField("adAccount", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
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
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Campanha
          </label>
          <select
            value={filters.campaign}
            onChange={(e) => setField("campaign", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
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
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Fonte de Tráfego
          </label>
          <select
            value={filters.trafficSource}
            onChange={(e) => setField("trafficSource", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
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
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Produto
          </label>
          <select
            value={filters.product}
            onChange={(e) => setField("product", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
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
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Plataforma
          </label>
          <select
            value={filters.platform}
            onChange={(e) => setField("platform", e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
          >
            <option value="ALL">
              {dashboardId === "tiktok" ? "TikTok Ads" : "OmegaPay"}
            </option>
            {options.platforms.map((pl) => (
              <option key={pl} value={pl}>
                {pl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 3 (Expansível): Mais filtros */}
      {showMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-800/70 animate-fade-in-up">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <span className="inline-flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#1a86ff]" />
                Status
              </span>
            </label>
            <select
              value={filters.status}
              onChange={(e) => setField("status", e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
            >
              <option value="ALL">Todos os status</option>
              {dashboardId === "tiktok" ? (
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

          {dashboardId === "omegapay" && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Método de Pagamento
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setField("paymentMethod", e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#1a86ff] focus:outline-none"
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
