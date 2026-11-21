import type {
  CustomFeeRecord,
  ManualExpenseRecord,
  TikTokCampaignRecord,
  TransactionRecord,
  TransferRecord,
} from "./db";
import type { PeriodPreset } from "./dashfy-types";

export function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDateRange(
  period: PeriodPreset,
  customFrom: string,
  customTo: string
): { startDate: Date | null; endDate: Date } {
  const now = new Date();
  let start: Date | null = null;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (period === "7d") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (period === "30d") {
    start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (period === "custom") {
    if (customFrom) {
      const [fy, fm, fd] = customFrom.split("-").map(Number);
      start = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    }
    if (customTo) {
      const [ty, tm, td] = customTo.split("-").map(Number);
      end = new Date(ty, tm - 1, td, 23, 59, 59, 999);
    }
  } else {
    start = null;
  }

  return { startDate: start, endDate: end };
}

export function isDateInRange(
  dateStr: string | null | undefined,
  startDate: Date | null,
  endDate: Date
): boolean {
  if (!startDate) return true;
  if (!dateStr) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split("-").map(Number);
    const localMid = new Date(y, m - 1, d, 12, 0, 0);
    return localMid >= startDate && localMid <= endDate;
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= startDate && dt <= endDate;
}

export interface ProductSalesSummary {
  productName: string;
  count: number;
  grossRevenue: number;
  netRevenue: number;
  sharePct: number;
}

export interface DailySeriesPoint {
  date: string;
  grossRevenue: number;
  netRevenue: number;
  expenses: number;
  profit: number;
}

export interface OperationSummaryMetrics {
  grossRevenue: number;
  netRevenue: number;
  adExpenses: number;
  otherExpenses: number;
  checkoutOrPlatformFees: number;
  customFeesTotal: number;
  totalExpensesAndFees: number;
  profit: number;
  roas: number | null;
  roiMultiplier: number | null;
  roiPct: number | null;
  marginPct: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  totalOrdersCount: number;
  refundedOrCanceledCount: number;
  approvalRate: number;
  receivedAmount: number;
  completedTransfersCount: number;
  pendingTransferAmount: number;
  // TikTok specific extras
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  productBreakdown: ProductSalesSummary[];
  dailySeries: DailySeriesPoint[];
}

export function calculateCustomFeesTotal(
  fees: CustomFeeRecord[],
  revenueBase: number
): number {
  return fees.reduce((acc, fee) => {
    if (fee.feeType === "PERCENTAGE") {
      return acc + (revenueBase * fee.value) / 100;
    }
    return acc + fee.value;
  }, 0);
}

/**
 * Métricas 100% isoladas para Operação OmegaPay.
 */
export function computeOmegaPaySummary(
  transactions: TransactionRecord[],
  transfers: TransferRecord[],
  expenses: ManualExpenseRecord[],
  customFees: CustomFeeRecord[]
): OperationSummaryMetrics {
  const approved = transactions.filter((t) => t.status === "COMPLETED");
  const pending = transactions.filter((t) => t.status === "PENDING");
  const refundedOrCanceled = transactions.filter(
    (t) =>
      t.status === "REFUNDED" ||
      t.status === "CANCELED" ||
      t.status === "CHARGED_BACK"
  );

  const grossRevenue = approved.reduce((acc, t) => acc + t.grossAmount, 0);
  const checkoutFees = approved.reduce((acc, t) => acc + t.feeAmount, 0);
  const rawNetRevenue = approved.reduce((acc, t) => acc + t.netAmount, 0);
  const customFeesTotal = calculateCustomFeesTotal(customFees, grossRevenue);
  const netRevenue = Math.max(0, rawNetRevenue - customFeesTotal);

  const pendingAmount = pending.reduce((acc, t) => acc + t.grossAmount, 0);
  const approvalRate =
    transactions.length > 0 ? (approved.length / transactions.length) * 100 : 0;

  const completedTransfers = transfers.filter((tf) => tf.status === "COMPLETED");
  const receivedAmount = completedTransfers.reduce((acc, tf) => acc + tf.amount, 0);
  const pendingTransferAmount = transfers
    .filter((tf) => tf.status === "PENDING" || tf.status === "PROCESSING")
    .reduce((acc, tf) => acc + tf.amount, 0);

  const adExpenses = expenses
    .filter(
      (e) =>
        e.category === "META_ADS" ||
        e.category === "TIKTOK_ADS" ||
        e.category === "OTHER_ADS"
    )
    .reduce((acc, e) => acc + e.amount, 0);

  const otherExpenses = expenses
    .filter((e) => e.category === "TOOLS" || e.category === "OTHER")
    .reduce((acc, e) => acc + e.amount, 0);

  const totalManualExpenses = adExpenses + otherExpenses;
  const profit = netRevenue - totalManualExpenses;
  const marginPct = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0;

  const roas = adExpenses > 0 ? grossRevenue / adExpenses : null;
  const totalInvestment = totalManualExpenses > 0 ? totalManualExpenses : 0;
  const roiMultiplier = totalInvestment > 0 ? netRevenue / totalInvestment : null;
  const roiPct = totalInvestment > 0 ? (profit / totalInvestment) * 100 : null;

  // Vendas por produto
  const prodMap = new Map<string, { count: number; gross: number; net: number }>();
  for (const tx of approved) {
    const key = tx.productName || "Produto";
    const cur = prodMap.get(key) || { count: 0, gross: 0, net: 0 };
    cur.count += 1;
    cur.gross += tx.grossAmount;
    cur.net += tx.netAmount;
    prodMap.set(key, cur);
  }
  const productBreakdown: ProductSalesSummary[] = Array.from(prodMap.entries())
    .map(([productName, v]) => ({
      productName,
      count: v.count,
      grossRevenue: v.gross,
      netRevenue: v.net,
      sharePct: grossRevenue > 0 ? (v.gross / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  // Série diária
  const dayMap = new Map<string, DailySeriesPoint>();
  for (const tx of approved) {
    const day = (tx.paidAt || tx.createdAt).slice(0, 10);
    const cur = dayMap.get(day) || {
      date: day,
      grossRevenue: 0,
      netRevenue: 0,
      expenses: 0,
      profit: 0,
    };
    cur.grossRevenue += tx.grossAmount;
    cur.netRevenue += tx.netAmount;
    cur.profit = cur.netRevenue - cur.expenses;
    dayMap.set(day, cur);
  }
  for (const exp of expenses) {
    const day = exp.expenseDate.slice(0, 10);
    const cur = dayMap.get(day) || {
      date: day,
      grossRevenue: 0,
      netRevenue: 0,
      expenses: 0,
      profit: 0,
    };
    cur.expenses += exp.amount;
    cur.profit = cur.netRevenue - cur.expenses;
    dayMap.set(day, cur);
  }
  const dailySeries = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return {
    grossRevenue,
    netRevenue,
    adExpenses,
    otherExpenses,
    checkoutOrPlatformFees: checkoutFees,
    customFeesTotal,
    totalExpensesAndFees: totalManualExpenses + checkoutFees + customFeesTotal,
    profit,
    roas,
    roiMultiplier,
    roiPct,
    marginPct,
    pendingCount: pending.length,
    pendingAmount,
    approvedCount: approved.length,
    totalOrdersCount: transactions.length,
    refundedOrCanceledCount: refundedOrCanceled.length,
    approvalRate,
    receivedAmount,
    completedTransfersCount: completedTransfers.length,
    pendingTransferAmount,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    cpa: 0,
    productBreakdown,
    dailySeries,
  };
}

/**
 * Métricas 100% isoladas para Operação TikTok.
 * Separa claramente Receita Atribuída (attributedRevenue) e Lucro Estimado (estimatedProfit).
 */
export function computeTikTokSummary(
  campaigns: TikTokCampaignRecord[],
  expenses: ManualExpenseRecord[],
  customFees: CustomFeeRecord[]
): OperationSummaryMetrics {
  const attributedRevenue = campaigns.reduce((acc, c) => acc + c.attributedRevenue, 0);
  const campaignSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
  const impressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);
  const clicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
  const conversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);

  const manualAdExpenses = expenses
    .filter(
      (e) =>
        e.category === "TIKTOK_ADS" ||
        e.category === "META_ADS" ||
        e.category === "OTHER_ADS"
    )
    .reduce((acc, e) => acc + e.amount, 0);

  const otherExpenses = expenses
    .filter((e) => e.category === "TOOLS" || e.category === "OTHER")
    .reduce((acc, e) => acc + e.amount, 0);

  const adExpenses = campaignSpend + manualAdExpenses;
  const customFeesTotal = calculateCustomFeesTotal(customFees, attributedRevenue);
  const netRevenue = Math.max(0, attributedRevenue - customFeesTotal);

  const totalInvestment = adExpenses + otherExpenses;
  const estimatedProfit = netRevenue - totalInvestment;
  const marginPct = attributedRevenue > 0 ? (estimatedProfit / attributedRevenue) * 100 : 0;

  const roas = adExpenses > 0 ? attributedRevenue / adExpenses : null;
  const roiMultiplier = totalInvestment > 0 ? netRevenue / totalInvestment : null;
  const roiPct = totalInvestment > 0 ? (estimatedProfit / totalInvestment) * 100 : null;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? adExpenses / clicks : 0;
  const cpm = impressions > 0 ? (adExpenses / impressions) * 1000 : 0;
  const cpa = conversions > 0 ? adExpenses / conversions : 0;

  // Vendas/conversões por produto
  const prodMap = new Map<string, { count: number; gross: number; spend: number }>();
  for (const c of campaigns) {
    const key = c.productName || "Produto Principal";
    const cur = prodMap.get(key) || { count: 0, gross: 0, spend: 0 };
    cur.count += c.conversions;
    cur.gross += c.attributedRevenue;
    cur.spend += c.spend;
    prodMap.set(key, cur);
  }
  const productBreakdown: ProductSalesSummary[] = Array.from(prodMap.entries())
    .map(([productName, v]) => ({
      productName,
      count: v.count,
      grossRevenue: v.gross,
      netRevenue: v.gross - v.spend,
      sharePct: attributedRevenue > 0 ? (v.gross / attributedRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  // Série diária
  const dayMap = new Map<string, DailySeriesPoint>();
  for (const c of campaigns) {
    const day = c.statDate.slice(0, 10);
    const cur = dayMap.get(day) || {
      date: day,
      grossRevenue: 0,
      netRevenue: 0,
      expenses: 0,
      profit: 0,
    };
    cur.grossRevenue += c.attributedRevenue;
    cur.netRevenue += c.attributedRevenue;
    cur.expenses += c.spend;
    cur.profit = cur.netRevenue - cur.expenses;
    dayMap.set(day, cur);
  }
  for (const exp of expenses) {
    const day = exp.expenseDate.slice(0, 10);
    const cur = dayMap.get(day) || {
      date: day,
      grossRevenue: 0,
      netRevenue: 0,
      expenses: 0,
      profit: 0,
    };
    cur.expenses += exp.amount;
    cur.profit = cur.netRevenue - cur.expenses;
    dayMap.set(day, cur);
  }
  const dailySeries = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return {
    grossRevenue: attributedRevenue,
    netRevenue,
    adExpenses,
    otherExpenses,
    checkoutOrPlatformFees: 0,
    customFeesTotal,
    totalExpensesAndFees: totalInvestment + customFeesTotal,
    profit: estimatedProfit,
    roas,
    roiMultiplier,
    roiPct,
    marginPct,
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: conversions,
    totalOrdersCount: conversions,
    refundedOrCanceledCount: 0,
    approvalRate: clicks > 0 ? Math.min(100, (conversions / clicks) * 100) : 0,
    receivedAmount: 0,
    completedTransfersCount: 0,
    pendingTransferAmount: 0,
    impressions,
    clicks,
    ctr,
    cpc,
    cpm,
    cpa,
    productBreakdown,
    dailySeries,
  };
}

export interface ParsedTikTokCsvRow {
  adAccount: string;
  campaignName: string;
  adgroupName: string;
  adName: string;
  productName: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  statDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  status: "ACTIVE" | "PAUSED";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseFlexibleNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val
    .replace(/R\$/gi, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return 0;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parser CSV compatível com planilhas exportadas do TikTok Ads Manager (PT-BR e EN)
 * e com o modelo padrão do Dashfy.
 */
export function parseTikTokCsv(csvText: string): ParsedTikTokCsvRow[] {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter =
    (headerLine.match(/;/g)?.length || 0) > (headerLine.match(/,/g)?.length || 0)
      ? ";"
      : ",";

  const rawHeaders = splitCsvLine(headerLine, delimiter).map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );

  const findIdx = (candidates: string[]) =>
    rawHeaders.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const idxAccount = findIdx(["conta", "ad account", "account"]);
  const idxCampaign = findIdx(["campanha", "campaign"]);
  const idxAdgroup = findIdx(["conjunto", "ad group", "adgroup", "grupo"]);
  const idxAd = findIdx(["anuncio", "ad name", "criativo", "ad"]);
  const idxProduct = findIdx(["produto", "product", "oferta"]);
  const idxDate = findIdx(["data", "date", "dia", "day"]);
  const idxSpend = findIdx(["investimento", "gasto", "custo", "cost", "spend"]);
  const idxImpressions = findIdx(["impressoes", "impressions"]);
  const idxClicks = findIdx(["cliques", "clicks"]);
  const idxConversions = findIdx(["conversoes", "conversions", "vendas", "complete payment", "purchases"]);
  const idxRevenue = findIdx(["receita", "revenue", "faturamento", "value", "valor"]);
  const idxStatus = findIdx(["status", "estado"]);
  const idxUtmCampaign = findIdx(["utm_campaign"]);
  const idxUtmContent = findIdx(["utm_content"]);

  const today = getTodayLocalDate();
  const rows: ParsedTikTokCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const campaignName =
      (idxCampaign >= 0 ? cols[idxCampaign] : cols[0])?.trim() || "";
    if (!campaignName || campaignName.toLowerCase() === "total") continue;

    let rawDate = idxDate >= 0 ? cols[idxDate] : today;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate || "")) {
      const [dd, mm, yyyy] = rawDate.split("/");
      rawDate = `${yyyy}-${mm}-${dd}`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test((rawDate || "").slice(0, 10))) {
      rawDate = today;
    } else {
      rawDate = rawDate.slice(0, 10);
    }

    const adName =
      (idxAd >= 0 && idxAd !== idxCampaign && idxAd !== idxAdgroup
        ? cols[idxAd]
        : "Anúncio Principal")?.trim() || "Anúncio Principal";

    const rawStatus = (idxStatus >= 0 ? cols[idxStatus] : "ACTIVE")?.toUpperCase() || "ACTIVE";

    rows.push({
      adAccount: (idxAccount >= 0 ? cols[idxAccount] : "Conta Principal TikTok")?.trim() || "Conta Principal TikTok",
      campaignName,
      adgroupName: (idxAdgroup >= 0 ? cols[idxAdgroup] : "Conjunto Principal")?.trim() || "Conjunto Principal",
      adName,
      productName: (idxProduct >= 0 ? cols[idxProduct] : "Produto Principal")?.trim() || "Produto Principal",
      utmSource: "tiktok",
      utmMedium: "cpc",
      utmCampaign: (idxUtmCampaign >= 0 ? cols[idxUtmCampaign] : campaignName)?.trim() || campaignName,
      utmContent: (idxUtmContent >= 0 ? cols[idxUtmContent] : adName)?.trim() || adName,
      statDate: rawDate,
      spend: parseFlexibleNumber(idxSpend >= 0 ? cols[idxSpend] : "0"),
      impressions: Math.round(parseFlexibleNumber(idxImpressions >= 0 ? cols[idxImpressions] : "0")),
      clicks: Math.round(parseFlexibleNumber(idxClicks >= 0 ? cols[idxClicks] : "0")),
      conversions: Math.round(parseFlexibleNumber(idxConversions >= 0 ? cols[idxConversions] : "0")),
      attributedRevenue: parseFlexibleNumber(idxRevenue >= 0 ? cols[idxRevenue] : "0"),
      status: rawStatus.includes("PAUS") || rawStatus.includes("INAT") ? "PAUSED" : "ACTIVE",
    });
  }

  return rows;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    "\uFEFF" +
    [headers.map(escapeCell).join(";"), ...rows.map((r) => r.map(escapeCell).join(";"))].join(
      "\r\n"
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
