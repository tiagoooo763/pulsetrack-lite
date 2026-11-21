import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServerSetting, saveBalanceSnapshot, setServerSetting } from "@/lib/db";
import {
  fetchOmegaPayBalance,
  OmegaPayApiError,
} from "@/lib/omegapay-client";
import { safeLog } from "@/lib/sanitize";

/**
 * Consulta pontual (sob demanda do usuário) ao endpoint oficial:
 * GET https://app.omegapayments.com.br/api/v1/gateway/producer/balance
 */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const syncEnabledRaw = await getServerSetting("OMEGAPAY_SYNC_ENABLED");
  if (syncEnabledRaw === "false") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A sincronização da OmegaPay está desabilitada em Integrações. Habilite-a para consultar o saldo.",
      },
      { status: 400 }
    );
  }

  try {
    const balance = await fetchOmegaPayBalance();
    const snapshot = await saveBalanceSnapshot(balance, "OMEGAPAY");
    await setServerSetting("OMEGAPAY_LAST_SYNC_AT", snapshot.fetchedAt || new Date().toISOString());
    return NextResponse.json({
      ok: true,
      balance: snapshot,
    });
  } catch (err: unknown) {
    if (err instanceof OmegaPayApiError) {
      safeLog("warn", "Falha ao consultar saldo na OmegaPay.", {
        statusCode: err.statusCode,
        errorCode: err.errorCode,
      });
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          errorCode: err.errorCode,
        },
        { status: err.statusCode }
      );
    }

    safeLog("error", "Erro inesperado ao consultar saldo na OmegaPay.");
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível consultar o saldo na OmegaPay no momento.",
      },
      { status: 500 }
    );
  }
}
