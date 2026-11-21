import { NextRequest, NextResponse } from "next/server";
import {
  findUserIdByWebhookToken,
  getUserSetting,
  LEGACY_ADMIN_USER_ID,
} from "@/lib/db";
import { processNexusWebhook } from "@/lib/nexus-processor";
import { safeLog } from "@/lib/sanitize";

/**
 * Endpoint oficial de recebimento de Webhooks do Gateway Nexus (multi-usuário)
 * Método: HTTP POST (application/json)
 */
export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    safeLog("warn", "Webhook Nexus recebido com JSON inválido.");
    return NextResponse.json(
      { success: false, error: "Corpo da requisição deve ser um JSON válido." },
      { status: 400 }
    );
  }

  try {
    const headerToken =
      request.headers.get("x-nexus-token") ||
      request.headers.get("x-webhook-token") ||
      request.nextUrl.searchParams.get("token") ||
      "";

    const payload =
      typeof rawBody === "object" && rawBody !== null
        ? ({ ...(rawBody as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    if (headerToken && !payload.token) {
      payload.token = headerToken;
    }

    const tokenCandidate =
      typeof payload.token === "string" ? payload.token.trim() : "";

    let targetUserId = request.nextUrl.searchParams.get("u")?.trim() || "";
    if (!targetUserId && tokenCandidate) {
      const matchedUser = await findUserIdByWebhookToken(
        "NEXUS_WEBHOOK_TOKEN",
        tokenCandidate
      );
      if (matchedUser) {
        targetUserId = matchedUser;
      }
    }
    if (!targetUserId) {
      targetUserId = LEGACY_ADMIN_USER_ID;
    }

    const configuredToken =
      (await getUserSetting(targetUserId, "NEXUS_WEBHOOK_TOKEN")) ||
      (targetUserId === LEGACY_ADMIN_USER_ID
        ? process.env.NEXUS_WEBHOOK_TOKEN || ""
        : "");

    const result = await processNexusWebhook(
      payload,
      configuredToken,
      targetUserId
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        gateway: "NEXUS",
        received: true,
        duplicate: Boolean(result.duplicate),
        transactionId: result.transactionId,
        status: result.statusAfter,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    safeLog("error", "Erro interno no webhook Nexus.", { errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao processar notificação do Nexus.",
      },
      { status: 500 }
    );
  }
}

/**
 * Verificação de endpoint ativo (usado pelo painel da Nexus para checar o status)
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    gateway: "NEXUS",
    endpoint: "/api/webhooks/nexus",
    timestamp: new Date().toISOString(),
  });
}
