import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAutomationRule,
  createCustomFee,
  createManualExpense,
  createTikTokCampaign,
  deleteAutomationRule,
  deleteCustomFee,
  deleteManualExpense,
  deleteTikTokCampaign,
  ensureUserProfile,
  findUserIdByWebhookToken,
  getAllBalanceSnapshots,
  getUserProfile,
  getUserSetting,
  listAutomationRules,
  listCustomFees,
  listManualExpenses,
  listRecentWebhookEvents,
  listTikTokCampaigns,
  listTransactions,
  listTransfers,
  saveBalanceSnapshot,
  setUserSetting,
  toggleAutomationRule,
  updateTikTokCampaignStatus,
  updateUserProfile,
  upsertTransaction,
  upsertTransfer,
} from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { processNexusWebhook } from "@/lib/nexus-processor";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rate-limit";

const TEST_DB_REL = "./data/test-multi-tenant-isolation.db";
const TEST_DB_ABS = path.resolve(process.cwd(), "data/test-multi-tenant-isolation.db");

const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";

describe("Dashfy — Isolamento Multi-Usuário (Usuário A vs Usuário B), Perfis e Proteção IDOR", () => {
  beforeAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) {
        fs.unlinkSync(TEST_DB_ABS);
      }
    } catch {}
    process.env.DATABASE_URL = `file:${TEST_DB_REL}`;
    process.env.OMEGAPAY_PUBLIC_KEY = "env_owner_pub_key_only";
    process.env.OMEGAPAY_SECRET_KEY = "env_owner_sec_key_only";
    process.env.OMEGAPAY_WEBHOOK_TOKEN = "env_owner_webhook_only";
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) {
        fs.unlinkSync(TEST_DB_ABS);
      }
    } catch {}
  });

  it("cria perfis automaticamente sem duplicar registros e mantém dados isolados", async () => {
    const profileA1 = await ensureUserProfile({
      id: USER_A,
      email: "alice@dashfy.test",
      displayName: "Alice Operações",
      companyName: "Alice Scale",
    });

    // Segunda chamada com o mesmo ID não deve duplicar nem sobrescrever dados personalizados
    const profileA2 = await ensureUserProfile({
      id: USER_A,
      email: "alice@dashfy.test",
      displayName: "Outro Nome",
      companyName: "Outra Empresa",
    });

    expect(profileA1.id).toBe(USER_A);
    expect(profileA2.id).toBe(USER_A);
    expect(profileA2.displayName).toBe("Alice Operações");
    expect(profileA2.companyName).toBe("Alice Scale");

    const profileB = await ensureUserProfile({
      id: USER_B,
      email: "bruno@dashfy.test",
      displayName: "Bruno Tráfego",
      companyName: "Bruno Ads",
    });

    expect(profileB.id).toBe(USER_B);
    expect(profileB.email).toBe("bruno@dashfy.test");

    // Atualizar perfil do Usuário A não afeta Usuário B
    await updateUserProfile(USER_A, { displayName: "Alice Atualizada" });
    const fetchedA = await getUserProfile(USER_A);
    const fetchedB = await getUserProfile(USER_B);

    expect(fetchedA?.displayName).toBe("Alice Atualizada");
    expect(fetchedB?.displayName).toBe("Bruno Tráfego");

    // Sincronização após confirmação de alteração de e-mail via Supabase Auth
    const syncedA = await ensureUserProfile({
      id: USER_A,
      email: "alice.novo@dashfy.test",
    });
    expect(syncedA.id).toBe(USER_A);
    expect(syncedA.email).toBe("alice.novo@dashfy.test");
    expect((await getUserProfile(USER_B))?.email).toBe("bruno@dashfy.test");
  });

  it("garante que novos usuários NÃO herdam credenciais de API do proprietário ou de outro usuário", async () => {
    await setUserSetting(USER_A, "OMEGAPAY_PUBLIC_KEY", "pk_alice_123");
    await setUserSetting(USER_A, "OMEGAPAY_SECRET_KEY", "sk_alice_456");
    await setUserSetting(USER_A, "OMEGAPAY_WEBHOOK_TOKEN", "wh_token_alice_789");

    const credsA = await getOmegaPayServerCredentials(USER_A);
    const credsB = await getOmegaPayServerCredentials(USER_B);

    expect(credsA.hasApiCredentials).toBe(true);
    expect(credsA.publicKey).toBe("pk_alice_123");
    expect(credsA.webhookToken).toBe("wh_token_alice_789");

    // Usuário B não tem credenciais cadastradas e NÃO deve herdar env do dono nem da Alice
    expect(credsB.hasApiCredentials).toBe(false);
    expect(credsB.hasWebhookToken).toBe(false);
    expect(credsB.publicKey).toBe("");
    expect(credsB.secretKey).toBe("");
    expect(credsB.webhookToken).toBe("");

    // Resolução de dono por webhook token aponta exclusivamente para Usuário A
    const ownerOfAliceToken = await findUserIdByWebhookToken(
      "OMEGAPAY_WEBHOOK_TOKEN",
      "wh_token_alice_789"
    );
    expect(ownerOfAliceToken).toBe(USER_A);
  });

  it("isola campanhas TikTok (BC/CA), despesas, taxas, regras e dashboards entre Usuário A e Usuário B", async () => {
    const campA = await createTikTokCampaign({
      userId: USER_A,
      dashboardId: "tiktok",
      adAccount: "BC-ALICE-01 / CA-ALICE-01",
      campaignName: "[ALICE] Escala Produto A",
      adgroupName: "Conjunto Alice",
      adName: "Criativo Alice 01",
      productName: "Produto Alice",
      statDate: "2026-11-21",
      spend: 500,
      impressions: 25000,
      clicks: 600,
      conversions: 12,
      attributedRevenue: 2400,
      status: "ACTIVE",
    });

    const expA = await createManualExpense({
      userId: USER_A,
      gateway: "ALL",
      dashboardId: "tiktok",
      category: "TIKTOK_ADS",
      title: "Recarga BC Alice",
      amount: 350,
      expenseDate: "2026-11-21",
    });

    const feeA = await createCustomFee({
      userId: USER_A,
      dashboardId: "tiktok",
      name: "Imposto Alice 6%",
      category: "TAX",
      feeType: "PERCENTAGE",
      value: 6,
      feeDate: "2026-11-21",
    });

    const ruleA = await createAutomationRule({
      userId: USER_A,
      dashboardId: "tiktok",
      name: "Pausar se ROAS < 1.5 (Alice)",
      metric: "ROAS",
      operator: "LT",
      threshold: 1.5,
      actionLabel: "Pausar campanha",
    });

    await setUserSetting(
      USER_A,
      "DASHFY_DASHBOARDS_CONFIG",
      JSON.stringify([{ id: "tiktok", name: "Loja Secreta Alice", mode: "tiktok" }])
    );

    // Usuário B consulta todas as coleções: deve ver ZERO dados da Alice
    expect(await listTikTokCampaigns(USER_B)).toHaveLength(0);
    expect(await listManualExpenses(USER_B)).toHaveLength(0);
    expect(await listCustomFees(USER_B)).toHaveLength(0);
    expect(await listAutomationRules(USER_B)).toHaveLength(0);
    expect(await getUserSetting(USER_B, "DASHFY_DASHBOARDS_CONFIG")).toBeNull();

    // Usuário A vê apenas os próprios dados
    expect(await listTikTokCampaigns(USER_A)).toHaveLength(1);
    expect(await listManualExpenses(USER_A)).toHaveLength(1);
    expect(await listCustomFees(USER_A)).toHaveLength(1);
    expect(await listAutomationRules(USER_A)).toHaveLength(1);

    // PROTEÇÃO IDOR: Usuário B tenta modificar ou excluir os registros da Alice pelos IDs reais
    expect(await updateTikTokCampaignStatus(campA.id, "PAUSED", USER_B)).toBe(false);
    expect(await deleteTikTokCampaign(campA.id, USER_B)).toBe(false);
    expect(await deleteManualExpense(expA.id, USER_B)).toBe(false);
    expect(await deleteCustomFee(feeA.id, USER_B)).toBe(false);
    expect(await toggleAutomationRule(ruleA.id, false, USER_B)).toBe(false);
    expect(await deleteAutomationRule(ruleA.id, USER_B)).toBe(false);

    // Verifica que TODOS os registros da Alice permanecem intactos e inalterados
    const campsAAfter = await listTikTokCampaigns(USER_A);
    expect(campsAAfter).toHaveLength(1);
    expect(campsAAfter[0].status).toBe("ACTIVE");

    const rulesAAfter = await listAutomationRules(USER_A);
    expect(rulesAAfter).toHaveLength(1);
    expect(rulesAAfter[0].enabled).toBe(true);

    expect(await listManualExpenses(USER_A)).toHaveLength(1);
    expect(await listCustomFees(USER_A)).toHaveLength(1);

    // Usuário A consegue modificar e excluir os próprios registros normalmente
    expect(await updateTikTokCampaignStatus(campA.id, "PAUSED", USER_A)).toBe(true);
    expect(await toggleAutomationRule(ruleA.id, false, USER_A)).toBe(true);
    expect(await deleteManualExpense(expA.id, USER_A)).toBe(true);
    expect(await listManualExpenses(USER_A)).toHaveLength(0);
  });

  it("isola transações, transferências, saldos e webhooks entre Usuário A e Usuário B", async () => {
    await upsertTransaction({
      userId: USER_A,
      id: "tx_alice_01",
      gateway: "OMEGAPAY",
      paymentMethod: "PIX",
      grossAmount: 497,
      feeAmount: 24.85,
      netAmount: 472.15,
      status: "COMPLETED",
      lastEvent: "TRANSACTION_PAID",
      productName: "Curso Alice",
    });

    await upsertTransfer({
      userId: USER_A,
      id: "wth_alice_01",
      gateway: "OMEGAPAY",
      amount: 300,
      receivedAmount: 296.5,
      feeAmount: 3.5,
      status: "COMPLETED",
      lastEvent: "TRANSFER_COMPLETED",
    });

    await saveBalanceSnapshot(
      { available: 1250.5, pending: 400, fundLock: 0 },
      "OMEGAPAY",
      USER_A
    );

    // Webhook OmegaPay direcionado para Usuário A
    const whResA = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_PAID",
        token: "wh_token_alice_789",
        transaction: {
          id: "tx_wh_alice_02",
          amount: 197,
          chargeAmount: 197,
          commissionAmount: 187.15,
          status: "COMPLETED",
          paymentMethod: "PIX",
        },
        orderItems: [{ product: { name: "Upsell Alice" }, price: 197 }],
      },
      "wh_token_alice_789",
      USER_A
    );
    expect(whResA.ok).toBe(true);

    // Webhook Nexus direcionado para Usuário B
    const whResB = await processNexusWebhook(
      {
        event: "TRANSACTION_PAID",
        data: {
          id: "nex_bruno_01",
          status: "paid",
          amount: 97,
          fee: 4.85,
          net_amount: 92.15,
          payment_method: "PIX",
          product: { name: "Ebook Bruno" },
        },
      },
      "",
      USER_B
    );
    expect(whResB.ok).toBe(true);

    // Saldos isolados (Usuário B não enxerga saldo da Alice)
    const balancesA = await getAllBalanceSnapshots(USER_A);
    const balancesB = await getAllBalanceSnapshots(USER_B);
    expect(balancesA.OMEGAPAY.available).toBe(1250.5);
    expect(balancesB.OMEGAPAY.available).toBe(0);
    expect(balancesB.OMEGAPAY.fetchedAt).toBeNull();

    // Transações isoladas
    const txsA = await listTransactions(USER_A);
    const txsB = await listTransactions(USER_B);
    expect(txsA.map((t) => t.id).sort()).toEqual(["tx_alice_01", "tx_wh_alice_02"]);
    expect(txsB.map((t) => t.id)).toEqual(["nex_bruno_01"]);

    // Transferências isoladas
    expect(await listTransfers(USER_A)).toHaveLength(1);
    expect(await listTransfers(USER_B)).toHaveLength(0);

    // Logs de webhook isolados
    const hooksA = await listRecentWebhookEvents(20, USER_A);
    const hooksB = await listRecentWebhookEvents(20, USER_B);
    expect(hooksA.every((h) => h.entityId === "tx_wh_alice_02")).toBe(true);
    expect(hooksB.every((h) => h.entityId === "nex_bruno_01")).toBe(true);
  });

  it("aplica rate limiting contra tentativas abusivas de login e cadastro", () => {
    resetRateLimitStore();
    const key = "login:test-ip:alice@dashfy.test";

    for (let i = 0; i < 5; i++) {
      const check = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
      expect(check.allowed).toBe(true);
    }

    const blocked = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
