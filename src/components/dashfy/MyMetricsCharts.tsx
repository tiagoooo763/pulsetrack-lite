"use client";

import React, { useMemo, useState } from "react";
import {
  formatMetricValue,
  type MetricDailyPoint,
  type MetricEvalStatus,
  type MetricGoalConfig,
  type MetricUnit,
} from "@/lib/my-metrics";
import { formatDateBR } from "@/lib/format";

function getStatusStroke(status: MetricEvalStatus): string {
  switch (status) {
    case "on_target":
      return "#34d399";
    case "attention":
      return "#fbbf24";
    case "off_target":
      return "#fb7185";
    default:
      return "#71717a";
  }
}

interface MiniMetricSparklineProps {
  series: MetricDailyPoint[];
  status: MetricEvalStatus;
  goal?: MetricGoalConfig | null;
}

export function MiniMetricSparkline({
  series,
  status,
  goal,
}: MiniMetricSparklineProps) {
  const valid = useMemo(
    () => series.filter((p): p is { date: string; value: number } => p.value !== null && Number.isFinite(p.value)),
    [series]
  );

  if (valid.length < 2) {
    return (
      <div className="h-10 flex items-center justify-center rounded-lg border border-blue-200/10 bg-[#050b18]/80 text-[10px] text-slate-400">
        Histórico diário insuficiente
      </div>
    );
  }

  const stroke = getStatusStroke(status);
  const W = 200;
  const H = 40;
  const pad = 4;
  const targetVal =
    goal && goal.enabled && goal.goalType !== "growth_pct"
      ? goal.targetValue
      : null;

  const allVals = valid.map((v) => v.value);
  if (targetVal !== null) allVals.push(targetVal);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = maxV - minV || 1;

  const pts = valid.map((p, idx) => {
    const x = pad + (idx / (valid.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p.value - minV) / span) * (H - pad * 2);
    return { x, y };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${H - pad} L ${pts[0].x.toFixed(1)} ${H - pad} Z`;

  const targetY =
    targetVal !== null
      ? H - pad - ((targetVal - minV) / span) * (H - pad * 2)
      : null;

  const gradId = `spark_${status}_${valid.length}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-10 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {targetY !== null && (
        <line
          x1={pad}
          x2={W - pad}
          y1={targetY}
          y2={targetY}
          stroke="rgba(255,255,255,0.28)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
      )}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="2.6"
        fill={stroke}
      />
    </svg>
  );
}

interface DetailedMetricChartProps {
  series: MetricDailyPoint[];
  unit: MetricUnit;
  status: MetricEvalStatus;
  goal?: MetricGoalConfig | null;
  label: string;
}

export function DetailedMetricChart({
  series,
  unit,
  status,
  goal,
  label,
}: DetailedMetricChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const valid = useMemo(
    () => series.filter((p): p is { date: string; value: number } => p.value !== null && Number.isFinite(p.value)),
    [series]
  );

  if (valid.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center rounded-xl border border-dashed border-blue-200/15 bg-[#050b18] text-xs text-slate-400">
        Nenhum ponto diário disponível para este indicador no período.
      </div>
    );
  }

  const stroke = getStatusStroke(status);
  const W = 560;
  const H = 190;
  const padL = 16;
  const padR = 16;
  const padT = 18;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const targetVal =
    goal && goal.enabled && goal.goalType !== "growth_pct"
      ? goal.targetValue
      : null;
  const maxRangeVal =
    goal && goal.enabled && goal.goalType === "range" && typeof goal.maxValue === "number"
      ? goal.maxValue
      : null;

  const allVals = valid.map((v) => v.value);
  if (targetVal !== null) allVals.push(targetVal);
  if (maxRangeVal !== null) allVals.push(maxRangeVal);

  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals) * 1.1 || 1;
  const span = maxV - minV || 1;

  const toY = (v: number) => padT + plotH - ((v - minV) / span) * plotH;

  const pts = valid.map((p, idx) => {
    const ratio = valid.length === 1 ? 0.5 : idx / (valid.length - 1);
    return {
      x: padL + ratio * plotW,
      y: toY(p.value),
      day: p,
    };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    pts.length >= 2
      ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : "";

  const active = hoveredIdx !== null ? pts[hoveredIdx] : pts[pts.length - 1];

  return (
    <div className="rounded-xl border border-blue-200/12 bg-[#050b18] p-4 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-400">
          Evolução diária — <strong className="text-white">{label}</strong>
        </span>
        {active && (
          <span className="tabular-nums text-slate-200">
            {formatDateBR(active.day.date)}:{" "}
            <strong style={{ color: stroke }}>
              {formatMetricValue(active.day.value, unit)}
            </strong>
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-44 overflow-visible"
        role="img"
        aria-label={`Gráfico histórico de ${label}`}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="detailedMetricGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.30" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.33, 0.66, 1].map((step) => {
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

        {/* Faixa ideal quando meta for do tipo intervalo */}
        {targetVal !== null && maxRangeVal !== null && (
          <rect
            x={padL}
            y={Math.min(toY(targetVal), toY(maxRangeVal))}
            width={plotW}
            height={Math.max(2, Math.abs(toY(maxRangeVal) - toY(targetVal)))}
            fill="rgba(52, 211, 153, 0.12)"
          />
        )}

        {/* Linha de meta */}
        {targetVal !== null && (
          <g>
            <line
              x1={padL}
              x2={W - padR}
              y1={toY(targetVal)}
              y2={toY(targetVal)}
              stroke="#60a5fa"
              strokeWidth="1.4"
              strokeDasharray="5 4"
            />
            <text
              x={W - padR}
              y={Math.max(12, toY(targetVal) - 4)}
              textAnchor="end"
              fill="#93c5fd"
              fontSize="10"
              fontFamily="monospace"
            >
              Meta: {formatMetricValue(targetVal, unit)}
            </text>
          </g>
        )}

        {areaPath && <path d={areaPath} fill="url(#detailedMetricGrad)" />}
        {pts.length >= 2 && (
          <path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {pts.map((p, idx) => (
          <g
            key={p.day.date}
            onMouseEnter={() => setHoveredIdx(idx)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === idx ? 4.5 : 3}
              fill={stroke}
              stroke="#07080d"
              strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Datas nas extremidades */}
        <text
          x={padL}
          y={H - 5}
          fill="#71717a"
          fontSize="10"
          fontFamily="monospace"
        >
          {formatDateBR(valid[0].date)}
        </text>
        {valid.length > 1 && (
          <text
            x={W - padR}
            y={H - 5}
            textAnchor="end"
            fill="#71717a"
            fontSize="10"
            fontFamily="monospace"
          >
            {formatDateBR(valid[valid.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  );
}
