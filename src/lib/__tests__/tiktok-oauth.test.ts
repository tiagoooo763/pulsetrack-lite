import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTikTokOAuthState,
  decryptSecret,
  encryptSecret,
  verifyTikTokOAuthState,
} from "@/lib/token-crypto";
import {
  buildTikTokAuthorizeUrl,
  classifyTikTokError,
  DEFAULT_TIKTOK_CALLBACK_URL,
  exchangeTikTokAuthCode,
  fetchAuthorizedTikTokAdvertisers,
  fetchAuthorizedTikTokBusinessCenters,
  fetchTikTokReadOnlyReport,
  TikTokApiError,
} from "@/lib/tiktok-client";
import { sanitizeData } from "@/lib/sanitize";
import {
  deleteTikTokConnection,
  getTikTokConnectionWithToken,
  listTikTokConnections,
  updateTikTokConnectionStatus,
  upsertTikTokConnection,
} from "@/lib/db";

const TEST_DB_REL = "./data/test-tiktok-oauth.db";
const TEST_DB_ABS = path.resolve(process.cwd(), "data/test-tiktok-oauth.db");

const USER_A = "11111111-1111-4111-8111-11111111111a";
const USER_B = "22222222-2222-4222-8222-22222222222b";

describe("Dashfy — Integração OAuth TikTok Marketing API (Segurança, Leitura e Multi-Usuário)", () => {
  beforeAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
    process.env.DATABASE_URL = `file:${TEST_DB_REL}`;
    process.env.TIKTOK_APP_ID = "7999999999999999999";
    process.env.TIKTOK_APP_SECRET = "super_secret_tiktok_app_key_never_expose";
    process.env.TIKTOK_REDIRECT_URI = DEFAULT_TIKTOK_CALLBACK_URL;
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
  });

  it("gera URL oficial de autorização do TikTok sem expor o App Secret", () => {
    const { state } = createTikTokOAuthState({
      userId: USER_A,
      dashboardId: "tiktok",
    });
    const urlStr = buildTikTokAuthorizeUrl({ state });
    const parsed = new URL(urlStr);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://business-api.tiktok.com/portal/auth"
    );
    expect(parsed.searchParams.get("app_id")).toBe("7999999999999999999");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://www.usedashfy.com.br/api/integrations/tiktok/callback"
    );
    expect(parsed.searchParams.get("state")).toBe(state);
    expect(urlStr).not.toContain("super_secret_tiktok_app_key_never_expose");
  });

  it("valida state OAuth contra CSRF, troca de usuário, adulteração e expiração", () => {
    const now = Date.now();
    const { state, nonce } = createTikTokOAuthState({
      userId: USER_A,
      dashboardId: "operacao_3",
      label: "BC Escala",
      nowMs: now,
    });

    // Fluxo legítimo
    const ok = verifyTikTokOAuthState({
      state,
      expectedUserId: USER_A,
      cookieNonce: nonce,
      nowMs: now + 60_000,
    });
    expect(ok).toEqual({
      valid: true,
      dashboardId: "operacao_3",
      label: "BC Escala",
    });

    // Usuário diferente na sessão (session fixation / replay)
    const wrongUser = verifyTikTokOAuthState({
      state,
      expectedUserId: USER_B,
      cookieNonce: nonce,
      nowMs: now + 10_000,
    });
    expect(wrongUser.valid).toBe(false);

    // Cookie nonce ausente ou diferente (CSRF)
    const wrongNonce = verifyTikTokOAuthState({
      state,
      expectedUserId: USER_A,
      cookieNonce: "outro_nonce",
      nowMs: now + 10_000,
    });
    expect(wrongNonce.valid).toBe(false);

    // Assinatura adulterada
    const tampered = verifyTikTokOAuthState({
      state: `${state}x`,
      expectedUserId: USER_A,
      cookieNonce: nonce,
      nowMs: now + 10_000,
    });
    expect(tampered.valid).toBe(false);

    // Expirado (> 10 minutos)
    const expired = verifyTikTokOAuthState({
      state,
      expectedUserId: USER_A,
      cookieNonce: nonce,
      nowMs: now + 11 * 60 * 1000,
    });
    expect(expired.valid).toBe(false);
  });

  it("criptografa e descriptografa access_token em AES-256-GCM e sanitiza segredos em logs", () => {
    const plain = "act_tiktok_live_token_abc123456789";
    const enc1 = encryptSecret(plain);
    const enc2 = encryptSecret(plain);

    expect(enc1.startsWith("enc:v1:")).toBe(true);
    expect(enc1).not.toContain(plain);
    expect(enc1).not.toBe(enc2); // IV aleatório por gravação
    expect(decryptSecret(enc1)).toBe(plain);
    expect(decryptSecret(enc2)).toBe(plain);
    expect(() => decryptSecret(`${enc1}corrupted`)).toThrow();

    const safePayload = sanitizeData({
      app_secret: "secret_1",
      access_token: "token_1",
      auth_code: "code_1",
      refresh_token: "ref_1",
      advertiser_id: "70011223344",
    });

    expect(safePayload.app_secret).toBe("[REDACTED]");
    expect(safePayload.access_token).toBe("[REDACTED]");
    expect(safePayload.auth_code).toBe("[REDACTED]");
    expect(safePayload.refresh_token).toBe("[REDACTED]");
    expect(safePayload.advertiser_id).toBe("70011223344");
  });

  it("troca auth_code por access_token e consulta contas, BCs e relatórios somente-leitura via API oficial", async () => {
    const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      const headers = (init?.headers || {}) as Record<string, string>;
      calls.push({ url, method, headers });

      if (url.includes("/oauth2/access_token/")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "OK",
            data: {
              access_token: "tt_mock_access_token_xyz",
              advertiser_ids: ["7100001", "7100002"],
              scope: ["ad.read", "reporting.read"],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/oauth2/advertiser/get/")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "OK",
            data: {
              list: [
                { advertiser_id: "7100001", advertiser_name: "CA Principal BR" },
                { advertiser_id: "7100002", advertiser_name: "CA Escala 02" },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/bc/get/")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "OK",
            data: {
              list: [
                {
                  bc_info: {
                    bc_id: "890001",
                    name: "BC Dashfy Oficial",
                    currency: "BRL",
                    status: "STATUS_ENABLE",
                  },
                  user_role: "ADMIN",
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/report/integrated/get/")) {
        return new Response(
          JSON.stringify({
            code: 0,
            message: "OK",
            data: {
              list: [
                {
                  dimensions: {
                    campaign_id: "9001",
                    stat_time_day: "2026-11-20 00:00:00",
                  },
                  metrics: {
                    campaign_name: "Campanha Teste Leitura",
                    spend: "120.50",
                    impressions: "15000",
                    clicks: "300",
                    cpc: "0.40",
                    cpm: "8.03",
                    conversion: "8",
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ code: 404, message: "Not Found" }), {
        status: 404,
      });
    }) as typeof fetch;

    const exchanged = await exchangeTikTokAuthCode("auth_code_123", mockFetch);
    expect(exchanged.accessToken).toBe("tt_mock_access_token_xyz");
    expect(exchanged.advertiserIds).toEqual(["7100001", "7100002"]);

    const advertisers = await fetchAuthorizedTikTokAdvertisers(
      exchanged.accessToken,
      mockFetch
    );
    expect(advertisers).toHaveLength(2);
    expect(advertisers[0].advertiserName).toBe("CA Principal BR");

    const bcRes = await fetchAuthorizedTikTokBusinessCenters(
      exchanged.accessToken,
      mockFetch
    );
    expect(bcRes.businessCenters).toHaveLength(1);
    expect(bcRes.businessCenters[0].name).toBe("BC Dashfy Oficial");

    const report = await fetchTikTokReadOnlyReport(
      {
        accessToken: exchanged.accessToken,
        advertiserId: "7100001",
        startDate: "2026-11-15",
        endDate: "2026-11-21",
      },
      mockFetch
    );
    expect(report.totals.spend).toBe(120.5);
    expect(report.totals.impressions).toBe(15000);
    expect(report.totals.clicks).toBe(300);
    expect(report.totals.conversions).toBe(8);
    expect(report.rows[0].campaignName).toBe("Campanha Teste Leitura");

    // Garante que somente GET foi usado nas consultas de contas/BC/relatórios (zero escrita)
    const readCalls = calls.filter((c) => !c.url.includes("/oauth2/access_token/"));
    expect(readCalls.every((c) => c.method === "GET")).toBe(true);
  });

  it("classifica corretamente falhas de token inválido, permissão, auth_code e conta indisponível", () => {
    const invalidToken = classifyTikTokError(40105, "Access token is invalid");
    expect(invalidToken).toBeInstanceOf(TikTokApiError);
    expect(invalidToken.category).toBe("INVALID_TOKEN");
    expect(invalidToken.httpStatus).toBe(401);

    const noPerm = classifyTikTokError(40002, "No permission for scope");
    expect(noPerm.category).toBe("NO_PERMISSION");
    expect(noPerm.httpStatus).toBe(403);

    const badCode = classifyTikTokError(40003, "Invalid auth_code");
    expect(badCode.category).toBe("INVALID_AUTH_CODE");

    const badAcc = classifyTikTokError(40008, "Advertiser unavailable");
    expect(badAcc.category).toBe("UNAVAILABLE_ACCOUNT");
  });

  it("suporta múltiplas contas por usuário, nunca expõe tokens na listagem e bloqueia acesso cruzado (IDOR)", async () => {
    const connA1 = await upsertTikTokConnection({
      userId: USER_A,
      dashboardId: "tiktok",
      label: "BC Loja 01",
      accessTokenEnc: encryptSecret("token_alice_bc1"),
      scope: ["ad.read", "reporting.read"],
      advertisers: [{ advertiserId: "7001", advertiserName: "CA Alice 01" }],
      businessCenters: [{ bcId: "bc_1", name: "BC Alice 01" }],
    });

    const connA2 = await upsertTikTokConnection({
      userId: USER_A,
      dashboardId: "operacao_3",
      label: "BC Loja 02",
      accessTokenEnc: encryptSecret("token_alice_bc2"),
      scope: ["ad.read", "reporting.read"],
      advertisers: [{ advertiserId: "7002", advertiserName: "CA Alice 02" }],
      businessCenters: [{ bcId: "bc_2", name: "BC Alice 02" }],
    });

    expect(connA1.id).not.toBe(connA2.id);

    const listA = await listTikTokConnections(USER_A);
    const listB = await listTikTokConnections(USER_B);

    expect(listA).toHaveLength(2);
    expect(listB).toHaveLength(0);

    // Verifica que listTikTokConnections NUNCA inclui accessTokenEnc nem o token em texto
    const serialized = JSON.stringify(listA);
    expect(serialized).not.toContain("accessTokenEnc");
    expect(serialized).not.toContain("token_alice_bc1");
    expect(serialized).not.toContain("enc:v1:");

    // Usuário B não consegue ler, alterar nem excluir conexões do Usuário A
    expect(await getTikTokConnectionWithToken(connA1.id, USER_B)).toBeNull();
    expect(
      await updateTikTokConnectionStatus(connA1.id, USER_B, { status: "REVOKED" })
    ).toBe(false);
    expect(await deleteTikTokConnection(connA1.id, USER_B)).toBe(false);

    // Usuário A consegue ler o token no servidor e desconectar normalmente
    const internalA1 = await getTikTokConnectionWithToken(connA1.id, USER_A);
    expect(internalA1).not.toBeNull();
    expect(decryptSecret(internalA1!.accessTokenEnc)).toBe("token_alice_bc1");
    expect(await deleteTikTokConnection(connA1.id, USER_A)).toBe(true);
    expect(await listTikTokConnections(USER_A)).toHaveLength(1);
  });
});
