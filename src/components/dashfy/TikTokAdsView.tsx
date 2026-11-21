"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { TikTokCampaignRecord } from "@/lib/db";
import {
  downloadCsvFile,
  getTodayLocalDate,
  parseTikTokCsv,
  type ParsedTikTokCsvRow,
} from "@/lib/dashfy-metrics";
import { formatBRL, formatDateBR } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface TikTokAdsViewProps {
  campaigns: TikTokCampaignRecord[];
  onRefresh: () => Promise<void>;
}

type HierarchyLevel = "campaigns" | "adgroups" | "ads";

interface AggregatedRow {
  key: string;
  name: string;
  subLabel: string;
  adAccount: string;
  status: "ACTIVE" | "PAUSED";
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  rawId?: string;
  statDate?: string;
}

export function TikTokAdsView({ campaigns, onRefresh }: TikTokAdsViewProps) {
  const [level, setLevel] = useState<HierarchyLevel>("campaigns");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">("ALL");

  // Modal de Cadastro Manual
  const [manualOpen, setManualOpen] = useState(false);
  const [formAdAccount, setFormAdAccount] = useState("Conta Principal TikTok");
  const [formCampaign, setFormCampaign] = useState("");
  const [formAdgroup, setFormAdgroup] = useState("");
  const [formAd, setFormAd] = useState("");
  const [formProduct, setFormProduct] = useState("Produto Principal");
  const [formDate, setFormDate] = useState(() => getTodayLocalDate());
  const [formSpend, setFormSpend] = useState("");
  const [formImpressions, setFormImpressions] = useState("");
  const [formClicks, setFormClicks] = useState("");
  const [formConversions, setFormConversions] = useState("");
  const [formRevenue, setFormRevenue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Importação CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<ParsedTikTokCsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const aggregatedRows = useMemo<AggregatedRow[]>(() => {
    const filtered = campaigns.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.campaignName.toLowerCase().includes(q) ||
        c.adgroupName.toLowerCase().includes(q) ||
        c.adName.toLowerCase().includes(q) ||
        c.adAccount.toLowerCase().includes(q) ||
        c.productName.toLowerCase().includes(q)
      );
    });

    if (level === "ads") {
      return filtered.map((c) => ({
        key: c.id,
        name: c.adName,
        subLabel: `${c.campaignName} • ${c.adgroupName}`,
        adAccount: c.adAccount,
        status: c.status,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        attributedRevenue: c.attributedRevenue,
        rawId: c.id,
        statDate: c.statDate,
      }));
    }

    const map = new Map<string, AggregatedRow>();
    for (const c of filtered) {
      const key =
        level === "campaigns"
          ? `${c.adAccount}::${c.campaignName}`
          : `${c.adAccount}::${c.campaignName}::${c.adgroupName}`;
      const existing = map.get(key) || {
        key,
        name: level === "campaigns" ? c.campaignName : c.adgroupName,
        subLabel: level === "campaigns" ? c.productName : c.campaignName,
        adAccount: c.adAccount,
        status: c.status,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        attributedRevenue: 0,
      };
      existing.spend += c.spend;
      existing.impressions += c.impressions;
      existing.clicks += c.clicks;
      existing.conversions += c.conversions;
      existing.attributedRevenue += c.attributedRevenue;
      if (c.status === "ACTIVE") existing.status = "ACTIVE";
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [campaigns, level, search, statusFilter]);

  const totals = useMemo(() => {
    const spend = aggregatedRows.reduce((a, r) => a + r.spend, 0);
    const impressions = aggregatedRows.reduce((a, r) => a + r.impressions, 0);
    const clicks = aggregatedRows.reduce((a, r) => a + r.clicks, 0);
    const conversions = aggregatedRows.reduce((a, r) => a + r.conversions, 0);
    const revenue = aggregatedRows.reduce((a, r) => a + r.attributedRevenue, 0);
    const profit = revenue - spend;
    return {
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
      profit,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      roas: spend > 0 ? revenue / spend : 0,
    };
  }, [aggregatedRows]);

  function handleDownloadTemplate() {
    downloadCsvFile(
      "modelo-dashfy-tiktok-ads.csv",
      [
        "Data",
        "Conta",
        "Campanha",
        "Conjunto",
        "Anuncio",
        "Produto",
        "Investimento",
        "Impressoes",
        "Cliques",
        "Conversoes",
        "Receita",
        "Status",
      ],
      [
        [
          getTodayLocalDate(),
          "Conta Principal TikTok",
          "[TT] Escala - Produto A",
          "Conjunto Aberto 18-45",
          "Criativo UGC 01",
          "Produto A",
          "250,00",
          "18400",
          "412",
          "9",
          "891,00",
          "ACTIVE",
        ],
        [
          getTodayLocalDate(),
          "Conta Principal TikTok",
          "[TT] Remarketing 7D",
          "Conjunto Visitantes Checkout",
          "Criativo Prova Social 02",
          "Produto A",
          "85,50",
          "6200",
          "175",
          "4",
          "396,00",
          "ACTIVE",
        ],
      ]
    );
  }

  function handleCsvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseTikTokCsv(text);
      if (parsed.length === 0) {
        setNotice(
          "Não encontramos linhas válidas no CSV. Baixe o modelo padrão para conferir as colunas."
        );
      } else {
        setCsvPreview(parsed);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function handleConfirmCsvImport() {
    if (!csvPreview || csvPreview.length === 0) return;
    setImportingCsv(true);
    try {
      const res = await fetch("/api/tiktok/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvPreview }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNotice(json.error || "Falha ao importar CSV.");
      } else {
        setNotice(`${json.importedCount} registros importados para a Operação TikTok.`);
        setCsvPreview(null);
        await onRefresh();
      }
    } catch {
      setNotice("Erro de comunicação ao importar arquivo CSV.");
    } finally {
      setImportingCsv(false);
    }
  }

  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formCampaign.trim()) {
      setFormError("Informe o nome da campanha.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tiktok/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccount: formAdAccount,
          campaignName: formCampaign,
          adgroupName: formAdgroup || "Conjunto Principal",
          adName: formAd || "Anúncio 01",
          productName: formProduct || "Produto Principal",
          statDate: formDate || getTodayLocalDate(),
          spend: formSpend || 0,
          impressions: formImpressions || 0,
          clicks: formClicks || 0,
          conversions: formConversions || 0,
          attributedRevenue: formRevenue || 0,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFormError(json.error || "Erro ao cadastrar campanha.");
      } else {
        setManualOpen(false);
        setFormCampaign("");
        setFormAdgroup("");
        setFormAd("");
        setFormSpend("");
        setFormImpressions("");
        setFormClicks("");
        setFormConversions("");
        setFormRevenue("");
        setNotice("Campanha cadastrada na Operação TikTok.");
        await onRefresh();
      }
    } catch {
      setFormError("Erro de rede ao salvar campanha.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(id: string, current: "ACTIVE" | "PAUSED") {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch("/api/tiktok/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    await onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tiktok/campaigns?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-xl border border-[#1a86ff]/40 bg-[#1a86ff]/10 p-3 text-xs text-blue-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#38bdf8]" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Aviso transparente sobre separação Receita Atribuída vs Lucro Estimado */}
      <SpotlightCard className="p-4 sm:p-5 bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Gerenciador de Performance — TikTok Ads
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Importe dados via CSV do TikTok Ads Manager ou cadastre manualmente.{" "}
            <strong className="text-[#38bdf8]">Receita Atribuída</strong> e{" "}
            <strong className="text-emerald-400">Lucro Estimado</strong> são calculados de forma independente da OmegaPay.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700/80 bg-[#080f1e] hover:border-slate-500 text-xs font-medium text-slate-200"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Modelo CSV</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#1a86ff]/40 bg-[#1a86ff]/15 hover:bg-[#1a86ff]/25 text-xs font-semibold text-[#60a5fa]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-xs font-semibold text-white shadow-md shadow-[#1a86ff]/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Campanha</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Abas de Nível Hierárquico (Campanhas / Conjuntos / Anúncios) + Busca */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#080f1e] border border-slate-800 self-start">
            {(
              [
                { id: "campaigns", label: "Campanhas" },
                { id: "adgroups", label: "Conjuntos" },
                { id: "ads", label: "Anúncios" },
              ] as Array<{ id: HierarchyLevel; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLevel(tab.id)}
                className={`btn-pressable px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  level === tab.id
                    ? "bg-[#1a86ff] text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar campanha, conjunto ou anúncio..."
                className="rounded-xl border border-slate-800 bg-[#080f1e] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#1a86ff] focus:outline-none w-60"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "PAUSED")}
              className="rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-1.5 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
            >
              <option value="ALL">Todos status</option>
              <option value="ACTIVE">Ativas</option>
              <option value="PAUSED">Pausadas</option>
            </select>
          </div>
        </div>

        {/* Tabela de Performance */}
        {aggregatedRows.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-800 bg-[#080f1e]/50 space-y-2">
            <FileSpreadsheet className="w-7 h-7 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              Nenhuma campanha ou anúncio registrado na Operação TikTok.
            </p>
            <p className="text-[11px] text-slate-500">
              Clique em <strong>Importar CSV</strong> ou <strong>Adicionar Campanha</strong> acima para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/90">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#080f1e] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">
                    {level === "campaigns"
                      ? "Campanha"
                      : level === "adgroups"
                        ? "Conjunto de Anúncios"
                        : "Anúncio / Criativo"}
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Investimento</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Impressões</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cliques</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CPC</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CPM</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Conv.</th>
                  <th className="py-2.5 px-3 font-semibold text-right text-[#38bdf8]">
                    Receita Atrib.
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">ROAS</th>
                  <th className="py-2.5 px-3 font-semibold text-right text-emerald-400">
                    Lucro Est.
                  </th>
                  {level === "ads" && (
                    <th className="py-2.5 px-3 font-semibold text-center">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0c1425]">
                {aggregatedRows.map((row) => {
                  const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
                  const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
                  const roas = row.spend > 0 ? row.attributedRevenue / row.spend : 0;
                  const profit = row.attributedRevenue - row.spend;
                  return (
                    <tr key={row.key} className="hover:bg-slate-800/35 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-white max-w-[230px] truncate">
                          {row.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[230px]">
                          {row.subLabel}
                          {row.statDate ? ` • ${formatDateBR(row.statDate)}` : ""}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            row.status === "ACTIVE"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-700 bg-slate-800/70 text-slate-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.status === "ACTIVE" ? "bg-emerald-400" : "bg-slate-500"
                            }`}
                          />
                          {row.status === "ACTIVE" ? "Ativa" : "Pausada"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                        {formatBRL(row.spend)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {row.impressions.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {row.clicks.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {formatBRL(cpc)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {formatBRL(cpm)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                        {row.conversions}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#38bdf8] font-semibold whitespace-nowrap">
                        {formatBRL(row.attributedRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200 whitespace-nowrap">
                        {row.spend > 0 ? `${roas.toFixed(2)}x` : "—"}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                          profit > 0
                            ? "text-emerald-400"
                            : profit < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                        }`}
                      >
                        {formatBRL(profit)}
                      </td>
                      {level === "ads" && row.rawId && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(row.rawId!, row.status)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                              title={row.status === "ACTIVE" ? "Marcar como pausada" : "Marcar como ativa"}
                            >
                              {row.status === "ACTIVE" ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.rawId!)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10"
                              title="Excluir registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-[#080f1e] font-semibold text-white">
                  <td className="py-2.5 px-3">Total ({aggregatedRows.length})</td>
                  <td />
                  <td className="py-2.5 px-3 text-right font-mono">{formatBRL(totals.spend)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {totals.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {totals.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatBRL(totals.cpc)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatBRL(totals.cpm)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{totals.conversions}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#38bdf8]">
                    {formatBRL(totals.revenue)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {totals.spend > 0 ? `${totals.roas.toFixed(2)}x` : "—"}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      totals.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatBRL(totals.profit)}
                  </td>
                  {level === "ads" && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SpotlightCard>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO CSV */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0f172a] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Confirmar Importação CSV — TikTok Ads
                </h3>
                <p className="text-xs text-slate-400">
                  Arquivo: <span className="font-mono text-slate-200">{csvFileName}</span> ({csvPreview.length} linhas detectadas)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCsvPreview(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#080f1e] text-slate-400 uppercase">
                  <tr>
                    <th className="p-2">Data</th>
                    <th className="p-2">Campanha</th>
                    <th className="p-2">Anúncio</th>
                    <th className="p-2 text-right">Invest.</th>
                    <th className="p-2 text-right">Conv.</th>
                    <th className="p-2 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {csvPreview.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td className="p-2 font-mono text-slate-400">{r.statDate}</td>
                      <td className="p-2 text-white truncate max-w-[160px]">{r.campaignName}</td>
                      <td className="p-2 text-slate-300 truncate max-w-[120px]">{r.adName}</td>
                      <td className="p-2 text-right font-mono">{formatBRL(r.spend)}</td>
                      <td className="p-2 text-right font-mono">{r.conversions}</td>
                      <td className="p-2 text-right font-mono text-[#38bdf8]">
                        {formatBRL(r.attributedRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCsvPreview(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCsvImport}
                disabled={importingCsv}
                className="btn-pressable px-4 py-2 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-white text-xs font-semibold disabled:opacity-50"
              >
                {importingCsv
                  ? "Importando..."
                  : `Importar ${csvPreview.length} Registros`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO MANUAL */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0f172a] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Novo Registro de Campanha TikTok Ads
                </h3>
                <p className="text-xs text-slate-400">
                  Dados salvos exclusivamente na Operação TikTok
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateManual} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Conta de Anúncio</label>
                  <input
                    type="text"
                    value={formAdAccount}
                    onChange={(e) => setFormAdAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Nome da Campanha *</label>
                <input
                  type="text"
                  required
                  value={formCampaign}
                  onChange={(e) => setFormCampaign(e.target.value)}
                  placeholder="Ex: [TT] CBO Escala Produto X"
                  className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Conjunto (Ad Group)</label>
                  <input
                    type="text"
                    value={formAdgroup}
                    onChange={(e) => setFormAdgroup(e.target.value)}
                    placeholder="Ex: Aberto 25-44"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Anúncio (Criativo)</label>
                  <input
                    type="text"
                    value={formAd}
                    onChange={(e) => setFormAd(e.target.value)}
                    placeholder="Ex: UGC Hook 03"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Produto Associado</label>
                <input
                  type="text"
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white focus:border-[#1a86ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Investimento (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    placeholder="150,00"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Impressões</label>
                  <input
                    type="number"
                    min={0}
                    value={formImpressions}
                    onChange={(e) => setFormImpressions(e.target.value)}
                    placeholder="12000"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Cliques</label>
                  <input
                    type="number"
                    min={0}
                    value={formClicks}
                    onChange={(e) => setFormClicks(e.target.value)}
                    placeholder="320"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Conversões</label>
                  <input
                    type="number"
                    min={0}
                    value={formConversions}
                    onChange={(e) => setFormConversions(e.target.value)}
                    placeholder="8"
                    className="w-full rounded-xl border border-slate-800 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-[#38bdf8] font-medium mb-1">
                    Receita Atribuída (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formRevenue}
                    onChange={(e) => setFormRevenue(e.target.value)}
                    placeholder="690,00"
                    className="w-full rounded-xl border border-[#1a86ff]/40 bg-[#080f1e] px-3 py-2 text-xs text-white font-mono focus:border-[#1a86ff] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-pressable px-4 py-2 rounded-xl bg-[#1a86ff] hover:bg-[#3194ff] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Salvando..." : "Salvar Campanha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
