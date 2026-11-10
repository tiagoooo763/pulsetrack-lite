import { NextResponse } from "next/server";
import {
  getExpectedDashboardCredentials,
  isAuthenticated,
} from "@/lib/auth";
import {
  getAllBalanceSnapshots,
  getServerSetting,
  listManualExpenses,
  listRecentWebhookEvents,
  listTransactions,
  listTransfers,
} from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";

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
  ] = await Promise.all([
    listTransactions(),
    listTransfers(),
    listManualExpenses(),
    getAllBalanceSnapshots(),
    listRecentWebhookEvents(30),
    getOmegaPayServerCredentials(),
    getExpectedDashboardCredentials(),
    getServerSetting("QUICK_EXPENSE_PRESET"),
    getServerSetting("NEXUS_API_KEY"),
    getServerSetting("NEXUS_WEBHOOK_TOKEN"),
  ]);

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

  return NextResponse.json({
    transactions,
    transfers,
    expenses,
    balance: balances.OMEGAPAY, // retrocompatibilidade
    balances,
    recentWebhooks,
    quickExpensePreset,
    integrationStatus: {
      hasApiCredentials: creds.hasApiCredentials,
      hasWebhookToken: creds.hasWebhookToken,
      source: creds.source,
      apiBaseUrl: creds.baseUrl,
      isDefaultPassword: dashCreds.isDefaultPassword,
      nexus: {
        hasApiCredentials: Boolean(nexusApiKey),
        hasWebhookToken: Boolean(nexusWebhookToken || process.env.NEXUS_WEBHOOK_TOKEN),
        apiBaseUrl: "https://api.nexuspay.com.br",
      },
    },
  });
}
