import { NextRequest, NextResponse } from "next/server";
import { findUserIdByWebhookToken, LEGACY_ADMIN_USER_ID } from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { safeLog } from "@/lib/sanitize";

/**
 * Endpoint oficial de recebimento de Webhooks da OmegaPay (multi-usuário)
 * - Novos usuários utilizam: POST /api/webhooks/omegapay?u=<user_id>
 * - Também resolve automaticamente o usuário dono do token configurado.
 * - Mantém compatibilidade total com o endpoint legado sem query string.
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
    const queryUserId = request.nextUrl.searchParams.get("u")?.trim() || "";
    const payloadToken =
      typeof rawBody === "object" &&
      rawBody !== null &&
      typeof (rawBody as Record<string, unknown>).token === "string"
        ? ((rawBody as Record<string, unknown>).token as string).trim()
        : "";

    let targetUserId = queryUserId;
    if (!targetUserId && payloadToken) {
      const matchedUser = await findUserIdByWebhookToken(
        "OMEGAPAY_WEBHOOK_TOKEN",
        payloadToken
      );
      if (matchedUser) {
        targetUserId = matchedUser;
      }
    }
    if (!targetUserId) {
      targetUserId = LEGACY_ADMIN_USER_ID;
    }

    const creds = await getOmegaPayServerCredentials(targetUserId);
    const result = await processOmegaPayWebhook(
      rawBody,
      creds.webhookToken,
      targetUserId
    );

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
      service: "Dashfy — Receptor de Webhooks OmegaPay",
      methodRequired: "POST",
      contentType: "application/json",
    },
    { status: 200 }
  );
}
