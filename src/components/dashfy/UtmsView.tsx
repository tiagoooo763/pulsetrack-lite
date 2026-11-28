"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Copy, Link2 } from "lucide-react";
import type { TikTokCampaignRecord } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface UtmsViewProps {
  campaigns: TikTokCampaignRecord[];
}

export function UtmsView({ campaigns }: UtmsViewProps) {
  const [baseUrl, setBaseUrl] = useState("https://seusite.com.br/oferta");
  const [utmSource, setUtmSource] = useState("tiktok");
  const [utmMedium, setUtmMedium] = useState("cpc");
  const [utmCampaign, setUtmCampaign] = useState("__CAMPAIGN_NAME__");
  const [utmContent, setUtmContent] = useState("__CID_NAME__");
  const [utmTerm, setUtmTerm] = useState("__AID_NAME__");
  const [copied, setCopied] = useState(false);

  const builtUrl = useMemo(() => {
    const clean = baseUrl.trim() || "https://seusite.com.br";
    const sep = clean.includes("?") ? "&" : "?";
    const params = [
      `utm_source=${encodeURIComponent(utmSource)}`,
      `utm_medium=${encodeURIComponent(utmMedium)}`,
      `utm_campaign=${utmCampaign}`,
      `utm_content=${utmContent}`,
      `utm_term=${utmTerm}`,
    ].join("&");
    return `${clean}${sep}${params}`;
  }, [baseUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm]);

  const utmBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        source: string;
        medium: string;
        campaign: string;
        content: string;
        spend: number;
        clicks: number;
        conversions: number;
        revenue: number;
      }
    >();
    for (const c of campaigns) {
      const key = `${c.utmSource}|${c.utmMedium}|${c.utmCampaign || c.campaignName}|${c.utmContent || c.adName}`;
      const cur = map.get(key) || {
        source: c.utmSource || "tiktok",
        medium: c.utmMedium || "cpc",
        campaign: c.utmCampaign || c.campaignName,
        content: c.utmContent || c.adName,
        spend: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };
      cur.spend += c.spend;
      cur.clicks += c.clicks;
      cur.conversions += c.conversions;
      cur.revenue += c.attributedRevenue;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [campaigns]);

  function handleCopy() {
    navigator.clipboard.writeText(builtUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-5">
      {/* Construtor Real de UTMs para TikTok Ads */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-blue-200/12 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Gerador de Parâmetros UTM — TikTok Ads
            </h3>
            <p className="text-xs text-slate-400">
              Monte sua URL com macros dinâmicas oficiais do TikTok Ads Manager para rastrear campanhas e criativos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              URL de Destino (Página de Vendas / Checkout)
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              utm_source
            </label>
            <input
              type="text"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              utm_medium
            </label>
            <input
              type="text"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              utm_campaign
            </label>
            <input
              type="text"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              utm_content (Anúncio)
            </label>
            <input
              type="text"
              value={utmContent}
              onChange={(e) => setUtmContent(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              utm_term (Conjunto)
            </label>
            <input
              type="text"
              value={utmTerm}
              onChange={(e) => setUtmTerm(e.target.value)}
              className="w-full rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/12 bg-[#050b18] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <code className="text-[11px] font-mono text-white break-all">
            {builtUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-pressable inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white shadow-[0_8px_22px_-6px_rgba(29,116,255,0.52)] text-xs font-semibold shrink-0"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copiado!" : "Copiar URL"}</span>
          </button>
        </div>
      </SpotlightCard>

      {/* Tabela de Performance por UTM */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Performance por Parâmetros UTM
          </h3>
          <p className="text-xs text-slate-400">
            Atribuição consolidada das campanhas e criativos da Operação TikTok
          </p>
        </div>

        {utmBreakdown.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-blue-200/12 text-xs text-slate-400">
            Importe ou cadastre campanhas em <strong>TikTok Ads</strong> para visualizar a quebra por UTM.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-200/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-200/12 bg-[#050b18] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">utm_source / medium</th>
                  <th className="py-2.5 px-3 font-semibold">utm_campaign</th>
                  <th className="py-2.5 px-3 font-semibold">utm_content</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cliques</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Invest.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Conv.</th>
                  <th className="py-2.5 px-3 font-semibold text-right text-white">Receita</th>
                  <th className="py-2.5 px-3 font-semibold text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                {utmBreakdown.map((u, i) => {
                  const roas = u.spend > 0 ? u.revenue / u.spend : 0;
                  return (
                    <tr key={i} className="hover:bg-[#1d74ff]/[0.06]">
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {u.source} / {u.medium}
                      </td>
                      <td className="py-2.5 px-3 text-white font-medium max-w-[180px] truncate">
                        {u.campaign}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-[160px] truncate">
                        {u.content}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {u.clicks}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {formatBRL(u.spend)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white">
                        {u.conversions}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">
                        {formatBRL(u.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {u.spend > 0 ? `${roas.toFixed(2)}x` : "—"}
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
