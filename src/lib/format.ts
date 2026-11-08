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
        badgeClass:
          "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
        dotClass: "bg-emerald-400",
      };
    case "PENDING":
      return {
        label: "Pendente",
        badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
        dotClass: "bg-amber-400",
      };
    case "REFUNDED":
      return {
        label: "Reembolsada",
        badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/25",
        dotClass: "bg-sky-400",
      };
    case "CANCELED":
      return {
        label: "Cancelada",
        badgeClass: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
        dotClass: "bg-zinc-400",
      };
    case "CHARGED_BACK":
      return {
        label: "Chargeback",
        badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        dotClass: "bg-rose-400",
      };
    case "FAILED":
      return {
        label: "Falhou",
        badgeClass: "bg-red-500/10 text-red-300 border-red-500/25",
        dotClass: "bg-red-400",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
        dotClass: "bg-zinc-400",
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
        badgeClass:
          "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
      };
    case "PENDING":
    case "PROCESSING":
    case "TRANSFERRING":
      return {
        label: status === "PENDING" ? "Aguardando" : "Processando",
        badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
      };
    case "CANCELED":
    case "FAILED":
      return {
        label: status === "CANCELED" ? "Cancelada" : "Falhou",
        badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/25",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
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
    color: "#3b82f6",
    badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/25",
  },
  TIKTOK_ADS: {
    label: "TikTok Ads",
    isAdSpend: true,
    color: "#ec4899",
    badgeClass: "bg-pink-500/10 text-pink-300 border-pink-500/25",
  },
  OTHER_ADS: {
    label: "Outros Anúncios",
    isAdSpend: true,
    color: "#8b5cf6",
    badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/25",
  },
  TOOLS: {
    label: "Ferramentas & SaaS",
    isAdSpend: false,
    color: "#f59e0b",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  },
  OTHER: {
    label: "Outras Despesas",
    isAdSpend: false,
    color: "#71717a",
    badgeClass: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
};
