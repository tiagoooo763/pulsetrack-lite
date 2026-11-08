"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
BalanceSnapshotRecord,
ExpenseCategory,
ManualExpenseRecord,
TransactionRecord,
TransferRecord,
WebhookEventRecord,
} from "@/lib/db";
import {
EXPENSE_CATEGORIES,
formatBRL,
formatDateBR,
formatDateTimeBR,
getPaymentMethodLabel,
getTransactionStatusBadge,
getTransferStatusBadge,
} from "@/lib/format";
import { FinancialCharts } from "./FinancialCharts";
import { IntegrationAndGuideTab } from "./IntegrationAndGuideTab";
import {
Activity,
ArrowDownRight,
ArrowUpRight,
Banknote,
Calendar,
CheckCircle2,
CreditCard,
DollarSign,
Filter,
Landmark,
Layers,
LogOut,
Megaphone,
Percent,
Plus,
RefreshCw,
Search,
ShieldAlert,
TrendingUp,
Trash2,
Wallet,
} from "lucide-react";
type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";
type ActiveTab = "overview" | "sales" | "expenses" | "integration";
interface IntegrationStatus {
hasApiCredentials: boolean;
hasWebhookToken: boolean;
source: string;
apiBaseUrl: string;
isDefaultPassword: boolean;
}
interface DashboardPayload {
transactions: TransactionRecord[];
transfers: TransferRecord[];
expenses: ManualExpenseRecord[];
balance: BalanceSnapshotRecord | null;
recentWebhooks: WebhookEventRecord[];
integrationStatus: IntegrationStatus;
}
interface DashboardAppProps {
onLogout: () => void;
}
export function DashboardApp({ onLogout }: DashboardAppProps) {
const [data, setData] = useState<DashboardPayload | null>(null);
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
// Filtro de período
const [period, setPeriod] = useState<PeriodPreset>("30d");
const [customFrom, setCustomFrom] = useState(() => {
const d = new Date();
d.setDate(d.getDate() - 30);
return d.toISOString().slice(0, 10);
});
const [customTo, setCustomTo] = useState(() =>
new Date().toISOString().slice(0, 10)
);
// Atualização pontual de saldo (GET /gateway/producer/balance)
const [syncingBalance, setSyncingBalance] = useState(false);
const [balanceNotice, setBalanceNotice] = useState<{
type: "success" | "error";
message: string;
} | null>(null);
// Filtros do Histórico de Vendas
const [salesSearch, setSalesSearch] = useState("");
const [salesStatusFilter, setSalesStatusFilter] = useState<string>("ALL");
// Formulário de Despesas Manuais
const [expCategory, setExpCategory] = useState<ExpenseCategory>("META_ADS");
const [expDescription, setExpDescription] = useState("");
const [expAmount, setExpAmount] = useState("");
const [expDate, setExpDate] = useState(() =>
new Date().toISOString().slice(0, 10)
);
const [submittingExpense, setSubmittingExpense] = useState(false);
const [expenseError, setExpenseError] = useState<string | null>(null);
const fetchDashboard = useCallback(async () => {
try {
const res = await fetch("/api/dashboard", { cache: "no-store" });
if (res.status === 401) {
onLogout();
return;
}
if (res.ok) {
const json: DashboardPayload = await res.json();
setData(json);
}
} finally {
setLoading(false);
}
}, [onLogout]);
useEffect(() => {
fetchDashboard();
}, [fetchDashboard]);
// Verifica se uma data ISO cai dentro do período selecionado
const isWithinPeriod = useCallback(
(isoDateStr: string | null | undefined): boolean => {
if (!isoDateStr) return false;
if (period === "all") return true;
const dayStr = isoDateStr.slice(0, 10); // YYYY-MM-DD
const now = new Date();
const todayStr = now.toISOString().slice(0, 10);
if (period === "today") {
return dayStr === todayStr;
}
if (period === "7d") {
const start = new Date(now);
start.setDate(start.getDate() - 6);
const startStr = start.toISOString().slice(0, 10);
return dayStr >= startStr && dayStr <= todayStr;
}
if (period === "30d") {
const start = new Date(now);
start.setDate(start.getDate() - 29);
const startStr = start.toISOString().slice(0, 10);
return dayStr >= startStr && dayStr <= todayStr;
}
if (period === "month") {
const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
return dayStr.startsWith(monthPrefix);
}
if (period === "custom") {
return (
(!customFrom || dayStr >= customFrom) &&
(!customTo || dayStr <= customTo)
);
}
return true;
},
[period, customFrom, customTo]
);
// Transações filtradas pelo período selecionado
const periodTransactions = useMemo(() => {
if (!data) return [];
return data.transactions.filter((tx) =>
isWithinPeriod(tx.paidAt || tx.createdAt)
);
}, [data, isWithinPeriod]);
// Transferências filtradas pelo período selecionado
const periodTransfers = useMemo(() => {
if (!data) return [];
return data.transfers.filter((tr) =>
isWithinPeriod(tr.updatedAt || tr.createdAt)
);
}, [data, isWithinPeriod]);
// Despesas manuais filtradas pelo período selecionado
const periodExpenses = useMemo(() => {
if (!data) return [];
return data.expenses.filter((exp) => isWithinPeriod(exp.expenseDate));
}, [data, isWithinPeriod]);
// Cálculo dos 9 indicadores financeiros (KPIs)
const metrics = useMemo(() => {
// Regra #5: Considerar como receita confirmada SOMENTE as vendas efetivamente aprovadas (COMPLETED)
const approvedSales = periodTransactions.filter(
(t) => t.status === "COMPLETED"
);
const pendingSales = periodTransactions.filter(
(t) => t.status === "PENDING"
);
const refundedOrCanceledSales = periodTransactions.filter(
(t) =>
t.status === "REFUNDED" ||
t.status === "CANCELED" ||
t.status === "CHARGED_BACK"
);
const grossRevenue = approvedSales.reduce(
(acc, t) => acc + t.grossAmount,
0
);
const checkoutFees = approvedSales.reduce((acc, t) => acc + t.feeAmount, 0);
const netRevenue = approvedSales.reduce((acc, t) => acc + t.netAmount, 0);
const pendingGross = pendingSales.reduce(
(acc, t) => acc + t.grossAmount,
0
);
const approvalRate =
periodTransactions.length > 0
? (approvedSales.length / periodTransactions.length) * 100
: 0;
// Transferências concluídas (Valor recebido)
const completedTransfers = periodTransfers.filter(
(tr) => tr.status === "COMPLETED"
);
const pendingTransfers = periodTransfers.filter(
(tr) => tr.status === "PENDING"
);
const receivedAmount = completedTransfers.reduce(
(acc, tr) => acc + tr.receivedAmount,
0
);
const pendingTransferAmount = pendingTransfers.reduce(
(acc, tr) => acc + tr.amount,
0
);
// Despesas manuais: Anúncios (Meta Ads, TikTok Ads, Outros Anúncios) + Ferramentas/Outras
const adExpenses = periodExpenses
.filter(
(e) =>
e.category === "META_ADS" ||
e.category === "TIKTOK_ADS" ||
e.category === "OTHER_ADS"
)
.reduce((acc, e) => acc + e.amount, 0);
const metaAdsTotal = periodExpenses
.filter((e) => e.category === "META_ADS")
.reduce((acc, e) => acc + e.amount, 0);
const tiktokAdsTotal = periodExpenses
.filter((e) => e.category === "TIKTOK_ADS")
.reduce((acc, e) => acc + e.amount, 0);
const toolsAndOtherExpenses = periodExpenses
.filter((e) => e.category === "TOOLS" || e.category === "OTHER")
.reduce((acc, e) => acc + e.amount, 0);
const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);
// Regra #4: O lucro estimado será calculado usando a receita líquida menos as despesas cadastradas
const estimatedProfit = netRevenue - totalExpenses;
const netMarginPct =
netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;
// ROAS estimado (Receita Líquida / Gastos com Anúncios e Faturamento Bruto / Gastos com Anúncios)
const roasNet = adExpenses > 0 ? netRevenue / adExpenses : null;
const roasGross = adExpenses > 0 ? grossRevenue / adExpenses : null;
return {
grossRevenue,
approvedCount: approvedSales.length,
totalTxCount: periodTransactions.length,
pendingCount: pendingSales.length,
pendingGross,
refundedOrCanceledCount: refundedOrCanceledSales.length,
approvalRate,
checkoutFees,
netRevenue,
receivedAmount,
completedTransfersCount: completedTransfers.length,
pendingTransferAmount,
adExpenses,
metaAdsTotal,
tiktokAdsTotal,
toolsAndOtherExpenses,
totalExpenses,
estimatedProfit,
netMarginPct,
roasNet,
roasGross,
};
}, [periodTransactions, periodTransfers, periodExpenses]);
// Filtro de busca e status na tabela de Histórico de Vendas
const filteredSalesTable = useMemo(() => {
return periodTransactions.filter((tx) => {
if (salesStatusFilter !== "ALL" && tx.status !== salesStatusFilter) {
return false;
}
if (!salesSearch.trim()) return true;
const q = salesSearch.toLowerCase();
return (
tx.id.toLowerCase().includes(q) ||
tx.productName.toLowerCase().includes(q) ||
(tx.clientIdentifier && tx.clientIdentifier.toLowerCase().includes(q))
);
});
}, [periodTransactions, salesStatusFilter, salesSearch]);
// Consulta pontual de saldo na API oficial da OmegaPay (GET /gateway/producer/balance)
async function handleFetchOmegaPayBalance() {
setSyncingBalance(true);
setBalanceNotice(null);
try {
const res = await fetch("/api/omegapay/balance", {
method: "POST",
});
const json = await res.json();
if (!res.ok || !json.ok) {
setBalanceNotice({
type: "error",
message:
json.error ||
"Não foi possível consultar o saldo na OmegaPay. Verifique suas credenciais na aba Integração & Guia.",
});
} else {
setBalanceNotice({
type: "success",
message:
"Saldo atualizado diretamente via GET /gateway/producer/balance.",
});
await fetchDashboard();
}
} catch {
setBalanceNotice({
type: "error",
message: "Erro de rede ao consultar saldo.",
});
} finally {
setSyncingBalance(false);
}
}
// Adicionar despesa manual
async function handleAddExpense(e: React.FormEvent) {
e.preventDefault();
setExpenseError(null);
const numericAmount = Number(expAmount.replace(",", "."));
if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
setExpenseError("Informe um valor válido maior que zero.");
return;
}
setSubmittingExpense(true);
try {
const res = await fetch("/api/expenses", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
category: expCategory,
title:
expDescription.trim() || EXPENSE_CATEGORIES[expCategory].label,
amount: numericAmount,
expenseDate: expDate,
}),
});
const json = await res.json();
if (!res.ok || !json.ok) {
setExpenseError(json.error || "Erro ao registrar despesa.");
} else {
setExpDescription("");
setExpAmount("");
await fetchDashboard();
}
} catch {
setExpenseError("Erro ao salvar despesa no servidor.");
} finally {
setSubmittingExpense(false);
}
}
// Remover despesa manual
async function handleDeleteExpense(id: string) {
try {
const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
method: "DELETE",
});
if (res.ok) {
await fetchDashboard();
}
} catch {
// Silencioso
}
}
async function handleLogoutClick() {
await fetch("/api/auth/logout", { method: "POST" });
onLogout();
}
if (loading || !data) {
return (
<div className="min-h-screen flex items-center justify-center bg-[#090b10] text-zinc-300">
<div className="flex items-center gap-3 text-sm">
<RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
<span>Carregando PulseTrack Lite...</span>
</div>
</div>
);
}
const omegaBalanceAvailable = data.balance?.available ?? null;
const omegaBalancePending = data.balance?.pending ?? null;
const omegaBalanceFundLock = data.balance?.fundLock ?? null;
const omegaBalanceTotal =
omegaBalanceAvailable !== null
? omegaBalanceAvailable +
(omegaBalancePending ?? 0) +
(omegaBalanceFundLock ?? 0)
: null;
return (
<div className="min-h-screen bg-[#090b10] text-zinc-100 flex flex-col">
{/* Topbar */}
<header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090b10]/90 backdrop-blur-xl">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
{/* Identidade Visual */}
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
<Activity className="w-5 h-5 text-zinc-950 stroke-[2.4]" />
</div>
<div>
<div className="flex items-center gap-2">
<h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
PulseTrack <span className="text-emerald-400">Lite</span>
</h1>
<span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
OmegaPay v1 Oficial
</span>
</div>
<p className="text-xs text-zinc-400">
Controle de vendas, taxas, despesas manuais e recebimentos
</p>
</div>
</div>
{/* Ações Rápidas */}
<div className="flex flex-wrap items-center gap-2.5">
<button
type="button"
onClick={handleFetchOmegaPayBalance}
disabled={syncingBalance}
className="flex items-center gap-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-3.5 py-2 text-xs font-medium text-emerald-300 transition disabled:opacity-50"
title="Executa consulta pontual GET /gateway/producer/balance na OmegaPay"
>
<RefreshCw
className={`w-3.5 h-3.5 ${
syncingBalance ? "animate-spin" : ""
}`}
/>
<span>
{syncingBalance
? "Consultando OmegaPay..."
: "Atualizar Saldo OmegaPay"}
</span>
</button>
<button
type="button"
onClick={handleLogoutClick}
className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-3 py-2 text-xs text-zinc-300 transition"
title="Encerrar sessão"
>
<LogOut className="w-3.5 h-3.5 text-zinc-400" />
<span className="hidden sm:inline">Sair</span>
</button>
</div>
</div>
{/* Barra de Navegação e Filtro de Período */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 border-t border-white/[0.05] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
{/* Abas */}
<nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
{[
{ id: "overview", label: "Visão Geral" },
{
id: "sales",
label: `Histórico de Vendas (${periodTransactions.length})`,
},
{
id: "expenses",
label: `Despesas Manuais (${periodExpenses.length})`,
},
{ id: "integration", label: "Integração & Guia OmegaPay" },
].map((tab) => {
const active = activeTab === tab.id;
return (
<button
key={tab.id}
type="button"
onClick={() => setActiveTab(tab.id as ActiveTab)}
className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
active
? "bg-emerald-500 text-zinc-950 font-semibold shadow-sm shadow-emerald-500/20"
: "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
}`}
>
{tab.label}
</button>
);
})}
</nav>
{/* Seletor de Período */}
<div className="flex flex-wrap items-center gap-2">
<div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-1">
<Calendar className="w-3.5 h-3.5 text-emerald-400" />
<span>Período:</span>
</div>
{(
[
{ id: "today", label: "Hoje" },
{ id: "7d", label: "7 dias" },
{ id: "30d", label: "30 dias" },
{ id: "month", label: "Este mês" },
{ id: "all", label: "Tudo" },
{ id: "custom", label: "Personalizado" },
] as { id: PeriodPreset; label: string }[]
).map((p) => (
<button
key={p.id}
type="button"
onClick={() => setPeriod(p.id)}
className={`px-2.5 py-1 rounded-lg text-xs transition ${
period === p.id
? "bg-white/15 text-white font-medium border border-white/20"
: "text-zinc-400 hover:text-zinc-200 bg-white/[0.03] border border-transparent"
}`}
>
{p.label}
</button>
))}
{period === "custom" && (
<div className="flex items-center gap-1.5 text-xs">
<input
type="date"
value={customFrom}
onChange={(e) => setCustomFrom(e.target.value)}
className="rounded-lg border border-white/10 bg-[#11141d] px-2 py-1 text-xs text-white"
/>
<span className="text-zinc-500">até</span>
<input
type="date"
value={customTo}
onChange={(e) => setCustomTo(e.target.value)}
className="rounded-lg border border-white/10 bg-[#11141d] px-2 py-1 text-xs text-white"
/>
</div>
)}
</div>
</div>
</header>
{/* Conteúdo Principal */}
<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
{/* Aviso de Senha Padrão ou Retorno de Saldo */}
{data.integrationStatus.isDefaultPassword && (
<div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
<div className="flex items-center gap-2">
<ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
<span>
Você está utilizando a senha padrão de demonstração. Configure{" "}
<code>DASHBOARD_PASSWORD</code> no ambiente ou defina uma senha
própria na aba <strong>Integração &amp; Guia OmegaPay</strong>.
</span>
</div>
<button
type="button"
onClick={() => setActiveTab("integration")}
className="text-amber-300 underline hover:text-amber-100 font-medium"
>
Configurar agora
</button>
</div>
)}
{balanceNotice && (
<div
className={`rounded-2xl border px-4 py-3 text-xs flex items-center justify-between ${
balanceNotice.type === "success"
? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
: "border-rose-500/30 bg-rose-500/10 text-rose-300"
}`}
>
<span>{balanceNotice.message}</span>
<button
type="button"
onClick={() => setBalanceNotice(null)}
className="text-zinc-400 hover:text-white ml-4"
>
✕
</button>
</div>
)}
{/* ==================== ABA 1: VISÃO GERAL ==================== */}
{activeTab === "overview" && (
<div className="space-y-6">
{/* Grade com os 9 Cards Principais Solicitados */}
<section aria-label="Indicadores Financeiros">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
{/* 1. Faturamento bruto */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
1. Faturamento Bruto
</span>
<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
<DollarSign className="w-4 h-4 text-emerald-400" />
</div>
</div>
<div className="my-3">
<div className="text-2xl font-bold text-white tabular-nums">
{formatBRL(metrics.grossRevenue)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>Somente vendas aprovadas</span>
{metrics.pendingGross > 0 && (
<span className="text-amber-300 tabular-nums">
+{formatBRL(metrics.pendingGross)} pendente
</span>
)}
</div>
</div>
{/* 2. Vendas aprovadas */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
2. Vendas Aprovadas
</span>
<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
<CheckCircle2 className="w-4 h-4 text-emerald-400" />
</div>
</div>
<div className="my-3 flex items-baseline gap-2.5">
<div className="text-2xl font-bold text-white tabular-nums">
{metrics.approvedCount}
</div>
<span className="text-xs text-emerald-400 font-medium">
({metrics.approvalRate.toFixed(1)}% de conversão)
</span>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>{metrics.pendingCount} aguardando pagamento</span>
<span>
{metrics.refundedOrCanceledCount} cancel./reembolso
</span>
</div>
</div>
{/* 3. Taxas do checkout */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
3. Taxas do Checkout
</span>
<div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
<Percent className="w-4 h-4 text-amber-400" />
</div>
</div>
<div className="my-3">
<div className="text-2xl font-bold text-amber-300 tabular-nums">
{formatBRL(metrics.checkoutFees)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>Taxas retidas pela OmegaPay</span>
<span className="tabular-nums">
{metrics.grossRevenue > 0
? `${((metrics.checkoutFees / metrics.grossRevenue) * 100).toFixed(2)}% do bruto`
: "0% do bruto"}
</span>
</div>
</div>
{/* 4. Receita líquida */}
<div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-[#11141d] to-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-emerald-300">
4. Receita Líquida Confirmada
</span>
<div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
<Banknote className="w-4 h-4 text-emerald-400" />
</div>
</div>
<div className="my-3">
<div className="text-2xl font-bold text-emerald-400 tabular-nums">
{formatBRL(metrics.netRevenue)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>Faturamento bruto menos taxas</span>
<span className="text-emerald-300 font-medium">
Base do lucro
</span>
</div>
</div>
{/* 5. Saldo informado pela OmegaPay (Disponível, Pendente e Retido/fundLock) */}
<div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.06] via-[#11141d] to-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-sky-300">
5. Saldo Informado pela OmegaPay
</span>
<div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
<Wallet className="w-4 h-4 text-sky-400" />
</div>
</div>
{omegaBalanceAvailable === null ? (
<div className="my-3">
<div className="text-sm font-medium text-zinc-300">
Não sincronizado ainda
</div>
<p className="text-[11px] text-zinc-400 mt-0.5">
Clique em &ldquo;Atualizar Saldo OmegaPay&rdquo; no topo para consultar{" "}
<code>GET /gateway/producer/balance</code>.
</p>
</div>
) : (
<div className="my-2.5 space-y-1.5">
<div className="flex items-baseline justify-between">
<span className="text-xs text-zinc-400">
Disponível (<code>available</code>):
</span>
<span className="text-lg font-bold text-white tabular-nums">
{formatBRL(omegaBalanceAvailable)}
</span>
</div>
<div className="flex items-center justify-between text-xs">
<span className="text-zinc-400">
Pendente (<code>pending</code>):
</span>
<span className="text-amber-300 font-medium tabular-nums">
{formatBRL(omegaBalancePending ?? 0)}
</span>
</div>
<div className="flex items-center justify-between text-xs">
<span className="text-zinc-400">
Retido / Cautelar (<code>fundLock</code>):
</span>
<span className="text-rose-300 font-medium tabular-nums">
{formatBRL(omegaBalanceFundLock ?? 0)}
</span>
</div>
</div>
)}
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>
{data.balance?.fetchedAt
? `Consultado em ${formatDateTimeBR(data.balance.fetchedAt)}`
: "Endpoint oficial GET /producer/balance"}
</span>
{omegaBalanceTotal !== null && (
<span className="text-sky-300 font-medium tabular-nums">
Total: {formatBRL(omegaBalanceTotal)}
</span>
)}
</div>
</div>
{/* 6. Valor recebido (Transferências concluídas) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
6. Valor Recebido (Transferido)
</span>
<div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
<Landmark className="w-4 h-4 text-teal-400" />
</div>
</div>
<div className="my-3">
<div className="text-2xl font-bold text-white tabular-nums">
{formatBRL(metrics.receivedAmount)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>
{metrics.completedTransfersCount} transferência(s){" "}
<code>COMPLETED</code>
</span>
{metrics.pendingTransferAmount > 0 && (
<span className="text-amber-300 tabular-nums">
+{formatBRL(metrics.pendingTransferAmount)} em proc.
</span>
)}
</div>
</div>
{/* 7. Gastos com anúncios (Manual, sem APIs externas) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
7. Gastos com Anúncios (Manual)
</span>
<div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
<Megaphone className="w-4 h-4 text-rose-400" />
</div>
</div>
<div className="my-3">
<div className="text-2xl font-bold text-rose-400 tabular-nums">
{formatBRL(metrics.adExpenses)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>
Meta: {formatBRL(metrics.metaAdsTotal)} &bull; TikTok:{" "}
{formatBRL(metrics.tiktokAdsTotal)}
</span>
<span className="text-zinc-300 tabular-nums">
Outras desp.: {formatBRL(metrics.toolsAndOtherExpenses)}
</span>
</div>
</div>
{/* 8. Lucro estimado (Receita líquida menos todas as despesas cadastradas) */}
<div
className={`rounded-2xl border p-5 flex flex-col justify-between ${
metrics.estimatedProfit >= 0
? "border-emerald-500/25 bg-[#11141d]"
: "border-rose-500/25 bg-[#11141d]"
}`}
>
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-300">
8. Lucro Estimado
</span>
<div
className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
metrics.estimatedProfit >= 0
? "bg-emerald-500/10 border-emerald-500/20"
: "bg-rose-500/10 border-rose-500/20"
}`}
>
{metrics.estimatedProfit >= 0 ? (
<ArrowUpRight className="w-4 h-4 text-emerald-400" />
) : (
<ArrowDownRight className="w-4 h-4 text-rose-400" />
)}
</div>
</div>
<div className="my-3">
<div
className={`text-2xl font-bold tabular-nums ${
metrics.estimatedProfit >= 0
? "text-emerald-400"
: "text-rose-400"
}`}
>
{formatBRL(metrics.estimatedProfit)}
</div>
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>
Receita líquida ({formatBRL(metrics.netRevenue)}) -
Despesas ({formatBRL(metrics.totalExpenses)})
</span>
<span className="font-medium text-zinc-200 tabular-nums">
Margem: {metrics.netMarginPct.toFixed(1)}%
</span>
</div>
</div>
{/* 9. ROAS estimado */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="text-xs font-medium text-zinc-400">
9. ROAS Estimado
</span>
<div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
<TrendingUp className="w-4 h-4 text-purple-400" />
</div>
</div>
<div className="my-3 flex items-baseline gap-3">
<div className="text-2xl font-bold text-white tabular-nums">
{metrics.roasNet !== null
? `${metrics.roasNet.toFixed(2)}x`
: "—"}
</div>
{metrics.roasGross !== null && (
<span className="text-xs text-purple-300 tabular-nums">
(Bruto: {metrics.roasGross.toFixed(2)}x)
</span>
)}
</div>
<div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2.5">
<span>Receita Líquida / Gastos com Anúncios</span>
<button
type="button"
onClick={() => setActiveTab("expenses")}
className="text-purple-300 hover:underline"
>
+ Lançar gasto
</button>
</div>
</div>
</div>
</section>
{/* Gráficos Financeiros */}
<FinancialCharts
transactions={periodTransactions}
expenses={periodExpenses}
/>
{/* Resumo Rápido: Últimas Vendas & Despesas Recentes */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
{/* Últimas Vendas */}
<div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 space-y-4">
<div className="flex items-center justify-between">
<div>
<h3 className="text-sm font-semibold text-white">
Últimas Transações no Período
</h3>
<p className="text-xs text-zinc-400">
Atualizadas em tempo real via webhook sem duplicação
</p>
</div>
<button
type="button"
onClick={() => setActiveTab("sales")}
className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
>
Ver histórico completo &rarr;
</button>
</div>
{periodTransactions.length === 0 ? (
<div className="py-8 text-center border border-dashed border-white/[0.06] rounded-xl text-xs text-zinc-400">
Nenhuma transação registrada neste período.
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-xs">
<thead>
<tr className="border-b border-white/[0.06] text-zinc-400">
<th className="py-2.5 px-2 font-medium">Data</th>
<th className="py-2.5 px-2 font-medium">Produto</th>
<th className="py-2.5 px-2 font-medium">ID Transação</th>
<th className="py-2.5 px-2 font-medium text-right">
Valor Bruto
</th>
<th className="py-2.5 px-2 font-medium text-right">
Taxa
</th>
<th className="py-2.5 px-2 font-medium text-right">
Líquido
</th>
<th className="py-2.5 px-2 font-medium text-right">
Status
</th>
</tr>
</thead>
<tbody className="divide-y divide-white/[0.04]">
{periodTransactions.slice(0, 6).map((tx) => {
const badge = getTransactionStatusBadge(tx.status);
return (
<tr key={tx.id} className="hover:bg-white/[0.02]">
<td className="py-2.5 px-2 text-zinc-400 tabular-nums whitespace-nowrap">
{formatDateTimeBR(tx.paidAt || tx.createdAt)}
</td>
<td className="py-2.5 px-2 text-zinc-200 font-medium max-w-[180px] truncate">
{tx.productName}
</td>
<td className="py-2.5 px-2 font-mono text-zinc-400">
{tx.id}
</td>
<td className="py-2.5 px-2 text-right text-zinc-200 tabular-nums">
{formatBRL(tx.grossAmount)}
</td>
<td className="py-2.5 px-2 text-right text-amber-300/90 tabular-nums">
{formatBRL(tx.feeAmount)}
</td>
<td className="py-2.5 px-2 text-right font-semibold text-emerald-400 tabular-nums">
{formatBRL(tx.netAmount)}
</td>
<td className="py-2.5 px-2 text-right">
<span
className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}
>
{badge.label}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
{/* Atalho Rápido de Despesas Manuais */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 space-y-4 flex flex-col justify-between">
<div className="space-y-3">
<div className="flex items-center justify-between">
<div>
<h3 className="text-sm font-semibold text-white">
Lançar Despesa Manual
</h3>
<p className="text-xs text-zinc-400">
Meta Ads, TikTok Ads, ferramentas e outros
</p>
</div>
<Layers className="w-4 h-4 text-rose-400" />
</div>
<form onSubmit={handleAddExpense} className="space-y-2.5">
<div>
<select
value={expCategory}
onChange={(e) =>
setExpCategory(e.target.value as ExpenseCategory)
}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
{(
Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]
).map((cat) => (
<option key={cat} value={cat}>
{EXPENSE_CATEGORIES[cat].label}
</option>
))}
</select>
</div>
<div>
<input
type="text"
value={expDescription}
onChange={(e) => setExpDescription(e.target.value)}
placeholder="Descrição (ex.: Campanha Conversão)"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div className="grid grid-cols-2 gap-2">
<input
type="number"
step="0.01"
min="0.01"
value={expAmount}
onChange={(e) => setExpAmount(e.target.value)}
placeholder="Valor (R$)"
required
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 tabular-nums focus:border-emerald-500 focus:outline-none"
/>
<input
type="date"
value={expDate}
onChange={(e) => setExpDate(e.target.value)}
required
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
/>
</div>
{expenseError && (
<p className="text-xs text-rose-400">{expenseError}</p>
)}
<button
type="submit"
disabled={submittingExpense}
className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs py-2.5 px-4 transition"
>
<Plus className="w-3.5 h-3.5" />
<span>
{submittingExpense
? "Registrando..."
: "Adicionar Despesa"}
</span>
</button>
</form>
</div>
<div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
<span>Total de despesas no período:</span>
<span className="font-semibold text-rose-300 tabular-nums">
{formatBRL(metrics.totalExpenses)}
</span>
</div>
</div>
</div>
</div>
)}
{/* ==================== ABA 2: HISTÓRICO DE VENDAS ==================== */}
{activeTab === "sales" && (
<div className="space-y-6">
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="text-base font-semibold text-white">
Histórico de Vendas (Transações OmegaPay)
</h2>
<p className="text-xs text-zinc-400">
Exibe data, produto, identificador da transação, valor bruto,
taxa, valor líquido e status. Somente vendas{" "}
<code className="text-emerald-300">COMPLETED</code> entram na
receita confirmada.
</p>
</div>
{/* Filtros de Busca e Status */}
<div className="flex flex-wrap items-center gap-2">
<div className="relative">
<Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
<input
type="text"
value={salesSearch}
onChange={(e) => setSalesSearch(e.target.value)}
placeholder="Buscar ID ou produto..."
className="rounded-xl border border-white/10 bg-[#0b0d14] pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div className="flex items-center gap-1.5">
<Filter className="w-3.5 h-3.5 text-zinc-400" />
<select
value={salesStatusFilter}
onChange={(e) => setSalesStatusFilter(e.target.value)}
className="rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
<option value="ALL">Todos os status</option>
<option value="COMPLETED">Aprovadas (COMPLETED)</option>
<option value="PENDING">Pendentes (PENDING)</option>
<option value="REFUNDED">Reembolsadas (REFUNDED)</option>
<option value="CANCELED">Canceladas (CANCELED)</option>
<option value="CHARGED_BACK">
Chargeback (CHARGED_BACK)
</option>
</select>
</div>
</div>
</div>
{filteredSalesTable.length === 0 ? (
<div className="py-12 text-center border border-dashed border-white/[0.06] rounded-xl text-xs text-zinc-400">
Nenhuma transação encontrada para os filtros selecionados.
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-xs">
<thead>
<tr className="border-b border-white/[0.07] text-zinc-400">
<th className="py-3 px-3 font-medium">Data</th>
<th className="py-3 px-3 font-medium">Produto</th>
<th className="py-3 px-3 font-medium">
Identificador da Transação
</th>
<th className="py-3 px-3 font-medium">Método</th>
<th className="py-3 px-3 font-medium text-right">
Valor Bruto
</th>
<th className="py-3 px-3 font-medium text-right">
Taxa
</th>
<th className="py-3 px-3 font-medium text-right">
Valor Líquido
</th>
<th className="py-3 px-3 font-medium text-right">
Status
</th>
</tr>
</thead>
<tbody className="divide-y divide-white/[0.04]">
{filteredSalesTable.map((tx) => {
const badge = getTransactionStatusBadge(tx.status);
return (
<tr key={tx.id} className="hover:bg-white/[0.02]">
<td className="py-3 px-3 text-zinc-300 tabular-nums whitespace-nowrap">
{formatDateTimeBR(tx.paidAt || tx.createdAt)}
</td>
<td className="py-3 px-3 text-white font-medium">
{tx.productName}
{tx.installments > 1 && (
<span className="ml-1.5 text-[11px] text-zinc-400">
({tx.installments}x)
</span>
)}
</td>
<td className="py-3 px-3 font-mono text-zinc-300">
<div>{tx.id}</div>
{tx.clientIdentifier && (
<div className="text-[10px] text-zinc-500">
Ref: {tx.clientIdentifier}
</div>
)}
</td>
<td className="py-3 px-3 text-zinc-300">
<span className="inline-flex items-center gap-1">
<CreditCard className="w-3 h-3 text-zinc-400" />
{getPaymentMethodLabel(tx.paymentMethod)}
</span>
</td>
<td className="py-3 px-3 text-right text-zinc-200 tabular-nums font-medium">
{formatBRL(tx.grossAmount)}
</td>
<td className="py-3 px-3 text-right text-amber-300 tabular-nums">
{formatBRL(tx.feeAmount)}
</td>
<td className="py-3 px-3 text-right text-emerald-400 font-semibold tabular-nums">
{formatBRL(tx.netAmount)}
</td>
<td className="py-3 px-3 text-right whitespace-nowrap">
<span
className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}
>
{badge.label}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
{/* Histórico de Transferências / Recebimentos (TRANSFER_CREATED, TRANSFER_COMPLETED, TRANSFER_FAILED) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4">
<div>
<h3 className="text-base font-semibold text-white">
Histórico de Recebimentos / Transferências (OmegaPay)
</h3>
<p className="text-xs text-zinc-400">
Transferências recebidas via webhooks{" "}
<code>TRANSFER_CREATED</code>,{" "}
<code>TRANSFER_COMPLETED</code>, <code>TRANSFER_FAILED</code>{" "}
ou consulta <code>GET /gateway/transfers</code> (sem armazenar
chaves PIX ou dados bancários).
</p>
</div>
{periodTransfers.length === 0 ? (
<div className="py-8 text-center border border-dashed border-white/[0.06] rounded-xl text-xs text-zinc-400">
Nenhuma transferência registrada no período.
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-xs">
<thead>
<tr className="border-b border-white/[0.07] text-zinc-400">
<th className="py-2.5 px-3 font-medium">Data</th>
<th className="py-2.5 px-3 font-medium">
ID da Transferência
</th>
<th className="py-2.5 px-3 font-medium text-right">
Valor Solicitado
</th>
<th className="py-2.5 px-3 font-medium text-right">
Taxa
</th>
<th className="py-2.5 px-3 font-medium text-right">
Valor Líquido Recebido
</th>
<th className="py-2.5 px-3 font-medium text-right">
Status
</th>
</tr>
</thead>
<tbody className="divide-y divide-white/[0.04]">
{periodTransfers.map((tr) => {
const badge = getTransferStatusBadge(tr.status);
return (
<tr key={tr.id} className="hover:bg-white/[0.02]">
<td className="py-2.5 px-3 text-zinc-300 tabular-nums">
{formatDateTimeBR(tr.updatedAt || tr.createdAt)}
</td>
<td className="py-2.5 px-3 font-mono text-zinc-300">
{tr.id}
</td>
<td className="py-2.5 px-3 text-right text-zinc-200 tabular-nums">
{formatBRL(tr.amount)}
</td>
<td className="py-2.5 px-3 text-right text-amber-300 tabular-nums">
{formatBRL(tr.feeAmount)}
</td>
<td className="py-2.5 px-3 text-right text-emerald-400 font-semibold tabular-nums">
{formatBRL(tr.receivedAmount)}
</td>
<td className="py-2.5 px-3 text-right">
<span
className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}
>
{badge.label}
</span>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</div>
</div>
)}
{/* ==================== ABA 3: DESPESAS MANUAIS ==================== */}
{activeTab === "expenses" && (
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
{/* Formulário de Cadastro Manual */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4 h-fit">
<div>
<h2 className="text-base font-semibold text-white">
Cadastrar Despesa Manual
</h2>
<p className="text-xs text-zinc-400 mt-1">
Cadastre seus investimentos em Meta Ads, TikTok Ads,
ferramentas e outras despesas sem conectar APIs externas de
anúncios.
</p>
</div>
<form onSubmit={handleAddExpense} className="space-y-3.5">
<div>
<label className="block text-xs text-zinc-300 mb-1">
Categoria da Despesa
</label>
<select
value={expCategory}
onChange={(e) =>
setExpCategory(e.target.value as ExpenseCategory)
}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
{(
Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]
).map((cat) => (
<option key={cat} value={cat}>
{EXPENSE_CATEGORIES[cat].label}
</option>
))}
</select>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Descrição / Campanha / Ferramenta
</label>
<input
type="text"
value={expDescription}
onChange={(e) => setExpDescription(e.target.value)}
placeholder="Ex: Meta Ads - Campanha Produto Principal"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Valor em Reais (R$)
</label>
<input
type="number"
step="0.01"
min="0.01"
value={expAmount}
onChange={(e) => setExpAmount(e.target.value)}
placeholder="0,00"
required
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2.5 text-xs text-white placeholder-zinc-500 tabular-nums focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Data de Competência
</label>
<input
type="date"
value={expDate}
onChange={(e) => setExpDate(e.target.value)}
required
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
/>
</div>
{expenseError && (
<p className="text-xs text-rose-400">{expenseError}</p>
)}
<button
type="submit"
disabled={submittingExpense}
className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs py-2.5 px-4 transition"
>
<Plus className="w-4 h-4" />
<span>
{submittingExpense
? "Salvando..."
: "Salvar Despesa Manual"}
</span>
</button>
</form>
</div>
{/* Listagem de Despesas Cadastradas */}
<div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4">
<div className="flex flex-wrap items-center justify-between gap-2">
<div>
<h3 className="text-base font-semibold text-white">
Despesas Lançadas no Período
</h3>
<p className="text-xs text-zinc-400">
Lucro Estimado = Receita Líquida ({formatBRL(metrics.netRevenue)})
&minus; Despesas ({formatBRL(metrics.totalExpenses)}) ={" "}
<strong className="text-white">
{formatBRL(metrics.estimatedProfit)}
</strong>
</p>
</div>
<div className="text-right">
<span className="text-xs text-zinc-400 block">
Total no período
</span>
<span className="text-base font-bold text-rose-400 tabular-nums">
{formatBRL(metrics.totalExpenses)}
</span>
</div>
</div>
{periodExpenses.length === 0 ? (
<div className="py-12 text-center border border-dashed border-white/[0.06] rounded-xl text-xs text-zinc-400">
Nenhuma despesa cadastrada no período selecionado.
</div>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-xs">
<thead>
<tr className="border-b border-white/[0.07] text-zinc-400">
<th className="py-2.5 px-3 font-medium">Data</th>
<th className="py-2.5 px-3 font-medium">Categoria</th>
<th className="py-2.5 px-3 font-medium">Descrição</th>
<th className="py-2.5 px-3 font-medium text-right">
Valor
</th>
<th className="py-2.5 px-3 font-medium text-right">
Ação
</th>
</tr>
</thead>
<tbody className="divide-y divide-white/[0.04]">
{periodExpenses.map((exp) => {
const catMeta =
EXPENSE_CATEGORIES[exp.category] ||
EXPENSE_CATEGORIES.OTHER;
return (
<tr key={exp.id} className="hover:bg-white/[0.02]">
<td className="py-2.5 px-3 text-zinc-300 tabular-nums whitespace-nowrap">
{formatDateBR(exp.expenseDate)}
</td>
<td className="py-2.5 px-3">
<span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
<span
className="w-2 h-2 rounded-full"
style={{ backgroundColor: catMeta.color }}
/>
{catMeta.label}
</span>
</td>
<td className="py-2.5 px-3 text-zinc-300">
{exp.title}
</td>
<td className="py-2.5 px-3 text-right font-semibold text-rose-400 tabular-nums">
{formatBRL(exp.amount)}
</td>
<td className="py-2.5 px-3 text-right">
<button
type="button"
onClick={() => handleDeleteExpense(exp.id)}
className="inline-flex items-center justify-center p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
title="Excluir despesa"
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
</div>
</div>
)}
{/* ==================== ABA 4: INTEGRAÇÃO & GUIA ==================== */}
{activeTab === "integration" && (
<IntegrationAndGuideTab
integrationStatus={data.integrationStatus}
recentWebhooks={data.recentWebhooks}
onRefreshDashboard={fetchDashboard}
/>
)}
</main>
</div>
);
}
