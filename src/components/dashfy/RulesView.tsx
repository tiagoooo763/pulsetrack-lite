"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Plus, ShieldCheck, Sliders, Trash2 } from "lucide-react";
import type { AutomationRuleRecord, TikTokCampaignRecord } from "@/lib/db";
import { SpotlightCard } from "@/components/SpotlightCard";

interface RulesViewProps {
  rules: AutomationRuleRecord[];
  campaigns: TikTokCampaignRecord[];
  onRefresh: () => Promise<void>;
}

const METRIC_LABELS: Record<AutomationRuleRecord["metric"], string> = {
  ROAS: "ROAS (x)",
  CPA: "CPA (R$)",
  CPC: "CPC (R$)",
  SPEND: "Investimento (R$)",
};

export function RulesView({ rules, campaigns, onRefresh }: RulesViewProps) {
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<AutomationRuleRecord["metric"]>("ROAS");
  const [operator, setOperator] = useState<AutomationRuleRecord["operator"]>("LT");
  const [threshold, setThreshold] = useState("1.5");
  const [actionLabel, setActionLabel] = useState("Sinalizar alerta para revisão");
  const [saving, setSaving] = useState(false);

  // Avalia regras ativas contra os dados reais importados do TikTok
  const ruleMatches = useMemo(() => {
    const campMap = new Map<
      string,
      { name: string; spend: number; clicks: number; conversions: number; revenue: number }
    >();
    for (const c of campaigns) {
      const cur = campMap.get(c.campaignName) || {
        name: c.campaignName,
        spend: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };
      cur.spend += c.spend;
      cur.clicks += c.clicks;
      cur.conversions += c.conversions;
      cur.revenue += c.attributedRevenue;
      campMap.set(c.campaignName, cur);
    }
    const grouped = Array.from(campMap.values());

    const result = new Map<string, string[]>();
    for (const r of rules) {
      if (!r.enabled) {
        result.set(r.id, []);
        continue;
      }
      const matched: string[] = [];
      for (const c of grouped) {
        const val =
          r.metric === "ROAS"
            ? c.spend > 0
              ? c.revenue / c.spend
              : 0
            : r.metric === "CPA"
              ? c.conversions > 0
                ? c.spend / c.conversions
                : c.spend
              : r.metric === "CPC"
                ? c.clicks > 0
                  ? c.spend / c.clicks
                  : 0
                : c.spend;

        const triggered =
          r.operator === "LT" ? val < r.threshold : val > r.threshold;
        if (triggered) matched.push(c.name);
      }
      result.set(r.id, matched);
    }
    return result;
  }, [rules, campaigns]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: "tiktok",
          name,
          metric,
          operator,
          threshold: Number(threshold.replace(",", ".")),
          actionLabel,
        }),
      });
      setName("");
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: AutomationRuleRecord) {
    await fetch("/api/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    });
    await onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Criar Nova Regra */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1a86ff]/15 border border-[#1a86ff]/30 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Nova Regra de Alerta</h3>
            <p className="text-xs text-slate-400">
              Monitora automaticamente suas campanhas TikTok importadas
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Nome da Regra *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alerta ROAS Baixo"
              className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Métrica</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as AutomationRuleRecord["metric"])}
                className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
              >
                <option value="ROAS">ROAS (x)</option>
                <option value="CPA">CPA (R$)</option>
                <option value="CPC">CPC (R$)</option>
                <option value="SPEND">Investimento (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Condição</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as AutomationRuleRecord["operator"])}
                className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-2.5 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
              >
                <option value="LT">Menor que (&lt;)</option>
                <option value="GT">Maior que (&gt;)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Valor Limite</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Ação / Recomendação</label>
            <input
              type="text"
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{saving ? "Salvando..." : "Criar Regra"}</span>
          </button>
        </form>
      </SpotlightCard>

      {/* Lista de Regras e Avaliação Real */}
      <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 bento-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Regras de Monitoramento ({rules.length})
          </h3>
          <p className="text-xs text-slate-400">
            Avaliação em tempo real sobre suas campanhas da Operação TikTok (sem ações automáticas externas não conectadas).
          </p>
        </div>

        {rules.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
            Nenhuma regra criada ainda. Crie sua primeira regra de monitoramento ao lado.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const matched = ruleMatches.get(rule.id) || [];
              return (
                <div
                  key={rule.id}
                  className="rounded-xl border border-slate-800 bg-[#080f1e] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{rule.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/70 text-slate-300">
                          {METRIC_LABELS[rule.metric]}{" "}
                          {rule.operator === "LT" ? "<" : ">"} {rule.threshold}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{rule.actionLabel}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                          rule.enabled
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-slate-700 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {rule.enabled ? "Ativa" : "Inativa"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                        title="Excluir regra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {rule.enabled && (
                    <div className="pt-2 border-t border-slate-800/80 text-[11px]">
                      {matched.length > 0 ? (
                        <div className="flex items-start gap-2 text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            Disparada em <strong>{matched.length}</strong> campanha(s):{" "}
                            {matched.join(", ")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Nenhuma campanha violando esta regra no momento.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
