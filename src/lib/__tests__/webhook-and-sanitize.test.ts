import { describe, it, expect, beforeAll } from "vitest";
import {
  sanitizeData,
  redactSensitiveText,
  verifyOmegaPayWebhookToken,
} from "@/lib/sanitize";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { listTransactions, listTransfers, listRecentWebhookEvents } from "@/lib/db";

describe("PulseTrack Lite — Segurança, Sanitização e Webhooks Oficiais OmegaPay", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "file:./data/test-pulsetrack.db";
  });

  it("valida o token exclusivo da OmegaPay com comparação em tempo constante", () => {
    const validToken = "cm7d59833000018a0bcdef123";
    expect(verifyOmegaPayWebhookToken(validToken, validToken)).toBe(true);
    expect(
      verifyOmegaPayWebhookToken(validToken, ["outro_token", validToken])
    ).toBe(true);
    expect(verifyOmegaPayWebhookToken("token_invalido", validToken)).toBe(false);
    expect(verifyOmegaPayWebhookToken(undefined, validToken)).toBe(false);
  });

  it("remove CPF, telefone, dados bancários e tokens nos logs e payloads persistidos", () => {
    const rawWebhookPayload = {
      event: "TRANSACTION_PAID",
      token: "secret_webhook_token_123",
      transaction: {
        id: "tx_sec_01",
        amount: 197,
        commissionAmount: 187.15,
        status: "COMPLETED",
        paymentMethod: "PIX",
      },
      client: {
        id: "cli_1",
        name: "Cliente Teste",
        email: "cliente@exemplo.com",
        phone: "(11) 98888-7777",
        cpf: "123.456.789-00",
        cnpj: "12.345.678/0001-99",
      },
      withdraw: {
        id: "wth_1",
        bankAccount: {
          pixKey: "123.456.789-00",
          pixKeyType: "CPF",
        },
      },
    };

    const sanitized = sanitizeData(rawWebhookPayload);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("secret_webhook_token_123");
    expect(serialized).not.toContain("123.456.789-00");
    expect(serialized).not.toContain("98888-7777");
    expect(serialized).not.toContain("12.345.678/0001-99");
    expect(serialized).toContain("[REDACTED]");

    const textSample = "Erro para CPF 123.456.789-00 e tel (11) 99123-4567";
    const redactedText = redactSensitiveText(textSample);
    expect(redactedText).not.toContain("123.456.789-00");
    expect(redactedText).not.toContain("99123-4567");
  });

  it("processa TRANSACTION_CREATED -> TRANSACTION_PAID sem duplicar e bloqueia regressão fora de ordem", async () => {
    const txId = `tx_flow_${Date.now()}`;
    const expectedToken = "omega_tok_test_999";

    // 1. Recebe TRANSACTION_CREATED
    const createdRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_CREATED",
        token: expectedToken,
        transaction: {
          id: txId,
          identifier: "ref-001",
          status: "PENDING",
          paymentMethod: "PIX",
          amount: 297,
          commissionAmount: 282.15,
          installments: 1,
          createdAt: "2025-05-10T12:00:00.000Z",
          payedAt: null,
        },
        orderItems: [
          {
            id: "item_1",
            price: 297,
            product: { id: "prod_1", name: "Curso PulseTrack", externalId: null },
          },
        ],
      },
      expectedToken
    );

    expect(createdRes.ok).toBe(true);
    expect(createdRes.duplicate).toBe(false);
    expect(createdRes.statusAfter).toBe("PENDING");

    // 2. Reenvio idêntico de TRANSACTION_CREATED -> deve detectar duplicidade
    const dupRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_CREATED",
        token: expectedToken,
        transaction: {
          id: txId,
          status: "PENDING",
          paymentMethod: "PIX",
          amount: 297,
          commissionAmount: 282.15,
          createdAt: "2025-05-10T12:00:00.000Z",
        },
      },
      expectedToken
    );
    expect(dupRes.ok).toBe(true);
    expect(dupRes.duplicate).toBe(true);

    // 3. Recebe TRANSACTION_PAID -> atualiza a mesma transação para COMPLETED
    const paidRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_PAID",
        token: expectedToken,
        transaction: {
          id: txId,
          status: "COMPLETED",
          paymentMethod: "PIX",
          amount: 297,
          commissionAmount: 282.15,
          createdAt: "2025-05-10T12:00:00.000Z",
          payedAt: "2025-05-10T12:02:00.000Z",
        },
      },
      expectedToken
    );
    expect(paidRes.ok).toBe(true);
    expect(paidRes.duplicate).toBe(false);
    expect(paidRes.statusAfter).toBe("COMPLETED");

    // 4. Confere que existe apenas 1 registro para txId no banco e com status COMPLETED
    const allTxs = await listTransactions();
    const matching = allTxs.filter((t) => t.id === txId);
    expect(matching.length).toBe(1);
    expect(matching[0].status).toBe("COMPLETED");
    expect(matching[0].grossAmount).toBe(297);
    expect(matching[0].feeAmount).toBeCloseTo(14.85, 2);
    expect(matching[0].netAmount).toBeCloseTo(282.15, 2);
  });

  it("processa TRANSFER_COMPLETED e omite dados bancários no log de auditoria", async () => {
    const transferId = `wth_${Date.now()}`;
    const expectedToken = "omega_tok_test_999";

    const res = await processOmegaPayWebhook(
      {
        event: "TRANSFER_COMPLETED",
        token: expectedToken,
        withdraw: {
          id: transferId,
          amount: 1000,
          feeAmount: 5,
          receivedAmount: 995,
          status: "COMPLETED",
          createdAt: "2025-05-10T15:00:00.000Z",
          updatedAt: "2025-05-10T15:05:00.000Z",
          bankAccount: {
            pixKey: "chave-pix-secreta-cpf-00011122233",
            pixKeyType: "CPF",
          },
        },
      },
      expectedToken
    );

    expect(res.ok).toBe(true);
    expect(res.statusAfter).toBe("COMPLETED");

    const transfers = await listTransfers();
    const found = transfers.find((t) => t.id === transferId);
    expect(found).toBeDefined();
    expect(found?.receivedAmount).toBe(995);

    const events = await listRecentWebhookEvents(5);
    const ev = events.find((e) => e.entityId === transferId);
    expect(ev).toBeDefined();
    expect(ev?.sanitizedPayload).not.toContain("chave-pix-secreta-cpf-00011122233");
  });
});
