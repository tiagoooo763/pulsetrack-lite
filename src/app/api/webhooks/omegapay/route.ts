import { NextRequest, NextResponse } from "next/server";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { safeLog } from "@/lib/sanitize";

/**
 * Endpoint oficial de recebimento de Webhooks da OmegaPay
 * Método esperado pela OmegaPay: HTTP POST (application/json)
 * Deve retornar status HTTP 2XX após o processamento bem-sucedido.
 */
export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    safeLog("warn", "Webhook recebido com corpo JSON malformado.");
    return NextResponse.json(
      { success: false, error: "Corpo da requisição deve ser um JSON válido." },
      { status: 400 }
    );
  }

  try {
    const creds = await getOmegaPayServerCredentials();
    const result = await processOmegaPayWebhook(rawBody, creds.webhookToken);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        received: true,
        duplicate: Boolean(result.duplicate),
        event: result.event,
        entityId: result.entityId,
        status: result.statusAfter,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    safeLog("error", "Erro interno ao processar webhook OmegaPay.", {
      errorMessage: err instanceof Error ? err.message : "Erro desconhecido",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao processar notificação.",
      },
      { status: 500 }
    );
  }
}

/**
 * Verificação rápida de disponibilidade do endpoint de webhook (GET)
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "online",
      service: "PulseTrack Lite — Receptor de Webhooks OmegaPay",
      methodRequired: "POST",
      contentType: "application/json",
    },
    { status: 200 }
  );
}
