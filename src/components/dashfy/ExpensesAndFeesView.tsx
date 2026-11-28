"use client";

import React, { useState } from "react";
import { CheckCircle2, Percent, Plus, Receipt, Trash2 } from "lucide-react";
import type {
  CustomFeeRecord,
  DashboardConfigRecord,
  DashboardOperationId,
  DashboardOperationMode,
  ExpenseCategory,
  FeeCategory,
  FeeType,
  ManualExpenseRecord,
} from "@/lib/db";
import { FEE_CATEGORIES } from "@/lib/dashfy-types";
import { getTodayLocalDate } from "@/lib/dashfy-metrics";
import { EXPENSE_CATEGORIES, formatBRL, formatDateBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface ExpensesViewProps {
  dashboards: DashboardConfigRecord[];
  dashboardId: DashboardOperationId;
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  expenses: ManualExpenseRecord[];
  campaignSuggestions: string[];
  onRefresh: () => Promise<void>;
}

export function ExpensesView({
  dashboards,
  dashboardId,
  dashboardMode,
  dashboardName,
  expenses,
  campaignSuggestions,
  onRefresh,
}: ExpensesViewProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>(
    dashboardMode === "tiktok" ? "TIKTOK_ADS" : "META_ADS"
  );
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => getTodayLocalDate());
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDashboard, setTargetDashboard] =
    useState<DashboardOperationId>(dashboardId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const num = Number(amount.trim().replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || EXPENSE_CATEGORIES[category].label,
          category,
          amount: num,
          expenseDate,
          campaignName: campaignName.trim() || null,
          notes: notes.trim() || null,
          dashboardId: targetDashboard,
          gateway: targetDashboard === "omegapay" ? "OMEGAPAY" : "ALL",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Erro ao registrar despesa.");
      } else {
        setTitle("");
        setAmount("");
        setCampaignName("");
        setNotes("");
        setSuccess("Despesa registrada e refletida no Resumo.");
        await onRefresh();
      }
    } catch {
      setError("Erro de rede ao salvar despesa.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-blue-200/12 flex items-center justify-center">
            <Receipt className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cadastrar Despesa</h3>
            <p className="text-xs text-slate-400">
              Impacta diretamente o Lucro e ROI do Resumo
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Nome da Despesa *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Criativos UGC / Tráfego Pago"
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-2.5 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Dashboard Relacionado</label>
              <select
                value={targetDashboard}
                onChange={(e) => setTargetDashboard(e.target.value)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-2.5 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              >
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Valor (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 150,00"
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Data *</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Campanha Associada (opcional)
            </label>
            <input
              type="text"
              list="dashfy-campaign-suggestions"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Vincular a uma campanha específica"
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
            <datalist id="dashfy-campaign-suggestions">
              {campaignSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white shadow-[0_8px_22px_-6px_rgba(29,116,255,0.52)] text-xs font-semibold disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{submitting ? "Salvando..." : "Salvar Despesa"}</span>
          </button>
        </form>
      </SpotlightCard>

      <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Despesas — {dashboardName}
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Total no período: <strong className="text-white">{formatBRL(totalAmount)}</strong>
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {expenses.length} lançamento(s)
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-blue-200/12 text-xs text-slate-400">
            Nenhuma despesa registrada para esta operação no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-200/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-200/12 bg-[#050b18] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">Nome / Obs.</th>
                  <th className="py-2.5 px-3 font-semibold">Categoria</th>
                  <th className="py-2.5 px-3 font-semibold">Campanha</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Valor</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#1d74ff]/[0.06]">
                    <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatDateBR(exp.expenseDate)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-white font-medium">{exp.title}</div>
                      {exp.notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          {exp.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] border border-blue-200/12 bg-white/[0.04] text-slate-300">
                        {EXPENSE_CATEGORIES[exp.category]?.label || exp.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {exp.campaignName || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white font-semibold whitespace-nowrap">
                      {formatBRL(exp.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(exp.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                        title="Excluir despesa"
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
  );
}

interface FeesViewProps {
  dashboards: DashboardConfigRecord[];
  dashboardId: DashboardOperationId;
  dashboardMode: DashboardOperationMode;
  dashboardName: string;
  fees: CustomFeeRecord[];
  checkoutFeesTotal?: number;
  revenueBase: number;
  campaignSuggestions: string[];
  onRefresh: () => Promise<void>;
}

export function FeesView({
  dashboards,
  dashboardId,
  dashboardMode,
  dashboardName,
  fees,
  checkoutFeesTotal = 0,
  revenueBase,
  campaignSuggestions,
  onRefresh,
}: FeesViewProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FeeCategory>("GATEWAY");
  const [feeType, setFeeType] = useState<FeeType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [feeDate, setFeeDate] = useState(() => getTodayLocalDate());
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDashboard, setTargetDashboard] =
    useState<DashboardOperationId>(dashboardId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const customFeesImpact = fees.reduce((acc, f) => {
    if (f.feeType === "PERCENTAGE") return acc + (revenueBase * f.value) / 100;
    return acc + f.value;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const num = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardId: targetDashboard,
          name: name.trim(),
          category,
          feeType,
          value: num,
          feeDate,
          campaignName: campaignName.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Erro ao registrar taxa.");
      } else {
        setName("");
        setValue("");
        setCampaignName("");
        setNotes("");
        setSuccess("Taxa cadastrada e aplicada automaticamente no Resumo.");
        await onRefresh();
      }
    } catch {
      setError("Erro de conexão ao salvar taxa.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/fees?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-blue-200/12 flex items-center justify-center">
            <Percent className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cadastrar Taxa / Imposto</h3>
            <p className="text-xs text-slate-400">
              Taxas fixas ou percentuais deduzidas do lucro
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Nome da Taxa *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Imposto Simples Nacional 6%"
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeeCategory)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-2.5 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              >
                {Object.entries(FEE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Dashboard</label>
              <select
                value={targetDashboard}
                onChange={(e) => setTargetDashboard(e.target.value)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-2.5 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              >
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Tipo</label>
              <select
                value={feeType}
                onChange={(e) => setFeeType(e.target.value as FeeType)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-2.5 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              >
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Valor Fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                {feeType === "PERCENTAGE" ? "Percentual (%) *" : "Valor (R$) *"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={feeType === "PERCENTAGE" ? "Ex: 6,0" : "Ex: 49,90"}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Data *</label>
              <input
                type="date"
                required
                value={feeDate}
                onChange={(e) => setFeeDate(e.target.value)}
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Campanha (opcional)</label>
              <input
                type="text"
                list="dashfy-fee-campaigns"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
              />
              <datalist id="dashfy-fee-campaigns">
                {campaignSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes da taxa..."
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white shadow-[0_8px_22px_-6px_rgba(29,116,255,0.52)] text-xs font-semibold disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{submitting ? "Salvando..." : "Salvar Taxa"}</span>
          </button>
        </form>
      </SpotlightCard>

      <SpotlightCard className="lg:col-span-2 p-5 sm:p-6 bento-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Taxas — {dashboardName}
            </h3>
            <p className="text-xs text-slate-400">
              Impacto calculado no período sobre base de {formatBRL(revenueBase)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            {dashboardMode === "omegapay" && (
              <span className="px-2.5 py-1 rounded-lg border border-blue-200/12 bg-[#050b18] text-slate-300">
                Checkout OmegaPay: <strong className="text-white">{formatBRL(checkoutFeesTotal)}</strong>
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg border border-blue-200/12 bg-white/5 text-slate-200">
              Taxas Cadastradas: <strong>{formatBRL(customFeesImpact)}</strong>
            </span>
          </div>
        </div>

        {fees.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-blue-200/12 text-xs text-slate-400">
            Nenhuma taxa adicional cadastrada nesta operação.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-200/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-200/12 bg-[#050b18] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">Nome</th>
                  <th className="py-2.5 px-3 font-semibold">Categoria</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Regra</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Impacto Est.</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                {fees.map((f) => {
                  const impact =
                    f.feeType === "PERCENTAGE"
                      ? (revenueBase * f.value) / 100
                      : f.value;
                  return (
                    <tr key={f.id} className="hover:bg-[#1d74ff]/[0.06]">
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {formatDateBR(f.feeDate)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-white font-medium">{f.name}</div>
                        {f.notes && (
                          <div className="text-[10px] text-slate-400">{f.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] border border-blue-200/12 bg-white/[0.04] text-slate-300">
                          {FEE_CATEGORIES[f.category]?.label || f.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {f.feeType === "PERCENTAGE"
                          ? `${f.value.toFixed(2)}%`
                          : formatBRL(f.value)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-semibold">
                        -{formatBRL(impact)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                          title="Excluir taxa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
