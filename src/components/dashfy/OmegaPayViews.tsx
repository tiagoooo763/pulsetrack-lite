"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Landmark,
  Lock,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import type {
  BalanceSnapshotRecord,
  TransactionRecord,
  TransferRecord,
} from "@/lib/db";
import {
  formatBRL,
  formatDateTimeBR,
  getPaymentMethodLabel,
  getTransactionStatusMeta,
  getTransferStatusMeta,
} from "@/lib/format";
import { SpotlightCard } from "@/components/SpotlightCard";

interface OmegaPaySalesViewProps {
  transactions: TransactionRecord[];
}

const SALES_PAGE_SIZE = 25;

export function OmegaPaySalesView({ transactions }: OmegaPaySalesViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (status !== "ALL" && tx.status !== status) return false;
      if (method !== "ALL" && tx.paymentMethod !== method) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.productName.toLowerCase().includes(q) ||
        (tx.clientIdentifier && tx.clientIdentifier.toLowerCase().includes(q))
      );
    });
  }, [transactions, search, status, method]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / SALES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * SALES_PAGE_SIZE;
    return filtered.slice(start, start + SALES_PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Vendas &amp; Transações — Gateways de Pagamento
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            {filtered.length} transações encontradas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou produto..."
              className="rounded-xl border border-blue-200/12 bg-[#050b18] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-1.5 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
          >
            <option value="ALL">Todos métodos</option>
            <option value="PIX">PIX</option>
            <option value="CREDIT_CARD">Cartão de Crédito</option>
            <option value="BOLETO">Boleto</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-1.5 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
          >
            <option value="ALL">Todos status</option>
            <option value="COMPLETED">Aprovadas</option>
            <option value="PENDING">Pendentes</option>
            <option value="REFUNDED">Reembolsadas</option>
            <option value="CANCELED">Canceladas</option>
            <option value="CHARGED_BACK">Chargeback</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-blue-200/12 text-xs text-slate-400">
          Nenhuma venda OmegaPay encontrada para os filtros aplicados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-blue-200/10">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-blue-200/12 bg-[#050b18] text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 font-semibold">Data</th>
                <th className="py-2.5 px-3 font-semibold">Produto</th>
                <th className="py-2.5 px-3 font-semibold">ID Transação</th>
                <th className="py-2.5 px-3 font-semibold">Método</th>
                <th className="py-2.5 px-3 font-semibold text-right">Bruto</th>
                <th className="py-2.5 px-3 font-semibold text-right">Taxa</th>
                <th className="py-2.5 px-3 font-semibold text-right">Líquido</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
              {paginatedRows.map((tx) => {
                const meta = getTransactionStatusMeta(tx.status);
                return (
                  <tr key={tx.id} className="hover:bg-[#1d74ff]/[0.06]">
                    <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">
                      {formatDateTimeBR(tx.paidAt || tx.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium max-w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{tx.productName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border shrink-0 ${
                            tx.gateway === "NEXUS"
                              ? "border-sky-500/35 bg-sky-500/15 text-sky-200"
                              : "border-blue-200/12 bg-white/[0.05] text-slate-300"
                          }`}
                        >
                          {tx.gateway}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {tx.orderId || tx.id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {getPaymentMethodLabel(tx.paymentMethod)}
                      {tx.installments > 1 ? ` (${tx.installments}x)` : ""}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                      {formatBRL(tx.grossAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400/90 font-mono">
                      -{formatBRL(tx.feeAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-mono font-semibold">
                      {formatBRL(tx.netAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-blue-200/12 bg-[#050b18] text-xs text-slate-400">
              <span className="font-mono">
                Página {safePage} de {totalPages} ({filtered.length} vendas)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-blue-200/12 bg-white/[0.04] hover:bg-white/[0.08] text-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-blue-200/12 bg-white/[0.04] hover:bg-white/[0.08] text-white disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SpotlightCard>
  );
}

interface OmegaPayReceivablesViewProps {
  transfers: TransferRecord[];
}

export function OmegaPayReceivablesView({ transfers }: OmegaPayReceivablesViewProps) {
  const completedTotal = transfers
    .filter((t) => t.status === "COMPLETED")
    .reduce((a, t) => a + t.receivedAmount, 0);
  const pendingTotal = transfers
    .filter((t) => t.status === "PENDING" || t.status === "PROCESSING")
    .reduce((a, t) => a + t.amount, 0);
  const totalFees = transfers.reduce((a, t) => a + t.feeAmount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Total Recebido</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono text-emerald-400">
            {formatBRL(completedTotal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Saques concluídos na OmegaPay</div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Em Processamento</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono text-white">
            {formatBRL(pendingTotal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Transferências pendentes</div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Taxas de Saque</span>
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <div className="mt-2.5 text-2xl font-bold font-mono text-slate-200">
            {formatBRL(totalFees)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{transfers.length} transferências</div>
        </SpotlightCard>
      </div>

      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Histórico de Recebimentos &amp; Saques
          </h3>
          <p className="text-xs text-slate-400">
            Eventos oficiais TRANSFER_CREATED, TRANSFER_COMPLETED e TRANSFER_FAILED
          </p>
        </div>

        {transfers.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-blue-200/12 text-xs text-slate-400">
            Nenhum saque ou transferência recebida no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-blue-200/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-200/12 bg-[#050b18] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">ID Transferência</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Solicitado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Taxa</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Recebido</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/[0.06] bg-[#0a1529]">
                {transfers.map((tf) => {
                  const meta = getTransferStatusMeta(tf.status);
                  return (
                    <tr key={tf.id} className="hover:bg-[#1d74ff]/[0.06]">
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {formatDateTimeBR(tf.updatedAt || tf.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white">{tf.id}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatBRL(tf.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {formatBRL(tf.feeAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                        {formatBRL(tf.receivedAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
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

interface OmegaPayBalanceViewProps {
  balance: BalanceSnapshotRecord | null;
  syncEnabled: boolean;
  syncingBalance: boolean;
  onSyncBalance: () => Promise<void>;
}

export function OmegaPayBalanceView({
  balance,
  syncEnabled,
  syncingBalance,
  onSyncBalance,
}: OmegaPayBalanceViewProps) {
  const [lookupType, setLookupType] = useState<"transaction" | "transfer">("transaction");
  const [lookupField, setLookupField] = useState<"id" | "clientIdentifier">("id");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const available = balance?.available ?? 0;
  const pending = balance?.pending ?? 0;
  const fundLock = balance?.fundLock ?? 0;
  const total = available + pending + fundLock;

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch("/api/omegapay/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: lookupType,
          field: lookupField,
          value: lookupValue.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setLookupError(json.error || "Registro não encontrado na OmegaPay.");
      } else {
        setLookupResult(json.data);
      }
    } catch {
      setLookupError("Erro ao consultar API da OmegaPay.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Disponível para Saque</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
            {formatBRL(available)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Liberado na OmegaPay</div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Saldo Pendente</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono text-white">
            {formatBRL(pending)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Aguardando liquidação</div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
            <span>Reserva / Retido</span>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono text-slate-200">
            {formatBRL(fundLock)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Fund lock / garantia</div>
        </SpotlightCard>

        <SpotlightCard className="p-5 bento-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold">
              <span>Saldo Total OmegaPay</span>
              <Landmark className="w-4 h-4 text-white" />
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold font-mono text-white">
              {formatBRL(total)}
            </div>
          </div>
          <button
            type="button"
            onClick={onSyncBalance}
            disabled={syncingBalance || !syncEnabled}
            className="btn-pressable mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white shadow-[0_8px_22px_-6px_rgba(29,116,255,0.52)] text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingBalance ? "animate-spin" : ""}`} />
            <span>
              {syncingBalance ? "Sincronizando..." : "Atualizar Saldo via API"}
            </span>
          </button>
        </SpotlightCard>
      </div>

      {/* Consulta Pontual Oficial OmegaPay */}
      <SpotlightCard className="p-5 sm:p-6 bento-card space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Consulta Pontual na API OmegaPay (GET)
          </h3>
          <p className="text-xs text-slate-400">
            Consulte uma transação ou transferência específica diretamente na OmegaPay sem polling contínuo.
            {balance?.fetchedAt && (
              <span className="ml-2 text-slate-300 font-mono">
                Última atualização de saldo: {formatDateTimeBR(balance.fetchedAt)}
              </span>
            )}
          </p>
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={lookupType}
            onChange={(e) => setLookupType(e.target.value as "transaction" | "transfer")}
            className="rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
          >
            <option value="transaction">Transação (/gateway/transactions)</option>
            <option value="transfer">Transferência (/gateway/transfers)</option>
          </select>
          <select
            value={lookupField}
            onChange={(e) => setLookupField(e.target.value as "id" | "clientIdentifier")}
            className="rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
          >
            <option value="id">Por ID</option>
            <option value="clientIdentifier">Por clientIdentifier</option>
          </select>
          <input
            type="text"
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            placeholder="Digite o ID..."
            className="rounded-xl border border-blue-200/12 bg-[#050b18] px-3 py-2 text-xs text-white font-mono focus:border-[#3b8bff] focus:ring-2 focus:ring-[#1d74ff]/20 focus:outline-none"
          />
          <button
            type="submit"
            disabled={lookupLoading}
            className="btn-pressable inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white shadow-[0_8px_22px_-6px_rgba(29,116,255,0.52)] text-xs font-semibold py-2 px-4 disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{lookupLoading ? "Consultando..." : "Consultar API"}</span>
          </button>
        </form>

        {lookupError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {lookupError}
          </div>
        )}
        {lookupResult && (
          <pre className="rounded-xl border border-blue-200/12 bg-[#050b18] p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
            {JSON.stringify(lookupResult, null, 2)}
          </pre>
        )}
      </SpotlightCard>
    </div>
  );
}
