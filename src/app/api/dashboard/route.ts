import { NextResponse } from "next/server";
import {
  getExpectedDashboardCredentials,
  isAuthenticated,
} from "@/lib/auth";
import {
  getLatestBalanceSnapshot,
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
    balance,
    recentWebhooks,
    creds,
    dashCreds,
    presetSetting,
  ] = await Promise.all([
    listTransactions(),
    listTransfers(),
    listManualExpenses(),
    getLatestBalanceSnapshot(),
    listRecentWebhookEvents(25),
    getOmegaPayServerCredentials(),
    getExpectedDashboardCredentials(),
    getServerSetting("QUICK_EXPENSE_PRESET"),
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
    balance,
    recentWebhooks,
    quickExpensePreset,
    integrationStatus: {
      hasApiCredentials: creds.hasApiCredentials,
      hasWebhookToken: creds.hasWebhookToken,
      source: creds.source,
      apiBaseUrl: creds.baseUrl,
      isDefaultPassword: dashCreds.isDefaultPassword,
    },
  });
}
