import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  OmegaPayApiError,
  testOmegaPayCredentials,
} from "@/lib/omegapay-client";
import { safeLog } from "@/lib/sanitize";

/**
 * Consulta pontual ao endpoint oficial:
 * GET https://app.omegapayments.com.br/api/v1/gateway/producer/credentials
 */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const credentials = await testOmegaPayCredentials();
    return NextResponse.json({
      ok: true,
      credentials,
    });
  } catch (err: unknown) {
    if (err instanceof OmegaPayApiError) {
      safeLog("warn", "Falha ao testar credenciais na OmegaPay.", {
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

    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao testar credenciais na OmegaPay.",
      },
      { status: 500 }
    );
  }
}
