import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getAllBalanceSnapshots,
  getUserSetting,
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

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const userId = user.id;

  const [
    transactions,
    transfers,
    expenses,
    balances,
    recentWebhooks,
    creds,
    presetSetting,
    nexusApiKey,
    nexusWebhookToken,
    tiktokCampaigns,
    customFees,
    automationRules,
    omegaSyncEnabledRaw,
    omegaLastSyncAt,
    notifPrefsRaw,
    dashboardsConfigRaw,
    soundPreferences,
  ] = await Promise.all([
    listTransactions(userId),
    listTransfers(userId),
    listManualExpenses(userId),
    getAllBalanceSnapshots(userId),
    listRecentWebhookEvents(40, userId),
    getOmegaPayServerCredentials(userId),
    getUserSetting(userId, "QUICK_EXPENSE_PRESET"),
    getUserSetting(userId, "NEXUS_API_KEY"),
    getUserSetting(userId, "NEXUS_WEBHOOK_TOKEN"),
    listTikTokCampaigns(userId),
    listCustomFees(userId),
    listAutomationRules(userId),
    getUserSetting(userId, "OMEGAPAY_SYNC_ENABLED"),
    getUserSetting(userId, "OMEGAPAY_LAST_SYNC_AT"),
    getUserSetting(userId, "NOTIFICATION_PREFS"),
    getUserSetting(userId, "DASHFY_DASHBOARDS_CONFIG"),
    getUserSoundPreferences(userId),
  ]);

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

  return NextResponse.json({
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
  });
}
