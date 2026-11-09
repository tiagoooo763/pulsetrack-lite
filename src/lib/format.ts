import type { ExpenseCategory } from "./db";
import type {
  OmegaPayTransactionStatus,
  OmegaPayTransferStatus,
} from "./omegapay-types";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "R$ 0,00";
  return brlFormatter.format(num);
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function getTransactionStatusMeta(status: OmegaPayTransactionStatus | string): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Aprovada",
        badgeClass: "bg-white/[0.04] text-zinc-200 border-white/15",
        dotClass: "bg-emerald-400",
      };
    case "PENDING":
      return {
        label: "Pendente",
        badgeClass: "bg-white/[0.03] text-zinc-300 border-white/10",
        dotClass: "bg-amber-400",
      };
    case "REFUNDED":
      return {
        label: "Reembolsada",
        badgeClass: "bg-white/[0.03] text-zinc-400 border-white/10",
        dotClass: "bg-rose-400",
      };
    case "CANCELED":
      return {
        label: "Cancelada",
        badgeClass: "bg-white/[0.02] text-zinc-400 border-white/10",
        dotClass: "bg-zinc-500",
      };
    case "CHARGED_BACK":
      return {
        label: "Chargeback",
        badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/20",
        dotClass: "bg-rose-400",
      };
    case "FAILED":
      return {
        label: "Falhou",
        badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/20",
        dotClass: "bg-rose-400",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-white/[0.02] text-zinc-400 border-white/10",
        dotClass: "bg-zinc-500",
      };
  }
}

export function getTransferStatusMeta(status: OmegaPayTransferStatus | string): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Transferido",
        badgeClass: "bg-white/[0.04] text-zinc-200 border-white/15",
      };
    case "PENDING":
    case "PROCESSING":
    case "TRANSFERRING":
      return {
        label: status === "PENDING" ? "Aguardando" : "Processando",
        badgeClass: "bg-white/[0.03] text-zinc-300 border-white/10",
      };
    case "CANCELED":
    case "FAILED":
      return {
        label: status === "CANCELED" ? "Cancelada" : "Falhou",
        badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/20",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-white/[0.02] text-zinc-400 border-white/10",
      };
  }
}

export function getTransactionStatusBadge(
  status: OmegaPayTransactionStatus | string
): { label: string; className: string } {
  const meta = getTransactionStatusMeta(status);
  return { label: meta.label, className: meta.badgeClass };
}

export function getTransferStatusBadge(
  status: OmegaPayTransferStatus | string
): { label: string; className: string } {
  const meta = getTransferStatusMeta(status);
  return { label: meta.label, className: meta.badgeClass };
}

export function getPaymentMethodLabel(method: string): string {
  switch (method?.toUpperCase()) {
    case "PIX":
      return "PIX";
    case "CREDIT_CARD":
      return "Cartão de Crédito";
    case "BOLETO":
      return "Boleto";
    case "CRYPTO":
      return "Cripto";
    default:
      return method || "PIX";
  }
}

export const EXPENSE_CATEGORIES: Record<
  ExpenseCategory,
  { label: string; isAdSpend: boolean; color: string; badgeClass: string }
> = {
  META_ADS: {
    label: "Meta Ads",
    isAdSpend: true,
    color: "#e4e4e7",
    badgeClass: "bg-white/[0.04] text-zinc-200 border-white/10",
  },
  TIKTOK_ADS: {
    label: "TikTok Ads",
    isAdSpend: true,
    color: "#a1a1aa",
    badgeClass: "bg-white/[0.04] text-zinc-200 border-white/10",
  },
  OTHER_ADS: {
    label: "Outros Anúncios",
    isAdSpend: true,
    color: "#71717a",
    badgeClass: "bg-white/[0.04] text-zinc-300 border-white/10",
  },
  TOOLS: {
    label: "Ferramentas & SaaS",
    isAdSpend: false,
    color: "#52525b",
    badgeClass: "bg-white/[0.04] text-zinc-300 border-white/10",
  },
  OTHER: {
    label: "Outras Despesas",
    isAdSpend: false,
    color: "#3f3f46",
    badgeClass: "bg-white/[0.04] text-zinc-400 border-white/10",
  },
};
