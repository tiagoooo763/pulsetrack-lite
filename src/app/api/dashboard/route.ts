import { NextResponse } from "next/server";
import {
  getExpectedDashboardCredentials,
  isAuthenticated,
} from "@/lib/auth";
import {
  getLatestBalanceSnapshot,
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
  ] = await Promise.all([
    listTransactions(),
    listTransfers(),
    listManualExpenses(),
    getLatestBalanceSnapshot(),
    listRecentWebhookEvents(25),
    getOmegaPayServerCredentials(),
    getExpectedDashboardCredentials(),
  ]);

  return NextResponse.json({
    transactions,
    transfers,
    expenses,
    balance,
    recentWebhooks,
    integrationStatus: {
      hasApiCredentials: creds.hasApiCredentials,
      hasWebhookToken: creds.hasWebhookToken,
      source: creds.source,
      apiBaseUrl: creds.baseUrl,
      isDefaultPassword: dashCreds.isDefaultPassword,
    },
  });
}
