import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  maxIsoTimestamp,
  parseIsoTimestampParam,
  toIsoTimestamp,
  toNullableIsoTimestamp,
} from "@/lib/date-utils";
import {
  getUserSettingsBatch,
  listSaleNotificationsSince,
  recordApprovedSaleNotification,
  setUserSetting,
} from "@/lib/db";

const TEST_DB_REL = "./data/test-date-and-sales-notifications.db";
const TEST_DB_ABS = path.resolve(
  process.cwd(),
  "data/test-date-and-sales-notifications.db"
);

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const PG_22007_PROD_VALUE =
  "Sun Nov 22 2026 17:54:15 GMT+0000 (Coordinated Universal Time)";

describe("Dashfy — Normalização de Datas (PG 22007), Fusos Horários e Notificações de Vendas", () => {
  beforeAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
    process.env.DATABASE_URL = `file:${TEST_DB_REL}`;
    delete process.env.VERCEL;
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
  });

  it("normaliza objetos Date do driver pg, timestamps nativos do PostgreSQL e o valor real do erro 22007 para ISO 8601 UTC", () => {
    expect(toIsoTimestamp(PG_22007_PROD_VALUE)).toBe("2026-11-22T17:54:15.000Z");

    const pgDate = new Date("2026-11-22T17:54:15.000Z");
    expect(toIsoTimestamp(pgDate)).toBe("2026-11-22T17:54:15.000Z");

    // Formato textual do PostgreSQL com espaço e offset curto (+00 / -03)
    expect(toIsoTimestamp("2026-11-22 17:54:15+00")).toBe(
      "2026-11-22T17:54:15.000Z"
    );
    expect(toIsoTimestamp("2026-11-22 17:54:15.250+00")).toBe(
      "2026-11-22T17:54:15.250Z"
    );
    expect(toIsoTimestamp("2026-11-22 14:54:15-03")).toBe(
      "2026-11-22T17:54:15.000Z"
    );

    // Offset ISO de Brasília (-03:00) convertido corretamente para UTC
    expect(toIsoTimestamp("2026-11-22T14:54:15-03:00")).toBe(
      "2026-11-22T17:54:15.000Z"
    );

    // Fallbacks seguros para valores inválidos
    expect(toIsoTimestamp("data-invalida", "2026-01-01T00:00:00.000Z")).toBe(
      "2026-01-01T00:00:00.000Z"
    );
    expect(toNullableIsoTimestamp("nao-e-data")).toBeNull();
    expect(toNullableIsoTimestamp("")).toBeNull();
    expect(toNullableIsoTimestamp(null)).toBeNull();
  });

  it("valida parâmetro ?since= aceitando ISO 8601, fusos horários e string GMT legada, e rejeitando datas inválidas", () => {
    // Vazio => sem filtro (null)
    expect(parseIsoTimestampParam(null)).toEqual({ valid: true, iso: null });
    expect(parseIsoTimestampParam("   ")).toEqual({ valid: true, iso: null });

    // ISO 8601 UTC válido
    expect(parseIsoTimestampParam("2026-11-22T17:54:15.000Z")).toEqual({
      valid: true,
      iso: "2026-11-22T17:54:15.000Z",
    });

    // Fusos horários distintos (-03:00 e +02:00)
    expect(parseIsoTimestampParam("2026-11-22T14:54:15-03:00")).toEqual({
      valid: true,
      iso: "2026-11-22T17:54:15.000Z",
    });
    expect(parseIsoTimestampParam("2026-11-22T19:54:15+02:00")).toEqual({
      valid: true,
      iso: "2026-11-22T17:54:15.000Z",
    });

    // Compatibilidade com cliente antigo em transição durante deploy (converte antes do SQL)
    expect(parseIsoTimestampParam(PG_22007_PROD_VALUE)).toEqual({
      valid: true,
      iso: "2026-11-22T17:54:15.000Z",
    });

    // Valores inválidos devem ser bloqueados antes de chegar ao PostgreSQL
    const invalidInputs = [
      "abc",
      "not-a-date",
      "2026-99-99",
      "12345",
      "1900-01-01T00:00:00.000Z",
      "2200-01-01T00:00:00.000Z",
      "x".repeat(120),
    ];

    for (const bad of invalidInputs) {
      const parsed = parseIsoTimestampParam(bad);
      expect(parsed.valid).toBe(false);
    }
  });

  it("compara watermarks numericamente (nunca lexicograficamente) impedindo que 'Sun Nov 22...' vença '2026-11-22...'", () => {
    const newerIso = "2026-11-22T18:00:00.000Z";
    // Bug antigo: "Sun Nov 22..." > "2026-11-22..." dava true porque 'S' > '2'
    expect(maxIsoTimestamp(PG_22007_PROD_VALUE, newerIso)).toBe(newerIso);

    // Comparação correta entre fusos horários diferentes
    expect(
      maxIsoTimestamp("2026-11-22T15:30:00-03:00", "2026-11-22T18:00:00.000Z")
    ).toBe("2026-11-22T18:30:00.000Z");

    // Se o valor A for inválido, preserva B normalizado
    expect(maxIsoTimestamp("invalido", newerIso)).toBe(newerIso);
  });

  it("impede eventos duplicados, respeita fusos horários no filtro since e rejeita since inválido antes do SQL", async () => {
    const beforeAllIso = new Date(Date.now() - 5000).toISOString();

    const first = await recordApprovedSaleNotification({
      userId: USER_A,
      transactionId: "tx-unique-001",
      dedupeKey: `OMEGAPAY:${USER_A}:tx-unique-001`,
      gateway: "OMEGAPAY",
      productName: "Plano Pro Dashfy",
      grossAmount: 197.0,
      netAmount: 185.0,
      paymentMethod: "PIX",
    });
    expect(first.inserted).toBe(true);
    expect(first.notification?.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );

    // Mesmo dedupeKey para o mesmo usuário: deve ser ignorado (sem duplicidade)
    const duplicate = await recordApprovedSaleNotification({
      userId: USER_A,
      transactionId: "tx-unique-001",
      dedupeKey: `OMEGAPAY:${USER_A}:tx-unique-001`,
      gateway: "OMEGAPAY",
      productName: "Plano Pro Dashfy",
      grossAmount: 197.0,
      netAmount: 185.0,
      paymentMethod: "PIX",
    });
    expect(duplicate.inserted).toBe(false);

    // Pequena pausa para garantir timestamp distinto entre t1 e t2
    await new Promise((resolve) => setTimeout(resolve, 25));

    const second = await recordApprovedSaleNotification({
      userId: USER_A,
      transactionId: "tx-unique-002",
      dedupeKey: `OMEGAPAY:${USER_A}:tx-unique-002`,
      gateway: "OMEGAPAY",
      productName: "Upsell Dashfy",
      grossAmount: 97.0,
      netAmount: 91.0,
      paymentMethod: "CARD",
    });
    expect(second.inserted).toBe(true);

    // Venda de outro usuário (USER_B) nunca pode vazar para USER_A
    await recordApprovedSaleNotification({
      userId: USER_B,
      transactionId: "tx-user-b-001",
      dedupeKey: `NEXUS:${USER_B}:tx-user-b-001`,
      gateway: "NEXUS",
      productName: "Produto B",
      grossAmount: 500.0,
      netAmount: 470.0,
      paymentMethod: "PIX",
    });

    // Consulta com watermark antes de tudo retorna exatamente 2 eventos de USER_A (sem duplicidade e sem vazar USER_B)
    const allUserA = await listSaleNotificationsSince(USER_A, beforeAllIso, 10);
    expect(allUserA).toHaveLength(2);
    expect(allUserA.map((e) => e.transactionId)).toEqual([
      "tx-unique-001",
      "tx-unique-002",
    ]);

    // Converte o timestamp da 1ª venda para offset -03:00 (Brasília) e garante que só vem a 2ª venda
    const t1Date = new Date(first.notification!.createdAt);
    const brtMs = t1Date.getTime() - 3 * 60 * 60 * 1000;
    const sinceBrt = new Date(brtMs).toISOString().replace("Z", "-03:00");
    const eventsAfterT1 = await listSaleNotificationsSince(USER_A, sinceBrt, 10);
    expect(eventsAfterT1).toHaveLength(1);
    expect(eventsAfterT1[0].transactionId).toBe("tx-unique-002");

    // Consulta com string GMT legada equivalente a antes de tudo => também funciona sem erro 22007
    const legacyBefore = new Date(beforeAllIso).toString();
    const eventsAfterLegacy = await listSaleNotificationsSince(
      USER_A,
      legacyBefore,
      10
    );
    expect(eventsAfterLegacy).toHaveLength(2);

    // Consulta com data inválida deve rejeitar antes de executar SQL
    await expect(
      listSaleNotificationsSince(USER_A, "not-a-valid-timestamp", 10)
    ).rejects.toThrow(/ISO 8601|inválido/i);
  });

  it("carrega preferências em lote (getUserSettingsBatch) com isolamento estrito por usuário", async () => {
    await setUserSetting(USER_A, "CUSTOM_KEY_1", "valor-a1");
    await setUserSetting(USER_A, "CUSTOM_KEY_2", "valor-a2");
    await setUserSetting(USER_B, "CUSTOM_KEY_1", "valor-b1");

    const batchA = await getUserSettingsBatch(USER_A);
    const batchB = await getUserSettingsBatch(USER_B);

    expect(batchA["CUSTOM_KEY_1"]).toBe("valor-a1");
    expect(batchA["CUSTOM_KEY_2"]).toBe("valor-a2");
    expect(batchB["CUSTOM_KEY_1"]).toBe("valor-b1");
    expect(batchB["CUSTOM_KEY_2"]).toBeUndefined();
  });
});
