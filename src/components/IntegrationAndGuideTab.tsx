"use client";
import React, { useState } from "react";
import type { WebhookEventRecord } from "@/lib/db";
import type { OmegaPayCredentialsResponse } from "@/lib/omegapay-types";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import {
CheckCircle2,
Copy,
KeyRound,
Search,
Send,
ShieldCheck,
Terminal,
BookOpen,
AlertTriangle,
RefreshCw,
} from "lucide-react";
interface IntegrationStatus {
hasApiCredentials: boolean;
hasWebhookToken: boolean;
source: string;
apiBaseUrl: string;
isDefaultPassword: boolean;
}
interface IntegrationAndGuideTabProps {
integrationStatus: IntegrationStatus;
recentWebhooks: WebhookEventRecord[];
onRefreshDashboard: () => Promise<void>;
}
export function IntegrationAndGuideTab({
integrationStatus,
recentWebhooks,
onRefreshDashboard,
}: IntegrationAndGuideTabProps) {
// Formulário de credenciais (apenas envio ao servidor)
const [publicKey, setPublicKey] = useState("");
const [secretKey, setSecretKey] = useState("");
const [webhookToken, setWebhookToken] = useState("");
const [dashboardPassword, setDashboardPassword] = useState("");
const [savingCreds, setSavingCreds] = useState(false);
const [credsFeedback, setCredsFeedback] = useState<{
type: "success" | "error";
text: string;
} | null>(null);
// Teste de credenciais (GET /gateway/producer/credentials)
const [testingCreds, setTestingCreds] = useState(false);
const [credTestResult, setCredTestResult] =
useState<OmegaPayCredentialsResponse | null>(null);
const [credTestError, setCredTestError] = useState<string | null>(null);
// Consulta pontual de transação / transferência (GET /gateway/transactions e GET /gateway/transfers)
const [lookupType, setLookupType] = useState<"transaction" | "transfer">(
"transaction"
);
const [lookupField, setLookupField] = useState<"id" | "clientIdentifier">(
"id"
);
const [lookupValue, setLookupValue] = useState("");
const [lookupLoading, setLookupLoading] = useState(false);
const [lookupResult, setLookupResult] = useState<Record<
string,
unknown
> | null>(null);
const [lookupError, setLookupError] = useState<string | null>(null);
// Simulador oficial de Webhook
const [simEvent, setSimEvent] = useState("TRANSACTION_PAID");
const [simTxId, setSimTxId] = useState("1pned18asp");
const [simProduct, setSimProduct] = useState("Mentoria PulseTrack Pro");
const [simGross, setSimGross] = useState("297.00");
const [simFee, setSimFee] = useState("14.85");
const [simMethod, setSimMethod] = useState("PIX");
const [simLoading, setSimLoading] = useState(false);
const [simFeedback, setSimFeedback] = useState<string | null>(null);
const [copiedUrl, setCopiedUrl] = useState(false);
const webhookEndpointUrl =
typeof window !== "undefined"
? `${window.location.origin}/api/webhooks/omegapay`
: "https://seu-dominio.vercel.app/api/webhooks/omegapay";
async function handleSaveCredentials(e: React.FormEvent) {
e.preventDefault();
setSavingCreds(true);
setCredsFeedback(null);
try {
const res = await fetch("/api/settings", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
action: "save_credentials",
publicKey,
secretKey,
webhookToken,
dashboardPassword,
}),
});
const data = await res.json();
if (!res.ok) {
setCredsFeedback({
type: "error",
text: data.error || "Erro ao salvar configurações.",
});
} else {
setPublicKey("");
setSecretKey("");
setWebhookToken("");
setDashboardPassword("");
setCredsFeedback({
type: "success",
text: "Credenciais armazenadas exclusivamente no servidor com sucesso.",
});
await onRefreshDashboard();
}
} catch {
setCredsFeedback({
type: "error",
text: "Falha de comunicação com o servidor.",
});
} finally {
setSavingCreds(false);
}
}
async function handleTestCredentials() {
setTestingCreds(true);
setCredTestError(null);
setCredTestResult(null);
try {
const res = await fetch("/api/omegapay/credentials", {
method: "POST",
});
const data = await res.json();
if (!res.ok || !data.ok) {
setCredTestError(
data.error || "Credenciais inválidas ou sem comunicação com a OmegaPay."
);
} else {
setCredTestResult(data.credentials);
}
} catch {
setCredTestError("Erro ao executar teste de credenciais.");
} finally {
setTestingCreds(false);
}
}
async function handleLookup(e: React.FormEvent) {
e.preventDefault();
if (!lookupValue.trim()) return;
setLookupLoading(true);
setLookupError(null);
setLookupResult(null);
try {
const params = new URLSearchParams({
type: lookupType,
[lookupField]: lookupValue.trim(),
sync: "true",
});
const res = await fetch(`/api/omegapay/lookup?${params.toString()}`);
const data = await res.json();
if (!res.ok || !data.ok) {
setLookupError(
data.error || "Registro não encontrado ou erro na consulta."
);
} else {
setLookupResult(data.result);
await onRefreshDashboard();
}
} catch {
setLookupError("Erro ao consultar endpoint oficial da OmegaPay.");
} finally {
setLookupLoading(false);
}
}
async function handleSimulateWebhook(e: React.FormEvent) {
e.preventDefault();
setSimLoading(true);
setSimFeedback(null);
try {
const res = await fetch("/api/settings", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
action: "simulate_webhook",
event: simEvent,
transactionId: simTxId.trim() || "1pned18asp",
transferId: simTxId.trim() || "wth_01",
productName: simProduct.trim() || "Mentoria PulseTrack Pro",
grossAmount: Number(simGross) || 297,
feeAmount: Number(simFee) || 14.85,
paymentMethod: simMethod,
}),
});
const data = await res.json();
if (!res.ok || !data.ok) {
setSimFeedback(
`Erro: ${data.error || data.result?.error || "Falha ao simular"}`
);
} else if (data.result?.duplicate) {
setSimFeedback(
`Idempotência confirmada: o evento ${simEvent} para o ID "${simTxId}" já havia sido processado e não foi duplicado (HTTP 200).`
);
} else {
setSimFeedback(
`Evento ${simEvent} processado com sucesso para o ID "${simTxId}" -> Status atual: ${data.result?.statusAfter} (HTTP 200).`
);
await onRefreshDashboard();
}
} catch {
setSimFeedback("Erro ao disparar simulação de webhook.");
} finally {
setSimLoading(false);
}
}
function copyWebhookUrl() {
if (typeof navigator !== "undefined") {
navigator.clipboard.writeText(webhookEndpointUrl);
setCopiedUrl(true);
setTimeout(() => setCopiedUrl(false), 2500);
}
}
return (
<div className="space-y-6">
{/* URL do Endpoint de Webhook + Status */}
<div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-[#11141d] to-[#11141d] p-5 sm:p-6">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
<span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
Endpoint Oficial Receptor de Webhooks (HTTP POST &bull; JSON)
</span>
</div>
<h2 className="text-base sm:text-lg font-semibold text-white mt-1">
Cadastre esta URL em <code className="text-emerald-300">Configurações &gt; Webhooks</code> no painel da OmegaPay
</h2>
<p className="text-xs text-zinc-400 mt-1">
Valida automaticamente <code className="text-zinc-300">payload.token</code>, impede duplicações por chave de idempotência e retorna <code className="text-zinc-300">HTTP 200 OK</code>.
</p>
</div>
<div className="flex items-center gap-2 bg-[#090b10] border border-white/10 rounded-xl p-2 pl-3.5">
<code className="text-xs text-emerald-300 font-mono truncate max-w-[260px] sm:max-w-[380px]">
{webhookEndpointUrl}
</code>
<button
type="button"
onClick={copyWebhookUrl}
className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium transition shrink-0"
>
{copiedUrl ? (
<>
<CheckCircle2 className="w-3.5 h-3.5" />
<span>Copiado!</span>
</>
) : (
<>
<Copy className="w-3.5 h-3.5" />
<span>Copiar URL</span>
</>
)}
</button>
</div>
</div>
</div>
{/* Grid: Configuração de Credenciais + Consultas Pontuais na API Oficial */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
{/* Card 1: Credenciais no Servidor & Teste de Credenciais */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-5">
<div className="flex items-start justify-between gap-3">
<div className="flex items-center gap-2.5">
<div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
<KeyRound className="w-4 h-4 text-emerald-400" />
</div>
<div>
<h3 className="text-sm font-semibold text-white">
Credenciais no Servidor &amp; Teste Oficial
</h3>
<p className="text-xs text-zinc-400">
Base URL oficial: <code className="text-zinc-300">{integrationStatus.apiBaseUrl}</code>
</p>
</div>
</div>
<button
type="button"
onClick={handleTestCredentials}
disabled={testingCreds}
className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3 py-2 text-xs font-medium text-zinc-200 transition"
>
<RefreshCw
className={`w-3.5 h-3.5 ${testingCreds ? "animate-spin text-emerald-400" : "text-zinc-400"}`}
/>
<span>Testar Credenciais (GET)</span>
</button>
</div>
{/* Status atual das chaves */}
<div className="grid grid-cols-2 gap-3 text-xs">
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-3">
<span className="text-zinc-400 block">Chaves da API (GET)</span>
<span
className={`font-semibold mt-1 inline-block ${
integrationStatus.hasApiCredentials
? "text-emerald-400"
: "text-amber-400"
}`}
>
{integrationStatus.hasApiCredentials
? "Configuradas no servidor"
: "Pendentes de configuração"}
</span>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-3">
<span className="text-zinc-400 block">Token do Webhook</span>
<span
className={`font-semibold mt-1 inline-block ${
integrationStatus.hasWebhookToken
? "text-emerald-400"
: "text-amber-400"
}`}
>
{integrationStatus.hasWebhookToken
? "Configurado no servidor"
: "Pendente de configuração"}
</span>
</div>
</div>
{/* Resultado do endpoint GET /gateway/producer/credentials */}
{credTestResult && (
<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs space-y-1.5">
<div className="font-semibold text-emerald-300 flex items-center gap-1.5">
<CheckCircle2 className="w-4 h-4" />
<span>
Credencial Válida: {credTestResult.name}
</span>
</div>
<p className="text-zinc-300">
<strong>Acesso Total (`grantAllPermissions`):</strong>{" "}
{credTestResult.grantAllPermissions ? "Sim" : "Não"}
</p>
<p className="text-zinc-300">
<strong>Permissões (`permissions`):</strong>{" "}
{credTestResult.permissions.length > 0
? credTestResult.permissions.join(", ")
: "Nenhuma específica listada"}
</p>
<p className="text-zinc-400">
<strong>Expira em (`expiresAt`):</strong>{" "}
{credTestResult.expiresAt
? formatDateTimeBR(credTestResult.expiresAt)
: "Sem expiração"}
</p>
</div>
)}
{credTestError && (
<div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
<strong>Retorno de `/gateway/producer/credentials`:</strong>{" "}
{credTestError}
</div>
)}
{credsFeedback && (
<div
className={`rounded-xl border p-3 text-xs ${
credsFeedback.type === "success"
? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
: "border-rose-500/30 bg-rose-500/10 text-rose-300"
}`}
>
{credsFeedback.text}
</div>
)}
<form onSubmit={handleSaveCredentials} className="space-y-3">
<div>
<label className="block text-xs text-zinc-300 mb-1">
Chave Pública da API (<code className="text-emerald-400">x-public-key</code>)
</label>
<input
type="password"
value={publicKey}
onChange={(e) => setPublicKey(e.target.value)}
placeholder="Deixe em branco para manter a atual"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Chave Secreta da API (<code className="text-emerald-400">x-secret-key</code>)
</label>
<input
type="password"
value={secretKey}
onChange={(e) => setSecretKey(e.target.value)}
placeholder="Deixe em branco para manter a atual"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Token de Validação do Webhook (<code className="text-emerald-400">payload.token</code>)
</label>
<input
type="password"
value={webhookToken}
onChange={(e) => setWebhookToken(e.target.value)}
placeholder="Token exclusivo gerado no painel da OmegaPay (separe por vírgula se tiver mais de um)"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Nova Senha de Acesso ao Painel PulseTrack (Opcional)
</label>
<input
type="password"
value={dashboardPassword}
onChange={(e) => setDashboardPassword(e.target.value)}
placeholder="Mínimo de 6 caracteres"
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
</div>
<button
type="submit"
disabled={savingCreds}
className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs py-2.5 px-4 transition"
>
{savingCreds
? "Salvando no Servidor..."
: "Salvar Credenciais no Servidor"}
</button>
</form>
</div>
{/* Card 2: Consultas Pontuais à API (Buscar transação & Buscar transferência) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-5 flex flex-col justify-between">
<div className="space-y-4">
<div className="flex items-center gap-2.5">
<div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
<Search className="w-4 h-4 text-sky-400" />
</div>
<div>
<h3 className="text-sm font-semibold text-white">
Consulta Pontual de Transação ou Transferência (GET)
</h3>
<p className="text-xs text-zinc-400">
Sem polling automático — consulta sob demanda e sincroniza sem duplicar
</p>
</div>
</div>
<form onSubmit={handleLookup} className="space-y-3">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div>
<label className="block text-xs text-zinc-300 mb-1">
Recurso Oficial da Documentação
</label>
<select
value={lookupType}
onChange={(e) =>
setLookupType(e.target.value as "transaction" | "transfer")
}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
<option value="transaction">
Buscar transação — GET /gateway/transactions
</option>
<option value="transfer">
Buscar transferência — GET /gateway/transfers
</option>
</select>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Parâmetro Oficial de Query
</label>
<select
value={lookupField}
onChange={(e) =>
setLookupField(e.target.value as "id" | "clientIdentifier")
}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
<option value="id">id (ID da OmegaPay)</option>
<option value="clientIdentifier">
clientIdentifier (Seu Identificador)
</option>
</select>
</div>
</div>
<div className="flex gap-2">
<input
type="text"
value={lookupValue}
onChange={(e) => setLookupValue(e.target.value)}
placeholder={
lookupField === "id"
? "Ex: cmry2h8332sgs3ub44fh7"
: "Ex: 5286-412312-asd-123"
}
className="flex-1 rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
/>
<button
type="submit"
disabled={lookupLoading}
className="rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs px-4 py-2 transition shrink-0"
>
{lookupLoading ? "Buscando..." : "Consultar na API"}
</button>
</div>
</form>
{lookupError && (
<div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
{lookupError}
</div>
)}
{lookupResult && (
<div className="rounded-xl border border-white/10 bg-[#0b0d14] p-3.5 space-y-2">
<div className="flex items-center justify-between text-xs">
<span className="text-emerald-400 font-semibold">
Resposta Oficial Sanitizada (Sincronizada no Banco)
</span>
<span className="text-zinc-500 font-mono">
ID: {String(lookupResult.id || "—")}
</span>
</div>
<pre className="text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-48">
{JSON.stringify(lookupResult, null, 2)}
</pre>
</div>
)}
</div>
<div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/20 p-3.5 text-[11px] text-amber-200/90 flex items-start gap-2.5">
<AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
<div>
<strong>Aviso Oficial da Documentação OmegaPay:</strong> As rotas{" "}
<code>GET /gateway/transactions</code> e{" "}
<code>GET /gateway/transfers</code> não devem ser usadas para
polling frequente (sob pena de bloqueio anti-polling). O
PulseTrack Lite utiliza webhooks em tempo real e reserva estas
rotas apenas para conferência pontual. A rota{" "}
<code>GET /gateway/transfers</code> exige que o módulo de
transferências via API esteja ativo na sua conta junto ao suporte.
</div>
</div>
</div>
</div>
{/* Simulador Oficial de Webhooks OmegaPay */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4">
<div className="flex items-center gap-2.5">
<div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
<Terminal className="w-4 h-4 text-purple-400" />
</div>
<div>
<h3 className="text-sm font-semibold text-white">
Testador Local de Notificações Webhook (Estrutura Oficial OmegaPay)
</h3>
<p className="text-xs text-zinc-400">
Dispara um payload idêntico ao da documentação oficial para validar criação, aprovação, reembolso, cancelamento, transferência e idempotência.
</p>
</div>
</div>
<form
onSubmit={handleSimulateWebhook}
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
>
<div className="sm:col-span-2">
<label className="block text-xs text-zinc-300 mb-1">
Evento Oficial OmegaPay (<code className="text-purple-300">event</code>)
</label>
<select
value={simEvent}
onChange={(e) => setSimEvent(e.target.value)}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
<optgroup label="Webhooks de Pagamento (/docs/v1/webhooks/payment)">
<option value="TRANSACTION_CREATED">
TRANSACTION_CREATED (Transação criada)
</option>
<option value="TRANSACTION_PAID">
TRANSACTION_PAID (Pagamento concluído)
</option>
<option value="TRANSACTION_CANCELED">
TRANSACTION_CANCELED (Cancelamento)
</option>
<option value="TRANSACTION_REFUNDED">
TRANSACTION_REFUNDED (Reembolso / Estorno)
</option>
<option value="TRANSACTION_CHARGED_BACK">
TRANSACTION_CHARGED_BACK (Chargeback / Contestação)
</option>
</optgroup>
<optgroup label="Webhooks de Transferência (/docs/v1/webhooks/transfer)">
<option value="TRANSFER_CREATED">
TRANSFER_CREATED (Transferência solicitada)
</option>
<option value="TRANSFER_COMPLETED">
TRANSFER_COMPLETED (Transferência concluída)
</option>
<option value="TRANSFER_FAILED">
TRANSFER_FAILED (Transferência falhou/cancelada)
</option>
</optgroup>
</select>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
ID da Transação / Saque
</label>
<input
type="text"
value={simTxId}
onChange={(e) => setSimTxId(e.target.value)}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Produto / Descrição
</label>
<input
type="text"
value={simProduct}
onChange={(e) => setSimProduct(e.target.value)}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
/>
</div>
<div className="grid grid-cols-2 gap-2">
<div>
<label className="block text-xs text-zinc-300 mb-1">
Bruto (R$)
</label>
<input
type="number"
step="0.01"
value={simGross}
onChange={(e) => setSimGross(e.target.value)}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-2.5 py-2 text-xs text-white tabular-nums focus:border-emerald-500 focus:outline-none"
/>
</div>
<div>
<label className="block text-xs text-zinc-300 mb-1">
Taxa (R$)
</label>
<input
type="number"
step="0.01"
value={simFee}
onChange={(e) => setSimFee(e.target.value)}
className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-2.5 py-2 text-xs text-white tabular-nums focus:border-emerald-500 focus:outline-none"
/>
</div>
</div>
<div className="flex gap-2">
<select
value={simMethod}
onChange={(e) => setSimMethod(e.target.value)}
className="rounded-xl border border-white/10 bg-[#0b0d14] px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
>
<option value="PIX">PIX</option>
<option value="CREDIT_CARD">Cartão</option>
<option value="BOLETO">Boleto</option>
</select>
<button
type="submit"
disabled={simLoading}
className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs py-2 px-3 transition"
>
<Send className="w-3.5 h-3.5" />
<span>{simLoading ? "..." : "Disparar"}</span>
</button>
</div>
</form>
{simFeedback && (
<div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 py-2.5 text-xs text-purple-200">
{simFeedback}
</div>
)}
</div>
{/* Últimos Eventos de Webhook Recebidos (Sanitizados) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-4">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<ShieldCheck className="w-4 h-4 text-emerald-400" />
<h3 className="text-sm font-semibold text-white">
Registro Auditável de Webhooks Recebidos (Sem CPF, Telefone, Dados Bancários ou Tokens)
</h3>
</div>
<span className="text-xs text-zinc-500">
Últimos {recentWebhooks.length} eventos
</span>
</div>
{recentWebhooks.length === 0 ? (
<p className="text-xs text-zinc-500 py-4 text-center border border-dashed border-white/[0.06] rounded-xl">
Nenhum evento de webhook registrado ainda.
</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-xs">
<thead>
<tr className="border-b border-white/[0.06] text-zinc-400">
<th className="py-2.5 px-3 font-medium">Recebido em</th>
<th className="py-2.5 px-3 font-medium">Evento Oficial</th>
<th className="py-2.5 px-3 font-medium">ID da Entidade</th>
<th className="py-2.5 px-3 font-medium">Status Resultante</th>
<th className="py-2.5 px-3 font-medium">Chave de Idempotência</th>
</tr>
</thead>
<tbody className="divide-y divide-white/[0.04]">
{recentWebhooks.map((ev) => (
<tr key={ev.id} className="hover:bg-white/[0.02]">
<td className="py-2.5 px-3 text-zinc-400 tabular-nums whitespace-nowrap">
{formatDateTimeBR(ev.receivedAt)}
</td>
<td className="py-2.5 px-3 font-mono text-emerald-300">
{ev.eventType}
</td>
<td className="py-2.5 px-3 font-mono text-zinc-200">
{ev.entityId}
</td>
<td className="py-2.5 px-3 font-mono text-zinc-300">
{ev.statusAfter || "—"}
</td>
<td className="py-2.5 px-3 font-mono text-zinc-500 truncate max-w-[240px]">
{ev.dedupeKey}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
{/* Guia Passo a Passo Oficial (Seção 8) */}
<div className="rounded-2xl border border-white/[0.07] bg-[#11141d] p-5 sm:p-6 space-y-5">
<div className="flex items-center gap-2.5">
<div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
<BookOpen className="w-4 h-4 text-emerald-400" />
</div>
<div>
<h3 className="text-base font-semibold text-white">
Guia Passo a Passo: Publicação e Integração Oficial com a OmegaPay
</h3>
<p className="text-xs text-zinc-400">
Instruções verificadas conforme a documentação oficial em{" "}
<code className="text-zinc-300">app.omegapayments.com.br/docs/v1</code>
</p>
</div>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
1. Publicar a Aplicação (HTTPS Gratuito)
</span>
<p className="text-zinc-400 leading-relaxed">
Suba este repositório no GitHub e conecte-o à <strong>Vercel</strong> (plano Hobby gratuito, com HTTPS automático). Para persistência em nuvem serverless gratuita, crie um banco gratuito no <strong>Turso (LibSQL)</strong> ou <strong>Neon / Supabase (PostgreSQL)</strong> e configure <code>DATABASE_URL</code> nas variáveis de ambiente da Vercel.
</p>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
2. Configurar as Credenciais no Servidor
</span>
<p className="text-zinc-400 leading-relaxed">
No painel da OmegaPay, gere ou copie seu par de chaves de API do produtor (<code>x-public-key</code> e <code>x-secret-key</code>). Configure-as nas variáveis de ambiente (<code>OMEGAPAY_PUBLIC_KEY</code> e <code>OMEGAPAY_SECRET_KEY</code>) ou salve-as no formulário seguro acima. Defina também <code>DASHBOARD_PASSWORD</code> e <code>AUTH_SECRET</code>.
</p>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
3. Criar um Novo Webhook no Painel da OmegaPay
</span>
<p className="text-zinc-400 leading-relaxed">
Acesse <code className="text-zinc-200">app.omegapayments.com.br</code>, navegue até{" "}
<code className="text-zinc-200">Configurações &gt; Webhooks</code> e clique em{" "}
<strong>Criar</strong> (não altere nem remova webhooks existentes de outras ferramentas). Informe o título <em>&ldquo;PulseTrack Lite&rdquo;</em> e a URL alvo:{" "}
<code className="text-emerald-300">https://SEU-DOMINIO/api/webhooks/omegapay</code>.
</p>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
4. Selecionar os Produtos e Eventos Oficiais
</span>
<p className="text-zinc-400 leading-relaxed">
Selecione todos os produtos que deseja acompanhar e marque os eventos oficiais de transação:{" "}
<code className="text-zinc-200">TRANSACTION_CREATED</code>,{" "}
<code className="text-zinc-200">TRANSACTION_PAID</code>,{" "}
<code className="text-zinc-200">TRANSACTION_CANCELED</code>,{" "}
<code className="text-zinc-200">TRANSACTION_REFUNDED</code> e{" "}
<code className="text-zinc-200">TRANSACTION_CHARGED_BACK</code> (e opcionalmente{" "}
<code className="text-zinc-200">TRANSFER_CREATED</code>,{" "}
<code className="text-zinc-200">TRANSFER_COMPLETED</code>,{" "}
<code className="text-zinc-200">TRANSFER_FAILED</code>). Copie o <strong>Token de Validação</strong> gerado e salve em <code>OMEGAPAY_WEBHOOK_TOKEN</code>.
</p>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
5. Testar Notificações
</span>
<p className="text-zinc-400 leading-relaxed">
Use o <strong>Testador Local</strong> acima ou envie um POST real para <code>/api/webhooks/omegapay</code> contendo o <code>token</code> cadastrado. Verifique na tabela de Auditoria de Webhooks se o status retornou <code>200 OK</code> e se o reenvio do mesmo payload é bloqueado por idempotência.
</p>
</div>
<div className="rounded-xl bg-[#0b0d14] border border-white/[0.06] p-4 space-y-2">
<span className="text-emerald-400 font-semibold">
6. Conferir Saldo e Vendas
</span>
<p className="text-zinc-400 leading-relaxed">
Clique em <strong>&ldquo;Testar Credenciais (GET)&rdquo;</strong> para validar sua chave em <code>/gateway/producer/credentials</code> e depois em <strong>&ldquo;Atualizar Saldo OmegaPay&rdquo;</strong> no topo do dashboard para buscar <code>available</code> (disponível), <code>pending</code> (pendente) e <code>fundLock</code> (retido) em <code>/gateway/producer/balance</code>.
</p>
</div>
</div>
</div>
</div>
);
}
