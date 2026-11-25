import { NextRequest, NextResponse } from "next/server";
import {
  getGatewayIntegration,
  getGatewayIntegrationBySlug,
} from "@/lib/db";
import {
  processElevyPayWebhook,
  verifyElevyPayWebhookAuth,
} from "@/lib/elevypay-processor";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { safeLog } from "@/lib/sanitize";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024; // 256 KB

/**
 * Endpoint público HTTPS de recebimento de Webhooks da ElevyPay (multi-usuário)
 * URL individual por integração: POST /api/webhooks/elevypay?i=<webhook_url_slug>
 */
export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);
  const slug = request.nextUrl.searchParams.get("i")?.trim() || "";
  const queryUserId = request.nextUrl.searchParams.get("u")?.trim() || "";
  const queryToken = request.nextUrl.searchParams.get("token")?.trim() || "";

  // 1. Rate limiting compatível com picos legítimos de gateway (120 req/min por IP+integração)
  const rl = checkRateLimit({
    key: `wh:elevypay:${slug || queryUserId || "anon"}:${ip}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Limite de requisições excedido. Tente novamente em instantes.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  // 2. Identificação obrigatória da integração individual
  if (!slug && !queryUserId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Identificador individual da integração ausente. Utilize a URL completa exibida na Dashfy.",
      },
      { status: 400 }
    );
  }

  // 3. Leitura segura do corpo bruto (necessário para validação HMAC-SHA256)
  let rawText = "";
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json(
      { success: false, error: "Não foi possível ler o corpo da requisição." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(rawText, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Payload acima do limite permitido (256 KB)." },
      { status: 413 }
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    safeLog("warn", "Webhook ElevyPay recebido com JSON inválido.");
    return NextResponse.json(
      { success: false, error: "Corpo da requisição deve ser um JSON válido." },
      { status: 400 }
    );
  }

  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json(
      { success: false, error: "Payload JSON deve ser um objeto válido." },
      { status: 400 }
    );
  }

  const payload = parsedBody as Record<string, unknown>;

  try {
    // 4. Resolve integração isolada do usuário
    const integration = slug
      ? await getGatewayIntegrationBySlug(slug, "ELEVYPAY")
      : await getGatewayIntegration(queryUserId, "ELEVYPAY");

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integração ElevyPay não encontrada." },
        { status: 404 }
      );
    }

    if (integration.status !== "CONNECTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Integração ElevyPay está desconectada nesta conta Dashfy.",
        },
        { status: 403 }
      );
    }

    // 5. Autenticação obrigatória (rejeita qualquer requisição não autenticada)
    const authCheck = verifyElevyPayWebhookAuth({
      rawBody: rawText,
      payload,
      headers: request.headers,
      queryToken,
      integration,
    });

    if (!authCheck.valid) {
      safeLog("warn", "Webhook ElevyPay rejeitado por autenticação inválida.", {
        authMode: integration.authMode,
        reason: authCheck.reason,
      });
      return NextResponse.json(
        {
          success: false,
          error: authCheck.reason || "Requisição não autenticada.",
        },
        { status: 401 }
      );
    }

    // 6. Processamento idempotente e normalizado
    const result = await processElevyPayWebhook({
      payload,
      userId: integration.userId,
      source: "webhook",
    });

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
        gateway: "ELEVYPAY",
        received: true,
        duplicate: result.duplicate,
        transactionId: result.externalTransactionId,
        status: result.statusAfter,
        event: result.eventType,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    safeLog("error", "Erro interno na rota de webhook ElevyPay.", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao processar webhook ElevyPay.",
      },
      { status: 500 }
    );
  }
}

/**
 * Verificação de disponibilidade do endpoint público (sem expor segredos)
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "active",
      gateway: "ELEVYPAY",
      endpoint: "/api/webhooks/elevypay",
      methodRequired: "POST",
      contentType: "application/json",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
