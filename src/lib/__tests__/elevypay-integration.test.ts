import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getGatewayIntegration,
  getUserSoundPreferences,
  listRecentWebhookEventsByGateway,
  listSaleNotificationsSince,
  listTransactions,
  listTransactionStatusHistory,
  upsertGatewayIntegration,
} from "@/lib/db";
import {
  buildElevyPayWebhookUrl,
  generateElevyPayWebhookSecret,
} from "@/lib/elevypay-processor";
import { encryptSecret } from "@/lib/token-crypto";
import { computeOmegaPaySummary } from "@/lib/dashfy-metrics";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { GET as elevyGet, POST as elevyPost } from "@/app/api/webhooks/elevypay/route";

const TEST_DB_REL = "./data/test-elevypay-integration.db";
const TEST_DB_ABS = path.resolve(
  process.cwd(),
  "data/test-elevypay-integration.db"
);

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function makeWebhookRequest(params: {
  url: string;
  body: Record<string, unknown> | string;
  headers?: Record<string, string>;
}): NextRequest {
  const raw =
    typeof params.body === "string" ? params.body : JSON.stringify(params.body);
  return new NextRequest(params.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.10",
      ...(params.headers || {}),
    },
    body: raw,
  });
}

describe("Dashfy — Integração ElevyPay (Simulação Controlada em Ambiente de Teste)", () => {
  let secretA = "";
  let slugA = "";
  let secretB = "";
  let slugB = "";

  beforeAll(async () => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
    process.env.DATABASE_URL = `file:${TEST_DB_REL}`;
    delete process.env.VERCEL;
    resetRateLimitStore();

    // Conecta Usuário A e Usuário B com segredos individuais criptografados
    secretA = generateElevyPayWebhookSecret();
    const intA = await upsertGatewayIntegration({
      userId: USER_A,
      gateway: "ELEVYPAY",
      status: "CONNECTED",
      authMode: "DASHFY_TOKEN",
      webhookSecretEnc: encryptSecret(secretA),
    });
    slugA = intA.webhookUrlSlug;

    secretB = generateElevyPayWebhookSecret();
    const intB = await upsertGatewayIntegration({
      userId: USER_B,
      gateway: "ELEVYPAY",
      status: "CONNECTED",
      authMode: "DASHFY_TOKEN",
      webhookSecretEnc: encryptSecret(secretB),
    });
    slugB = intB.webhookUrlSlug;
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
  });

  it("1. GET /api/webhooks/elevypay responde 200 ativo sem expor segredos", async () => {
    const res = await elevyGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("active");
    expect(json.gateway).toBe("ELEVYPAY");
    expect(JSON.stringify(json)).not.toContain(secretA);
  });

  it("2. Rejeita requisições não autenticadas (401), token de outro usuário (401), JSON inválido (400) e integração desconectada (403)", async () => {
    const urlA = buildElevyPayWebhookUrl(slugA);

    // Sem token -> 401
    const noAuth = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        body: { event: "payment.approved", data: { id: "tx_unauth", amount: 100 } },
      })
    );
    expect(noAuth.status).toBe(401);

    // Token do Usuário B enviado para a URL do Usuário A -> 401
    const wrongUserToken = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretB },
        body: { event: "payment.approved", data: { id: "tx_wrong", amount: 100 } },
      })
    );
    expect(wrongUserToken.status).toBe(401);

    // JSON malformado -> 400
    const badJson = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: "{invalid-json",
      })
    );
    expect(badJson.status).toBe(400);

    // Desconectar Usuário B -> rejeita com 403 mesmo com token correto
    await upsertGatewayIntegration({
      userId: USER_B,
      gateway: "ELEVYPAY",
      status: "DISCONNECTED",
    });
    const urlB = buildElevyPayWebhookUrl(slugB);
    const disconnectedRes = await elevyPost(
      makeWebhookRequest({
        url: urlB,
        headers: { "x-elevypay-token": secretB },
        body: { event: "payment.approved", data: { id: "tx_disc", amount: 50 } },
      })
    );
    expect(disconnectedRes.status).toBe(403);

    // Reconecta Usuário B para próximos testes
    await upsertGatewayIntegration({
      userId: USER_B,
      gateway: "ELEVYPAY",
      status: "CONNECTED",
    });
  });

  it("3. Suporta autenticação por assinatura criptográfica HMAC-SHA256 e rejeita assinatura adulterada", async () => {
    const hmacSecret = "elevy_hmac_secret_test_998877";
    await upsertGatewayIntegration({
      userId: USER_B,
      gateway: "ELEVYPAY",
      status: "CONNECTED",
      authMode: "HMAC_SHA256",
      externalTokenEnc: encryptSecret(hmacSecret),
    });

    const urlB = buildElevyPayWebhookUrl(slugB);
    const rawBody = JSON.stringify({
      event: "payment.pending",
      data: { id: "hmac_tx_01", amount: 149.9, payment_method: "PIX" },
    });

    // Assinatura inválida -> 401
    const badSig = await elevyPost(
      makeWebhookRequest({
        url: urlB,
        headers: { "x-elevypay-signature": "sha256=" + "0".repeat(64) },
        body: rawBody,
      })
    );
    expect(badSig.status).toBe(401);

    // Assinatura válida -> 200
    const validSig = crypto
      .createHmac("sha256", hmacSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const okRes = await elevyPost(
      makeWebhookRequest({
        url: urlB,
        headers: { "x-elevypay-signature": `sha256=${validSig}` },
        body: rawBody,
      })
    );
    expect(okRes.status).toBe(200);
    const json = await okRes.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("PENDING");

    // Restaura modo padrão para Usuário B
    await upsertGatewayIntegration({
      userId: USER_B,
      gateway: "ELEVYPAY",
      authMode: "DASHFY_TOKEN",
    });
  });

  it("4. Fluxo completo: Pendente -> Aprovado -> Duplicado -> Fora de ordem -> Reembolso + Dashboard + Som + Histórico + Isolamento", async () => {
    const before = new Date(Date.now() - 1000).toISOString();
    const urlA = buildElevyPayWebhookUrl(slugA);

    // A) Pagamento PENDENTE (sem inventar taxa, sem contar como faturamento, sem notificação sonora)
    const pendingRes = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.pending",
          data: {
            id: "1001",
            status: "pending",
            amount: 197.0,
            payment_method: "PIX",
            product: { id: "p_01", name: "Treinamento ElevyPro" },
            customer: { name: "Carlos Silva", cpf: "123.456.789-00" },
          },
        },
      })
    );
    expect(pendingRes.status).toBe(200);
    const pendingJson = await pendingRes.json();
    expect(pendingJson.status).toBe("PENDING");

    // Verifica que pendente NÃO gera faturamento nem notificação de venda aprovada
    let txA = await listTransactions(USER_A);
    let metricsA = computeOmegaPaySummary(txA, [], [], []);
    expect(metricsA.grossRevenue).toBe(0);
    expect(metricsA.approvedCount).toBe(0);
    expect(metricsA.pendingCount).toBe(1);
    expect(metricsA.pendingAmount).toBe(197);
    expect(txA[0].feeAmount).toBe(0); // Não inventou taxa!
    expect(await listSaleNotificationsSince(USER_A, before)).toHaveLength(0);

    // Verifica sanitização do CPF no histórico de webhooks
    const eventsA = await listRecentWebhookEventsByGateway(USER_A, "ELEVYPAY");
    expect(eventsA.length).toBe(1);
    expect(eventsA[0].sanitizedPayload).not.toContain("123.456.789-00");

    // B) Pagamento APROVADO (em centavos + taxa explícita + UTM TikTok)
    const approvedRes = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.approved",
          data: {
            id: "1001",
            status: "approved",
            amount_cents: 19700,
            fee_cents: 985,
            net_amount_cents: 18715,
            payment_method: "PIX",
            product: { id: "p_01", name: "Treinamento ElevyPro" },
            tracking: {
              utm_source: "tiktok",
              utm_campaign: "campanha_escala_01",
              campaign_id: "cmp_778",
            },
          },
        },
      })
    );
    expect(approvedRes.status).toBe(200);
    const approvedJson = await approvedRes.json();
    expect(approvedJson.status).toBe("COMPLETED");
    expect(approvedJson.duplicate).toBe(false);

    // C) Evento DUPLICADO idêntico -> idempotente, não duplica venda nem notificação
    const dupRes = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.approved",
          data: {
            id: "1001",
            status: "approved",
            amount_cents: 19700,
            fee_cents: 985,
            net_amount_cents: 18715,
            payment_method: "PIX",
          },
        },
      })
    );
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    expect(dupJson.duplicate).toBe(true);

    // D) Evento FORA DE ORDEM (pendente atrasado após aprovado) -> NÃO regride COMPLETED
    const latePending = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.created_late",
          data: { id: "1001", status: "pending", amount: 197.0 },
        },
      })
    );
    expect(latePending.status).toBe(200);
    const lateJson = await latePending.json();
    expect(lateJson.status).toBe("COMPLETED");

    // Verifica atualização do dashboard + notificação sonora (padrão cash_register 70%)
    txA = await listTransactions(USER_A);
    expect(txA).toHaveLength(1);
    expect(txA[0].gateway).toBe("ELEVYPAY");
    expect(txA[0].orderId).toBe("1001");
    expect(txA[0].grossAmount).toBe(197);
    expect(txA[0].feeAmount).toBe(9.85);
    expect(txA[0].netAmount).toBe(187.15);

    metricsA = computeOmegaPaySummary(txA, [], [], []);
    expect(metricsA.grossRevenue).toBe(197);
    expect(metricsA.netRevenue).toBe(187.15);
    expect(metricsA.profit).toBe(187.15);
    expect(metricsA.approvedCount).toBe(1);
    expect(metricsA.averageTicket).toBe(197);
    expect(metricsA.checkoutOrPlatformFees).toBe(9.85);
    expect(metricsA.pendingCount).toBe(0);

    const notifsA = await listSaleNotificationsSince(USER_A, before);
    expect(notifsA).toHaveLength(1);
    expect(notifsA[0].gateway).toBe("ELEVYPAY");
    expect(notifsA[0].grossAmount).toBe(197);
    expect(notifsA[0].utmSource).toBe("tiktok");
    expect(notifsA[0].utmCampaign).toBe("campanha_escala_01");

    const soundPrefsA = await getUserSoundPreferences(USER_A);
    expect(soundPrefsA.soundEnabled).toBe(true);
    expect(soundPrefsA.selectedSound).toBe("cash_register");
    expect(soundPrefsA.soundVolume).toBe(70);

    // E) Isolamento: Usuário B recebe transação com o MESMO ID externo "1001" sem colidir com Usuário A!
    const urlB = buildElevyPayWebhookUrl(slugB);
    const saleB = await elevyPost(
      makeWebhookRequest({
        url: urlB,
        headers: { "x-elevypay-token": secretB },
        body: {
          event: "payment.approved",
          data: {
            id: "1001",
            status: "paid",
            amount: 497.0,
            payment_method: "CREDIT_CARD",
            product_name: "Mentoria Bruno",
          },
        },
      })
    );
    expect(saleB.status).toBe(200);

    const txB = await listTransactions(USER_B);
    const approvedB = txB.find((t) => t.orderId === "1001");
    expect(approvedB).toBeDefined();
    expect(approvedB?.grossAmount).toBe(497);
    expect(approvedB?.gateway).toBe("ELEVYPAY");

    // Usuário A continua vendo apenas R$ 197,00 (isolamento total)
    expect((await listTransactions(USER_A))[0].grossAmount).toBe(197);
    expect(await listSaleNotificationsSince(USER_B, before)).toHaveLength(1);

    // F) REEMBOLSO no Usuário A -> atualiza status, zera faturamento realizado, contabiliza reembolso
    const refundRes = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.refunded",
          data: { id: "1001", status: "refunded", amount: 197.0 },
        },
      })
    );
    expect(refundRes.status).toBe(200);
    const refundJson = await refundRes.json();
    expect(refundJson.status).toBe("REFUNDED");

    // Aprovado atrasado após reembolso NÃO pode reverter reembolso
    const latePaidAfterRefund = await elevyPost(
      makeWebhookRequest({
        url: urlA,
        headers: { "x-elevypay-token": secretA },
        body: {
          event: "payment.approved_late",
          data: { id: "1001", status: "approved", amount: 197.0 },
        },
      })
    );
    expect(latePaidAfterRefund.status).toBe(200);
    expect((await latePaidAfterRefund.json()).status).toBe("REFUNDED");

    txA = await listTransactions(USER_A);
    metricsA = computeOmegaPaySummary(txA, [], [], []);
    expect(metricsA.grossRevenue).toBe(0);
    expect(metricsA.approvedCount).toBe(0);
    expect(metricsA.refundedCount).toBe(1);
    expect(metricsA.refundedAmount).toBe(197);

    // Histórico auditável de transições: null->PENDING -> COMPLETED -> REFUNDED
    const historyA = await listTransactionStatusHistory(USER_A, txA[0].id);
    const statuses = historyA.map((h) => h.newStatus);
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("COMPLETED");
    expect(statuses).toContain("REFUNDED");

    // Última comunicação registrada na integração
    const intAfter = await getGatewayIntegration(USER_A, "ELEVYPAY");
    expect(intAfter?.lastEventAt).toBeTruthy();
  });
});
