import type {
  AutomationRuleRecord,
  BalanceSnapshotRecord,
  CustomFeeRecord,
  DashboardConfigRecord,
  DashboardOperationId,
  DashboardOperationMode,
  ExpenseCategory,
  ManualExpenseRecord,
  TikTokCampaignRecord,
  TransactionRecord,
  TransferRecord,
  WebhookEventRecord,
} from "./db";

export type {
  DashboardConfigRecord,
  DashboardOperationId,
  DashboardOperationMode,
};

export type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";

export type TikTokTabId =
  | "resumo"
  | "tiktok_ads"
  | "utms"
  | "integracoes"
  | "regras"
  | "taxas"
  | "despesas"
  | "relatorios"
  | "pedidos"
  | "eventos"
  | "notificacoes";

export type OmegaPayTabId =
  | "resumo"
  | "vendas"
  | "recebimentos"
  | "saldo"
  | "taxas"
  | "integracoes"
  | "relatorios"
  | "pedidos"
  | "eventos"
  | "notificacoes";

export type OperationTabId = TikTokTabId | OmegaPayTabId;
export type GlobalPageId = "minha_conta" | "configuracoes" | "suporte";

export type NavigationLocation =
  | { kind: "dashboard"; dashboardId: DashboardOperationId; tabId: OperationTabId }
  | { kind: "global"; pageId: GlobalPageId };

export interface SummaryFilterState {
  period: PeriodPreset;
  customFrom: string;
  customTo: string;
  adAccount: string;
  campaign: string;
  trafficSource: string;
  product: string;
  platform: string;
  status: string;
  paymentMethod: string;
}

export interface QuickExpensePreset {
  category: ExpenseCategory;
  title: string;
  amount: number;
}

export interface NotificationPrefs {
  alertOnRefund: boolean;
  alertOnChargeback: boolean;
  alertOnLowRoas: boolean;
  alertOnSyncError: boolean;
}

export interface IntegrationStatusPayload {
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: string;
  apiBaseUrl: string;
  isDefaultPassword: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  nexus?: {
    hasApiCredentials: boolean;
    hasWebhookToken: boolean;
    apiBaseUrl: string;
  };
}

export interface DashfyDashboardPayload {
  dashboards: DashboardConfigRecord[];
  transactions: TransactionRecord[];
  transfers: TransferRecord[];
  expenses: ManualExpenseRecord[];
  balance: BalanceSnapshotRecord | null;
  balances?: {
    OMEGAPAY: BalanceSnapshotRecord | null;
    NEXUS: BalanceSnapshotRecord | null;
  };
  recentWebhooks: WebhookEventRecord[];
  quickExpensePreset?: QuickExpensePreset;
  tiktokCampaigns: TikTokCampaignRecord[];
  customFees: CustomFeeRecord[];
  automationRules: AutomationRuleRecord[];
  profile: {
    username: string;
    displayName: string;
    companyName: string;
    notificationPrefs: NotificationPrefs;
  };
  integrationStatus: IntegrationStatusPayload;
}

export interface TabMenuItem {
  id: OperationTabId;
  label: string;
  iconName:
    | "layout"
    | "megaphone"
    | "link"
    | "plug"
    | "sliders"
    | "percent"
    | "receipt"
    | "file"
    | "shopping"
    | "activity"
    | "bell"
    | "dollar"
    | "landmark"
    | "wallet";
}

export const TIKTOK_MODE_TABS: TabMenuItem[] = [
  { id: "resumo", label: "Resumo", iconName: "layout" },
  { id: "tiktok_ads", label: "TikTok Ads", iconName: "megaphone" },
  { id: "utms", label: "UTMs", iconName: "link" },
  { id: "integracoes", label: "Integrações", iconName: "plug" },
  { id: "regras", label: "Regras", iconName: "sliders" },
  { id: "taxas", label: "Taxas", iconName: "percent" },
  { id: "despesas", label: "Despesas", iconName: "receipt" },
  { id: "relatorios", label: "Relatórios", iconName: "file" },
  { id: "pedidos", label: "Pedidos", iconName: "shopping" },
  { id: "eventos", label: "Eventos", iconName: "activity" },
  { id: "notificacoes", label: "Notificações", iconName: "bell" },
];

export const OMEGAPAY_MODE_TABS: TabMenuItem[] = [
  { id: "resumo", label: "Resumo", iconName: "layout" },
  { id: "vendas", label: "Vendas", iconName: "dollar" },
  { id: "recebimentos", label: "Recebimentos", iconName: "landmark" },
  { id: "saldo", label: "Saldo", iconName: "wallet" },
  { id: "taxas", label: "Taxas", iconName: "percent" },
  { id: "despesas", label: "Despesas", iconName: "receipt" },
  { id: "integracoes", label: "Integrações", iconName: "plug" },
  { id: "relatorios", label: "Relatórios", iconName: "file" },
  { id: "pedidos", label: "Pedidos", iconName: "shopping" },
  { id: "eventos", label: "Eventos", iconName: "activity" },
  { id: "notificacoes", label: "Notificações", iconName: "bell" },
];

export function getTabsForMode(mode: DashboardOperationMode): TabMenuItem[] {
  return mode === "tiktok" ? TIKTOK_MODE_TABS : OMEGAPAY_MODE_TABS;
}

/**
 * 3 abas padrão totalmente renomeáveis e configuráveis entre TikTok ou OmegaPay.
 */
export const DEFAULT_DASHBOARDS: DashboardConfigRecord[] = [
  { id: "tiktok", name: "Operação TikTok", mode: "tiktok" },
  { id: "omegapay", name: "Operação OmegaPay", mode: "omegapay" },
  { id: "operacao_3", name: "Operação 3", mode: "tiktok" },
];

export const FEE_CATEGORIES: Record<
  "GATEWAY" | "TAX" | "PLATFORM" | "OTHER",
  { label: string }
> = {
  GATEWAY: { label: "Taxa de Gateway / Checkout" },
  TAX: { label: "Impostos / Nota Fiscal" },
  PLATFORM: { label: "Plataforma / Antecipação" },
  OTHER: { label: "Outras Taxas" },
};
