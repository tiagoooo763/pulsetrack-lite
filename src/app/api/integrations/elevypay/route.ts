import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getGatewayIntegration,
  listRecentWebhookEventsByGateway,
  upsertGatewayIntegration,
  type GatewayIntegrationRecord,
  type GatewayWebhookAuthMode,
} from "@/lib/db";
import {
  buildElevyPayWebhookUrl,
  generateElevyPayWebhookSecret,
  verifyElevyPayWebhookAuth,
} from "@/lib/elevypay-processor";
import { encryptSecret } from "@/lib/token-crypto";
import { safeLog } from "@/lib/sanitize";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

function sanitizeIntegrationForClient(
  record: GatewayIntegrationRecord | null,
  origin: string
) {
  if (!record) {
    return {
      connected: false,
      status: "DISCONNECTED" as const,
      authMode: "DASHFY_TOKEN" as GatewayWebhookAuthMode,
      webhookUrl: null,
      hasDashfySecret: false,
      hasExternalToken: false,
      lastEventAt: null,
      lastEventType: null,
      lastError: null,
      realCommunicationValidated: false,
      updatedAt: null,
    };
  }

  return {
    connected: record.status === "CONNECTED",
    status: record.status,
    authMode: record.authMode,
    webhookUrl: buildElevyPayWebhookUrl(record.webhookUrlSlug, origin),
    hasDashfySecret: Boolean(record.webhookSecretEnc),
    hasExternalToken: Boolean(record.externalTokenEnc),
    lastEventAt: record.lastEventAt,
    lastEventType: record.lastEventType,
    lastError: record.lastError,
    realCommunicationValidated: Boolean(record.lastEventAt),
    updatedAt: record.updatedAt,
  };
}

function getSafeOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host && host.includes("usedashfy.com.br")) {
    return "https://www.usedashfy.com.br";
  }
  return request.nextUrl.origin || "https://www.usedashfy.com.br";
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const [integration, events] = await Promise.all([
    getGatewayIntegration(user.id, "ELEVYPAY"),
    listRecentWebhookEventsByGateway(user.id, "ELEVYPAY", 25),
  ]);

  return NextResponse.json(
    {
      ok: true,
      integration: sanitizeIntegrationForClient(integration, getSafeOrigin(request)),
      events,
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const origin = getSafeOrigin(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.trim() : "";

    // 1. Conectar ElevyPay (gera URL individual e segredo criptográfico na 1ª conexão)
    if (action === "connect") {
      const existing = await getGatewayIntegration(user.id, "ELEVYPAY");
      let generatedTokenOnce: string | null = null;
      let secretEnc = existing?.webhookSecretEnc ?? null;

      if (!secretEnc) {
        generatedTokenOnce = generateElevyPayWebhookSecret();
        secretEnc = encryptSecret(generatedTokenOnce);
      }

      const saved = await upsertGatewayIntegration({
        userId: user.id,
        gateway: "ELEVYPAY",
        status: "CONNECTED",
        authMode: existing?.authMode ?? "DASHFY_TOKEN",
        webhookSecretEnc: secretEnc,
        lastError: null,
      });

      safeLog("info", "Integração ElevyPay conectada para usuário autenticado.");

      return NextResponse.json(
        {
          ok: true,
          integration: sanitizeIntegrationForClient(saved, origin),
          generatedTokenOnce,
          message: generatedTokenOnce
            ? "ElevyPay conectada! Copie o token gerado abaixo (exibido apenas uma vez) e cadastre a URL na ElevyPay."
            : "Integração ElevyPay reconectada com sucesso.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // 2. Desconectar ElevyPay (bloqueia novos webhooks imediatamente sem apagar histórico)
    if (action === "disconnect") {
      const existing = await getGatewayIntegration(user.id, "ELEVYPAY");
      if (!existing) {
        return NextResponse.json(
          {
            ok: true,
            integration: sanitizeIntegrationForClient(null, origin),
            message: "Integração ElevyPay já está desconectada.",
          },
          { headers: NO_STORE_HEADERS }
        );
      }

      const saved = await upsertGatewayIntegration({
        userId: user.id,
        gateway: "ELEVYPAY",
        status: "DISCONNECTED",
      });

      safeLog("info", "Integração ElevyPay desconectada pelo usuário.");

      return NextResponse.json(
        {
          ok: true,
          integration: sanitizeIntegrationForClient(saved, origin),
          message:
            "ElevyPay desconectada. Novos webhooks serão rejeitados até que você reconecte.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // 3. Rotacionar segredo criptográfico gerado pela Dashfy
    if (action === "rotate_secret") {
      const newSecret = generateElevyPayWebhookSecret();
      const existing = await getGatewayIntegration(user.id, "ELEVYPAY");
      const saved = await upsertGatewayIntegration({
        userId: user.id,
        gateway: "ELEVYPAY",
        status: existing?.status ?? "CONNECTED",
        authMode: existing?.authMode ?? "DASHFY_TOKEN",
        webhookSecretEnc: encryptSecret(newSecret),
        lastError: null,
      });

      safeLog("info", "Segredo de webhook ElevyPay rotacionado.");

      return NextResponse.json(
        {
          ok: true,
          integration: sanitizeIntegrationForClient(saved, origin),
          generatedTokenOnce: newSecret,
          message:
            "Novo segredo criptográfico gerado! Atualize o token no painel da ElevyPay.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // 4. Salvar modo de autenticação e/ou token fornecido pela ElevyPay
    if (action === "save_config") {
      const rawAuthMode = String(body.authMode || "DASHFY_TOKEN").toUpperCase();
      const authMode: GatewayWebhookAuthMode =
        rawAuthMode === "GATEWAY_TOKEN" || rawAuthMode === "HMAC_SHA256"
          ? rawAuthMode
          : "DASHFY_TOKEN";

      const externalToken =
        typeof body.externalToken === "string" ? body.externalToken.trim() : "";

      const existing = await getGatewayIntegration(user.id, "ELEVYPAY");

      if (
        authMode === "GATEWAY_TOKEN" &&
        !externalToken &&
        !existing?.externalTokenEnc
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Informe o token fornecido pela ElevyPay para usar o modo 'Token fornecido pelo gateway'.",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      let generatedTokenOnce: string | null = null;
      let secretEnc = existing?.webhookSecretEnc ?? null;
      if (!secretEnc) {
        generatedTokenOnce = generateElevyPayWebhookSecret();
        secretEnc = encryptSecret(generatedTokenOnce);
      }

      const saved = await upsertGatewayIntegration({
        userId: user.id,
        gateway: "ELEVYPAY",
        status: existing?.status ?? "CONNECTED",
        authMode,
        webhookSecretEnc: secretEnc,
        externalTokenEnc: externalToken
          ? encryptSecret(externalToken)
          : undefined,
        lastError: null,
      });

      return NextResponse.json(
        {
          ok: true,
          integration: sanitizeIntegrationForClient(saved, origin),
          generatedTokenOnce,
          message: "Configurações da ElevyPay salvas com criptografia no servidor.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // 5. Teste diagnóstico real NÃO-DESTRUTIVO (não cria vendas falsas em produção)
    if (action === "test_integration") {
      const integration = await getGatewayIntegration(user.id, "ELEVYPAY");
      if (!integration || integration.status !== "CONNECTED") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Conecte a integração ElevyPay primeiro para executar o diagnóstico.",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // Verifica integridade da credencial criptografada e proteção contra requisições sem autenticação
      const unauthCheck = verifyElevyPayWebhookAuth({
        rawBody: "{}",
        payload: {},
        headers: new Headers(),
        queryToken: null,
        integration,
      });

      const hasValidKey =
        integration.authMode === "GATEWAY_TOKEN"
          ? Boolean(integration.externalTokenEnc)
          : Boolean(integration.webhookSecretEnc || integration.externalTokenEnc);

      if (!hasValidKey) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Nenhum segredo/token está configurado para o modo de autenticação selecionado.",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (unauthCheck.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: "Falha crítica de segurança: autenticação não bloqueou requisição vazia.",
          },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      const webhookUrl = buildElevyPayWebhookUrl(
        integration.webhookUrlSlug,
        origin
      );
      const hasRealEvent = Boolean(integration.lastEventAt);

      return NextResponse.json(
        {
          ok: true,
          diagnostic: {
            endpointReady: true,
            authGuardActive: true,
            authMode: integration.authMode,
            webhookUrl,
            realCommunicationValidated: hasRealEvent,
            lastEventAt: integration.lastEventAt,
            lastEventType: integration.lastEventType,
          },
          message: hasRealEvent
            ? `Integração pronta e comunicação real validada (último evento: ${integration.lastEventType || "recebido"}).`
            : "Endpoint HTTPS e proteção de autenticação validados! Ainda aguardando o primeiro evento real enviado pelo painel da ElevyPay para confirmação ponta a ponta.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Ação inválida para integração ElevyPay." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    safeLog("error", "Erro na API de gestão da integração ElevyPay.", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "Erro ao processar configuração da ElevyPay." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
