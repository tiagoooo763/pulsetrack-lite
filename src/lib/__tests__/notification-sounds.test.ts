import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  DEFAULT_SOUND_PREFERENCES,
  MAX_CUSTOM_SOUND_BYTES,
  SOUND_LIBRARY_OPTIONS,
  validateUploadedAudioFile,
} from "@/lib/notification-sounds";
import {
  createSignedUserSoundUrl,
  deletePrivateUserSound,
  isSoundPathOwnedByUser,
  uploadPrivateUserSound,
  verifySignedStreamToken,
} from "@/lib/sound-storage";
import {
  getUserSoundPreferences,
  listSaleNotificationsSince,
  resetUserSoundPreferences,
  upsertUserSoundPreferences,
} from "@/lib/db";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { processNexusWebhook } from "@/lib/nexus-processor";

const TEST_DB_REL = "./data/test-notification-sounds.db";
const TEST_DB_ABS = path.resolve(process.cwd(), "data/test-notification-sounds.db");

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeValidMp3Buffer(): Buffer {
  // Header ID3v2.3 válido + payload dummy de áudio
  return Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20]),
    Buffer.alloc(64, 0x11),
  ]);
}

function makeValidWavBuffer(): Buffer {
  const b = Buffer.alloc(64, 0);
  b.write("RIFF", 0);
  b.writeUInt32LE(56, 4);
  b.write("WAVE", 8);
  return b;
}

function makeValidOggBuffer(): Buffer {
  return Buffer.concat([Buffer.from("OggS"), Buffer.alloc(60, 0x22)]);
}

