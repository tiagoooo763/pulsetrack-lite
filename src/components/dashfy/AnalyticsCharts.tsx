"use client";

import React, { useMemo, useState } from "react";
import { Activity, BarChart3, PieChart } from "lucide-react";
import type { DailySeriesPoint } from "@/lib/dashfy-metrics";
import { formatBRL, formatDateBR } from "@/lib/format";

interface RevenueTrendChartProps {
  series: DailySeriesPoint[];
  title: string;
  subtitle: string;
  revenueLabel?: string;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${midX} ${p0.y.toFixed(1)}, ${midX} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export function RevenueTrendChart({
  series,
  title,
  subtitle,
  revenueLabel = "Faturamento",
}: RevenueTrendChartProps) {
  const [chartType, setChartType] = useState<"area" | "bars">("area");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    const max = Math.max(
      1,
      ...series.map((d) =>
        Math.max(d.grossRevenue, d.expenses, Math.max(0, d.profit))
      )
    );
    return max * 1.12;
  }, [series]);

  const W = 680;
  const H = 220;
  const padL = 14;
  const padR = 14;
  const padT = 18;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const points = useMemo(() => {
    if (series.length === 0) return [];
    return series.map((d, i) => {
      const ratio = series.length === 1 ? 0.5 : i / (series.length - 1);
      const x = padL + ratio * plotW;
      const yRev = padT + plotH - (Math.max(0, d.grossRevenue) / maxVal) * plotH;
      const yProfit = padT + plotH - (Math.max(0, d.profit) / maxVal) * plotH;
      const yExp = padT + plotH - (Math.max(0, d.expenses) / maxVal) * plotH;
      return { x, yRev, yProfit, yExp, day: d };
    });
  }, [series, maxVal, plotW, plotH]);

  const revLine = useMemo(
    () => buildSmoothPath(points.map((p) => ({ x: p.x, y: p.yRev }))),
    [points]
  );
  const profitLine = useMemo(
    () => buildSmoothPath(points.map((p) => ({ x: p.x, y: p.yProfit }))),
    [points]
  );
  const expLine = useMemo(
    () => buildSmoothPath(points.map((p) => ({ x: p.x, y: p.yExp }))),
    [points]
  );

  const revArea = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      const p = points[0];
      return `M ${padL} ${padT + plotH} L ${p.x} ${p.yRev} L ${W - padR} ${padT + plotH} Z`;
    }
    return `${revLine} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  }, [points, revLine, plotH]);

  const profitArea = useMemo(() => {
    if (points.length < 2) return "";
    return `${profitLine} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
  }, [points, profitLine, plotH]);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#5ea1ff]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1d74ff] ring-2 ring-[#3b8bff]/30" />
              {revenueLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Lucro
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              Despesas
            </span>
          </div>

          <div className="inline-flex items-center rounded-xl border border-blue-200/12 bg-[#050b18] p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setChartType("area")}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                chartType === "area"
                  ? "bg-[#1d74ff] text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Curva
            </button>
            <button
              type="button"
              onClick={() => setChartType("bars")}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                chartType === "bars"
                  ? "bg-[#1d74ff] text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Barras
            </button>
          </div>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200/15 bg-[#050b18]/60 text-xs text-slate-400">
          <BarChart3 className="w-6 h-6 text-[#5ea1ff]/50 mb-2" />
          <span>Sem movimentações registradas no período selecionado.</span>
        </div>
      ) : chartType === "area" ? (
        <div className="relative rounded-2xl bg-[#050b18] border border-blue-200/10 p-3.5 sm:p-4">
          {activePoint && (
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#3b8bff]/25 bg-[#0a1529] px-3.5 py-2 text-[11px]">
              <span className="tabular-nums font-semibold text-white">
                {formatDateBR(activePoint.day.date)}
              </span>
              <div className="flex flex-wrap items-center gap-3 tabular-nums">
                <span className="text-sky-300 font-medium">
                  Rec: {formatBRL(activePoint.day.grossRevenue)}
                </span>
                <span className="text-slate-400">
                  Desp: {formatBRL(activePoint.day.expenses)}
                </span>
                <span
                  className={
                    activePoint.day.profit >= 0
                      ? "text-emerald-400 font-semibold"
                      : "text-rose-400 font-semibold"
                  }
                >
                  Lucro: {formatBRL(activePoint.day.profit)}
                </span>
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-52 sm:h-56 overflow-visible"
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="dashfyRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b8bff" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#3b8bff" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="dashfyProfitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Linhas de grade horizontais */}
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = padT + plotH * step;
              return (
                <line
                  key={step}
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 4"
                />
              );
            })}

            {/* Áreas preenchidas */}
            {revArea && <path d={revArea} fill="url(#dashfyRevGrad)" />}
            {profitArea && <path d={profitArea} fill="url(#dashfyProfitGrad)" />}

            {/* Linha de Despesas (tracejada) */}
            {expLine && (
              <path
                d={expLine}
                fill="none"
                stroke="#71717a"
                strokeWidth="1.75"
                strokeDasharray="4 4"
              />
            )}

            {/* Linha de Lucro */}
            {profitLine && (
              <path
                d={profitLine}
                fill="none"
                stroke="#34d399"
                strokeWidth="2.25"
                strokeLinecap="round"
              />
            )}

            {/* Linha Principal de Receita */}
            {revLine && (
              <path
                d={revLine}
                fill="none"
                stroke="#3b8bff"
                strokeWidth="2.75"
                strokeLinecap="round"
              />
            )}

            {/* Linha guia vertical no hover */}
            {activePoint && (
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={padT}
                y2={padT + plotH}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="3 3"
              />
            )}

            {/* Pontos interativos e rótulos de data */}
            {points.map((p, idx) => {
              const isActive = hoveredIdx === idx;
              const showLabel =
                points.length <= 7 ||
                idx === 0 ||
                idx === points.length - 1 ||
                idx % Math.ceil(points.length / 6) === 0;
              return (
                <g
                  key={p.day.date}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  className="cursor-pointer"
                >
                  <rect
                    x={p.x - Math.max(14, plotW / Math.max(points.length, 2) / 2)}
                    y={padT}
                    width={Math.max(28, plotW / Math.max(points.length, 1))}
                    height={plotH + padB}
                    fill="transparent"
                  />
                  <circle
                    cx={p.x}
                    cy={p.yRev}
                    r={isActive ? 5.5 : 3}
                    fill="#3b8bff"
                    stroke="#070a12"
                    strokeWidth="2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.yProfit}
                    r={isActive ? 4.5 : 2.4}
                    fill="#34d399"
                    stroke="#070a12"
                    strokeWidth="1.5"
                  />
                  {showLabel && (
                    <text
                      x={p.x}
                      y={H - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isActive ? "#ffffff" : "#71717a"}
                      fontFamily="var(--font-mono), monospace"
                    >
                      {p.day.date.slice(8, 10)}/{p.day.date.slice(5, 7)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="relative h-60 w-full flex items-end gap-2 pt-8 pb-6 px-3.5 rounded-2xl bg-[#050b18] border border-blue-200/10">
          {series.map((day, idx) => {
            const revH = Math.max(4, (day.grossRevenue / maxVal) * 100);
            const profH = Math.max(
              day.profit > 0 ? 4 : 0,
              (Math.max(0, day.profit) / maxVal) * 100
            );
            const expH = Math.max(
              day.expenses > 0 ? 4 : 0,
              (day.expenses / maxVal) * 100
            );
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer"
              >
                {isHovered && (
                  <div className="absolute -top-2 z-20 -translate-y-full w-44 rounded-xl border border-[#3b8bff]/30 bg-[#0a1529] p-2.5 shadow-xl text-[11px] pointer-events-none">
                    <div className="tabular-nums font-semibold text-white mb-1">
                      {formatDateBR(day.date)}
                    </div>
                    <div className="flex justify-between text-sky-300">
                      <span>{revenueLabel}:</span>
                      <span className="tabular-nums">{formatBRL(day.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Despesas:</span>
                      <span className="tabular-nums">{formatBRL(day.expenses)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 mt-1 border-t border-blue-200/10">
                      <span className="text-slate-200">Lucro:</span>
                      <span
                        className={`tabular-nums ${
                          day.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatBRL(day.profit)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="w-full h-full flex items-end justify-center gap-1 px-0.5">
                  <div
                    className="w-1/3 max-w-[14px] rounded-t-md bg-gradient-to-t from-[#1d74ff]/85 to-[#5ea1ff] transition-all duration-300"
                    style={{ height: `${revH}%` }}
                  />
                  {day.profit > 0 && (
                    <div
                      className="w-1/3 max-w-[14px] rounded-t-md bg-gradient-to-t from-emerald-600/80 to-emerald-400 transition-all duration-300"
                      style={{ height: `${profH}%` }}
                    />
                  )}
                  {day.expenses > 0 && (
                    <div
                      className="w-1/3 max-w-[10px] rounded-t-md bg-slate-600/90 transition-all duration-300"
                      style={{ height: `${expH}%` }}
                    />
                  )}
                </div>

                <span className="absolute -bottom-5 text-[10px] tabular-nums text-slate-500 group-hover:text-slate-200 whitespace-nowrap">
                  {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FinancialBreakdownDonutProps {
  profit: number;
  adExpenses: number;
  fees: number;
  otherExpenses: number;
  marginPct: number;
}

export function FinancialBreakdownDonut({
  profit,
  adExpenses,
  fees,
  otherExpenses,
  marginPct,
}: FinancialBreakdownDonutProps) {
  const segments = useMemo(() => {
    const raw = [
      { label: "Lucro Líquido", value: Math.max(0, profit), color: "#34d399" },
      { label: "Mídia / Anúncios", value: Math.max(0, adExpenses), color: "#3b8bff" },
      { label: "Taxas", value: Math.max(0, fees), color: "#f59e0b" },
      { label: "Outras Despesas", value: Math.max(0, otherExpenses), color: "#71717a" },
    ];
    const total = raw.reduce((acc, s) => acc + s.value, 0);
    return { items: raw, total };
  }, [profit, adExpenses, fees, otherExpenses]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#5ea1ff]" />
            <span>Composição Financeira</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Distribuição de lucro, mídia paga, taxas e custos
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-36 h-36 shrink-0">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="rgba(147, 197, 253, 0.1)"
              strokeWidth="14"
            />
            {segments.total > 0 &&
              segments.items.map((seg) => {
                if (seg.value <= 0) return null;
                const frac = seg.value / segments.total;
                const dash = frac * circumference;
                const dashOffset = -offsetAcc;
                offsetAcc += dash;
                return (
                  <circle
                    key={seg.label}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Margem
            </span>
            <span
              className={`dashfy-kpi-value text-lg font-bold ${
                marginPct > 0
                  ? "text-emerald-400"
                  : marginPct < 0
                    ? "text-rose-400"
                    : "text-slate-200"
              }`}
            >
              {marginPct.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5">
          {segments.items.map((seg) => {
            const pct = segments.total > 0 ? (seg.value / segments.total) * 100 : 0;
            return (
              <div key={seg.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-2 text-slate-300 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-white shrink-0">
                    {formatBRL(seg.value)}{" "}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#050b18] border border-blue-200/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(seg.value > 0 ? 3 : 0, pct)}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
