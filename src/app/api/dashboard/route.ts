import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getAllBalanceSnapshots,
  getUserSettingsBatch,
  getUserSoundPreferences,
  listAutomationRules,
  listCustomFees,
  listManualExpenses,
  listRecentWebhookEvents,
  listTikTokCampaigns,
  listTransactions,
  listTransfers,
} from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import {
  DEFAULT_DASHBOARDS,
  type DashboardConfigRecord,
} from "@/lib/dashfy-types";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const userId = user.id;

  // Carrega todas as coleções e TODAS as configurações do usuário em um único lote paralelo
  // (reduz de 20+ queries para 10 queries paralelas sem perder nenhum dado)
  const [
    transactions,
    transfers,
    expenses,
    balances,
    recentWebhooks,
    userSettings,
    tiktokCampaigns,
    customFees,
    automationRules,
    soundPreferences,
  ] = await Promise.all([
    listTransactions(userId, 500),
    listTransfers(userId, 200),
    listManualExpenses(userId, 500),
    getAllBalanceSnapshots(userId),
    listRecentWebhookEvents(40, userId),
    getUserSettingsBatch(userId),
    listTikTokCampaigns(userId),
    listCustomFees(userId),
    listAutomationRules(userId),
    getUserSoundPreferences(userId),
  ]);

  const creds = await getOmegaPayServerCredentials(
    userId,
    userSettings,
    user.email
  );

  const presetSetting = userSettings["QUICK_EXPENSE_PRESET"] || null;
  const nexusApiKey = userSettings["NEXUS_API_KEY"] || null;
  const nexusWebhookToken = userSettings["NEXUS_WEBHOOK_TOKEN"] || null;
  const omegaSyncEnabledRaw = userSettings["OMEGAPAY_SYNC_ENABLED"] || null;
  const omegaLastSyncAt = userSettings["OMEGAPAY_LAST_SYNC_AT"] || null;
  const notifPrefsRaw = userSettings["NOTIFICATION_PREFS"] || null;
  const dashboardsConfigRaw = userSettings["DASHFY_DASHBOARDS_CONFIG"] || null;

  let dashboards: DashboardConfigRecord[] = DEFAULT_DASHBOARDS;
  if (dashboardsConfigRaw) {
    try {
      const parsed = JSON.parse(dashboardsConfigRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dashboards = parsed
          .filter(
            (d: unknown): d is DashboardConfigRecord =>
              Boolean(d) &&
              typeof (d as DashboardConfigRecord).id === "string" &&
              typeof (d as DashboardConfigRecord).name === "string"
          )
          .map((d) => ({
            id: d.id.trim(),
            name: d.name.trim() || "Operação",
            mode: d.mode === "omegapay" ? "omegapay" : "tiktok",
          }));
      }
    } catch {}
  }

  let quickExpensePreset = {
    category: "META_ADS",
    title: "Meta Ads",
    amount: 50,
  };

  if (presetSetting) {
    try {
      const parsed = JSON.parse(presetSetting);
      if (parsed && typeof parsed.amount === "number") {
        quickExpensePreset = parsed;
      }
    } catch {}
  }

  let notificationPrefs = {
    alertOnRefund: true,
    alertOnChargeback: true,
    alertOnLowRoas: true,
    alertOnSyncError: true,
  };

  if (notifPrefsRaw) {
    try {
      const parsed = JSON.parse(notifPrefsRaw);
      if (parsed && typeof parsed === "object") {
        notificationPrefs = { ...notificationPrefs, ...parsed };
      }
    } catch {}
  }

  const syncEnabled = omegaSyncEnabledRaw !== "false";

  return NextResponse.json(
    {
      dashboards,
      transactions,
      transfers,
      expenses,
      balance: balances.OMEGAPAY,
      balances,
      recentWebhooks,
      quickExpensePreset,
      tiktokCampaigns,
      customFees,
      automationRules,
      profile: {
        id: user.id,
        username: user.email,
        displayName: user.displayName,
        companyName: user.companyName,
        authProvider: user.authProvider,
        notificationPrefs,
      },
      soundPreferences,
      integrationStatus: {
        hasApiCredentials: creds.hasApiCredentials,
        hasWebhookToken: creds.hasWebhookToken,
        source: creds.source,
        apiBaseUrl: creds.baseUrl,
        isDefaultPassword: false,
        syncEnabled,
        lastSyncAt: omegaLastSyncAt || balances.OMEGAPAY?.fetchedAt || null,
        webhookUserParam: user.id,
        nexus: {
          hasApiCredentials: Boolean(nexusApiKey),
          hasWebhookToken: Boolean(nexusWebhookToken),
          apiBaseUrl: "https://api.nexuspay.com.br",
        },
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}