describe("Dashfy — Sistema de Sons Personalizados para Notificações de Vendas", () => {
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
    try {
      const localRoot = path.resolve(process.cwd(), "data", "private-sounds");
      for (const uid of [USER_A, USER_B]) {
        const dir = path.join(localRoot, uid);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("verifica que todos os 4 arquivos da biblioteca embutida existem e são WAV válidos", () => {
    const builtIns = SOUND_LIBRARY_OPTIONS.filter((o) => o.audioUrl);
    expect(builtIns).toHaveLength(4);

    for (const opt of builtIns) {
      const filePath = path.join(process.cwd(), "public", opt.audioUrl!.replace(/^\//, ""));
      expect(fs.existsSync(filePath)).toBe(true);
      const buf = fs.readFileSync(filePath);
      const check = validateUploadedAudioFile({
        fileName: path.basename(filePath),
        buffer: buf,
      });
      expect(check.ok).toBe(true);
    }
  });

  it("1-4 e 7: novo usuário recebe Caixa registradora (70%), altera som/volume/silencioso, persiste entre sessões e restaura padrão", async () => {
    // 1. Padrão para novo usuário
    const initialA = await getUserSoundPreferences(USER_A);
    expect(initialA.soundEnabled).toBe(true);
    expect(initialA.selectedSound).toBe("cash_register");
    expect(initialA.soundVolume).toBe(70);
    expect(initialA.customSoundPath).toBeNull();

    // 2. Seleciona outro som e salva
    const updatedSound = await upsertUserSoundPreferences(USER_A, {
      selectedSound: "coins",
    });
    expect(updatedSound.selectedSound).toBe("coins");

    // 3. Altera volume (testando valor válido e clamping)
    const updatedVol = await upsertUserSoundPreferences(USER_A, {
      soundVolume: 45,
    });
    expect(updatedVol.soundVolume).toBe(45);

    const clampedVol = await upsertUserSoundPreferences(USER_A, {
      soundVolume: 180,
    });
    expect(clampedVol.soundVolume).toBe(100);

    // 4. Usa opção Silencioso
    const silentPrefs = await upsertUserSoundPreferences(USER_A, {
      selectedSound: "silent",
      soundVolume: 35,
    });
    expect(silentPrefs.selectedSound).toBe("silent");

    // 7. Reconsulta simulando logout + novo login (persistência real no banco)
    const reloaded = await getUserSoundPreferences(USER_A);
    expect(reloaded.selectedSound).toBe("silent");
    expect(reloaded.soundVolume).toBe(35);

    // Restaurar padrão
    const restored = await resetUserSoundPreferences(USER_A);
    expect(restored.soundEnabled).toBe(DEFAULT_SOUND_PREFERENCES.soundEnabled);
    expect(restored.selectedSound).toBe("cash_register");
    expect(restored.soundVolume).toBe(70);
  });

  it("5 e 6: aceita MP3/WAV/OGG válidos e rejeita arquivos inválidos, executáveis, disfarçados ou acima de 2 MB", () => {
    // Válidos
    const mp3 = validateUploadedAudioFile({
      fileName: "meu-alerta.mp3",
      buffer: makeValidMp3Buffer(),
    });
    expect(mp3.ok).toBe(true);
    if (mp3.ok) expect(mp3.mimeType).toBe("audio/mpeg");

    const wav = validateUploadedAudioFile({
      fileName: "sino.wav",
      buffer: makeValidWavBuffer(),
    });
    expect(wav.ok).toBe(true);

    const ogg = validateUploadedAudioFile({
      fileName: "alerta.ogg",
      buffer: makeValidOggBuffer(),
    });
    expect(ogg.ok).toBe(true);

    // Inválidos: executável / script disfarçado de .mp3
    const disguisedScript = validateUploadedAudioFile({
      fileName: "virus.mp3",
      buffer: Buffer.from("<script>alert('xss')</script>"),
    });
    expect(disguisedScript.ok).toBe(false);

    // Inválido: extensão .exe
    const exeFile = validateUploadedAudioFile({
      fileName: "payload.exe",
      buffer: makeValidMp3Buffer(),
    });
    expect(exeFile.ok).toBe(false);

    // Inválido: extensão .mp3 mas conteúdo binário WAV
    const mismatch = validateUploadedAudioFile({
      fileName: "falso.mp3",
      buffer: makeValidWavBuffer(),
    });
    expect(mismatch.ok).toBe(false);

    // Inválido: acima de 2 MB
    const oversized = Buffer.concat([
      makeValidMp3Buffer(),
      Buffer.alloc(MAX_CUSTOM_SOUND_BYTES + 10),
    ]);
    const tooBig = validateUploadedAudioFile({
      fileName: "grande.mp3",
      buffer: oversized,
    });
    expect(tooBig.ok).toBe(false);

    // Inválido: vazio
    const empty = validateUploadedAudioFile({
      fileName: "vazio.mp3",
      buffer: Buffer.alloc(0),
    });
    expect(empty.ok).toBe(false);
  });

  it("5 e 10: armazena MP3 privado vinculado ao proprietário, gera URL assinada temporária e bloqueia acesso cruzado entre usuários", async () => {
    const mp3Buf = makeValidMp3Buffer();
    const uploaded = await uploadPrivateUserSound({
      userId: USER_A,
      buffer: mp3Buf,
      ext: "mp3",
      mimeType: "audio/mpeg",
    });

    await upsertUserSoundPreferences(USER_A, {
      customSoundPath: uploaded.objectPath,
      customSoundName: "meu-caixa.mp3",
      customSoundMime: "audio/mpeg",
      selectedSound: "custom",
    });

    // Propriedade estrita por usuário
    expect(isSoundPathOwnedByUser(uploaded.objectPath, USER_A)).toBe(true);
    expect(isSoundPathOwnedByUser(uploaded.objectPath, USER_B)).toBe(false);
    expect(isSoundPathOwnedByUser(`../${USER_A}/custom.mp3`, USER_B)).toBe(false);

    // Usuário A consegue gerar URL temporária assinada
    const signedA = await createSignedUserSoundUrl({
      userId: USER_A,
      objectPath: uploaded.objectPath,
    });
    expect(signedA).toBeTruthy();

    // Token da URL temporária do Usuário A é rejeitado se o Usuário B tentar usar
    const tokenParam = new URL(`https://www.usedashfy.com.br${signedA}`).searchParams.get("token");
    expect(verifySignedStreamToken(tokenParam, USER_A).valid).toBe(true);
    expect(verifySignedStreamToken(tokenParam, USER_B).valid).toBe(false);

    // Usuário B NÃO consegue gerar URL assinada nem excluir o arquivo do Usuário A
    const signedB = await createSignedUserSoundUrl({
      userId: USER_B,
      objectPath: uploaded.objectPath,
    });
    expect(signedB).toBeNull();
    expect(
      await deletePrivateUserSound({
        userId: USER_B,
        objectPath: uploaded.objectPath,
      })
    ).toBe(false);

    // Usuário B continua com preferências padrão independentes
    const prefsB = await getUserSoundPreferences(USER_B);
    expect(prefsB.selectedSound).toBe("cash_register");
    expect(prefsB.customSoundPath).toBeNull();

    // Usuário A consegue excluir seu próprio áudio
    expect(
      await deletePrivateUserSound({
        userId: USER_A,
        objectPath: uploaded.objectPath,
      })
    ).toBe(true);
  });

  it("8, 9 e 10: venda aprovada gera notificação (preservando UTM TikTok), ignora pendentes/duplicados e isola entre usuários", async () => {
    const token = "wh_sound_test_token";
    const before = new Date(Date.now() - 1000).toISOString();

    // Evento PENDENTE não deve disparar notificação de venda aprovada
    const pendingRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_CREATED",
        token,
        transaction: {
          id: "tx_snd_01",
          amount: 197,
          status: "PENDING",
          paymentMethod: "PIX",
        },
        orderItems: [{ product: { name: "Curso Dashfy" }, price: 197 }],
      },
      token,
      USER_A
    );
    expect(pendingRes.ok).toBe(true);
    expect(await listSaleNotificationsSince(USER_A, before)).toHaveLength(0);

    // Venda APROVADA com atribuição TikTok Ads deve gerar exatamente 1 notificação
    const paidRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_PAID",
        token,
        transaction: {
          id: "tx_snd_01",
          amount: 197,
          commissionAmount: 187.15,
          status: "COMPLETED",
          paymentMethod: "PIX",
        },
        orderItems: [{ product: { name: "Curso Dashfy" }, price: 197 }],
        trackProps: {
          utm_source: "tiktok",
          utm_campaign: "escala_q4_video01",
        },
      },
      token,
      USER_A
    );
    expect(paidRes.ok).toBe(true);

    // Evento DUPLICADO não pode gerar segunda notificação
    const dupRes = await processOmegaPayWebhook(
      {
        event: "TRANSACTION_PAID",
        token,
        transaction: {
          id: "tx_snd_01",
          amount: 197,
          commissionAmount: 187.15,
          status: "COMPLETED",
          paymentMethod: "PIX",
        },
        orderItems: [{ product: { name: "Curso Dashfy" }, price: 197 }],
      },
      token,
      USER_A
    );
    expect(dupRes.ok).toBe(true);
    expect(dupRes.duplicate).toBe(true);

    const notifsA = await listSaleNotificationsSince(USER_A, before);
    expect(notifsA).toHaveLength(1);
    expect(notifsA[0].transactionId).toBe("tx_snd_01");
    expect(notifsA[0].grossAmount).toBe(197);
    expect(notifsA[0].utmSource).toBe("tiktok");
    expect(notifsA[0].utmCampaign).toBe("escala_q4_video01");

    // Isolamento: Usuário B não recebe notificações de vendas do Usuário A
    expect(await listSaleNotificationsSince(USER_B, before)).toHaveLength(0);

    // Venda aprovada na Nexus para Usuário B aparece apenas para Usuário B
    const nexusRes = await processNexusWebhook(
      {
        event: "TRANSACTION_PAID",
        data: {
          id: "nex_snd_b1",
          status: "paid",
          amount: 297,
          fee: 14.85,
          net_amount: 282.15,
          payment_method: "PIX",
          product: { name: "Produto Bruno" },
        },
      },
      "",
      USER_B
    );
    expect(nexusRes.ok).toBe(true);

    const notifsB = await listSaleNotificationsSince(USER_B, before);
    expect(notifsB).toHaveLength(1);
    expect(notifsB[0].gateway).toBe("NEXUS");
    expect(notifsB[0].productName).toBe("Produto Bruno");
    expect(await listSaleNotificationsSince(USER_A, before)).toHaveLength(1);
  });
});
