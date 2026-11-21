import { NextResponse } from "next/server";
import {
  getExpectedDashboardCredentials,
  isAuthenticated,
} from "@/lib/auth";
import {
  getAllBalanceSnapshots,
  getServerSetting,
  listAutomationRules,
  listCustomFees,
  listManualExpenses,
  listRecentWebhookEvents,
  listTikTokCampaigns,
  listTransactions,
  listTransfers,
} from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { DEFAULT_DASHBOARDS, type DashboardConfigRecord } from "@/lib/dashfy-types";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [
    transactions,
    transfers,
    expenses,
    balances,
    recentWebhooks,
    creds,
    dashCreds,
    presetSetting,
    nexusApiKey,
    nexusWebhookToken,
    tiktokCampaigns,
    customFees,
    automationRules,
    omegaSyncEnabledRaw,
    omegaLastSyncAt,
    profileName,
    profileCompany,
    notifPrefsRaw,
    dashboardsConfigRaw,
  ] = await Promise.all([
    listTransactions(),
    listTransfers(),
    listManualExpenses(),
    getAllBalanceSnapshots(),
    listRecentWebhookEvents(40),
    getOmegaPayServerCredentials(),
    getExpectedDashboardCredentials(),
    getServerSetting("QUICK_EXPENSE_PRESET"),
    getServerSetting("NEXUS_API_KEY"),
    getServerSetting("NEXUS_WEBHOOK_TOKEN"),
    listTikTokCampaigns(),
    listCustomFees(),
    listAutomationRules(),
    getServerSetting("OMEGAPAY_SYNC_ENABLED"),
    getServerSetting("OMEGAPAY_LAST_SYNC_AT"),
    getServerSetting("USER_PROFILE_NAME"),
    getServerSetting("USER_PROFILE_COMPANY"),
    getServerSetting("NOTIFICATION_PREFS"),
    getServerSetting("DASHFY_DASHBOARDS_CONFIG"),
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
      username: dashCreds.username,
      displayName: profileName || "Tiago Mendonça",
      companyName: profileCompany || "Dashfy Workspace",
      notificationPrefs,
    },
    integrationStatus: {
      hasApiCredentials: creds.hasApiCredentials,
      hasWebhookToken: creds.hasWebhookToken,
      source: creds.source,
      apiBaseUrl: creds.baseUrl,
      isDefaultPassword: dashCreds.isDefaultPassword,
      syncEnabled,
      lastSyncAt: omegaLastSyncAt || balances.OMEGAPAY?.fetchedAt || null,
      nexus: {
        hasApiCredentials: Boolean(nexusApiKey),
        hasWebhookToken: Boolean(nexusWebhookToken || process.env.NEXUS_WEBHOOK_TOKEN),
        apiBaseUrl: "https://api.nexuspay.com.br",
      },
    },
  });
}
