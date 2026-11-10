import { describe, it, expect, beforeAll } from "vitest";
import { processNexusWebhook } from "@/lib/nexus-processor";
import { listTransactions, getLatestBalanceSnapshot, saveBalanceSnapshot } from "@/lib/db";

describe("Nexus Pay Webhook & Isolamento Multi-Gateway", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "file:./data/test-nexus.db";
  });

  it("processa webhook da Nexus Pay com formato plano ou aninhado e grava gateway = NEXUS", async () => {
    const txId = `nexus_tx_${Date.now()}`;
    const token = "nexus_secret_test_123";

    const res = await processNexusWebhook(
      {
        event: "transaction.paid",
        token,
        data: {
          id: txId,
          amount: 19700, // centavos (R$ 197,00)
          net_amount: 18715, // R$ 187,15
          fee_amount: 985, // R$ 9,85
          status: "paid",
          payment_method: "pix",
          product_name: "Mentoria Nexus",
        },
      },
      token
    );

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(false);
    expect(res.transactionId).toBe(txId);

    const allTx = await listTransactions();
    const saved = allTx.find((t) => t.id === txId);
    expect(saved).toBeDefined();
    expect(saved?.gateway).toBe("NEXUS");
    expect(saved?.grossAmount).toBe(197);
    expect(saved?.netAmount).toBe(187.15);
    expect(saved?.status).toBe("COMPLETED");
  });

  it("rejeita webhook com token incorreto quando configurado", async () => {
    const res = await processNexusWebhook(
      {
        event: "transaction.paid",
        token: "token_errado",
        data: { id: "tx_nexus_bad", amount: 100 },
      },
      "token_correto"
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Token");
  });

  it("gerencia saldo da Nexus de forma isolada do saldo da OmegaPay", async () => {
    await saveBalanceSnapshot({
      gateway: "OMEGAPAY",
      available: 5000,
      pending: 1200,
      fundLock: 300,
    });

    await saveBalanceSnapshot({
      gateway: "NEXUS",
      available: 2450.5,
      pending: 350,
      fundLock: 0,
    });

    const omegaBal = await getLatestBalanceSnapshot("OMEGAPAY");
    const nexusBal = await getLatestBalanceSnapshot("NEXUS");

    expect(omegaBal?.available).toBe(5000);
    expect(omegaBal?.pending).toBe(1200);
    expect(omegaBal?.gateway).toBe("OMEGAPAY");

    expect(nexusBal?.available).toBe(2450.5);
    expect(nexusBal?.pending).toBe(350);
    expect(nexusBal?.gateway).toBe("NEXUS");

    // Confirma que os saldos não foram misturados
    expect(nexusBal?.available).not.toBe(omegaBal?.available);
  });
});
