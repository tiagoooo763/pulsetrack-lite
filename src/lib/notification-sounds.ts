export type NotificationSoundId =
  | "cash_register"
  | "kaching_pro"
  | "coins"
  | "pix_money"
  | "gold_drop"
  | "bill_count"
  | "jackpot_sale"
  | "classic_bell"
  | "soft_notification"
  | "custom"
  | "silent";

export interface NotificationSoundOption {
  id: NotificationSoundId;
  label: string;
  description: string;
  audioUrl: string | null;
  isDefault?: boolean;
}

export interface UserSoundPreferences {
  userId: string;
  soundEnabled: boolean;
  selectedSound: NotificationSoundId;
  soundVolume: number; // 0..100
  customSoundPath: string | null;
  customSoundName: string | null;
  customSoundMime: string | null;
  updatedAt: string;
}

export interface SaleNotificationEvent {
  id: string;
  transactionId: string;
  gateway: string;
  productName: string;
  grossAmount: number;
  netAmount: number;
  paymentMethod: string;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
}

export const MAX_CUSTOM_SOUND_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_SOUND_EXTENSIONS = ["mp3", "wav", "ogg"] as const;
export type AllowedSoundExtension = (typeof ALLOWED_SOUND_EXTENSIONS)[number];

export const DEFAULT_SOUND_PREFERENCES: Omit<
  UserSoundPreferences,
  "userId" | "updatedAt"
> = {
  soundEnabled: true,
  selectedSound: "cash_register",
  soundVolume: 70,
  customSoundPath: null,
  customSoundName: null,
  customSoundMime: null,
};

export const SOUND_LIBRARY_OPTIONS: NotificationSoundOption[] = [
  {
    id: "cash_register",
    label: "Caixa registradora",
    description: "Ka-Ching clássico de gaveta e campainha metálica (padrão)",
    audioUrl: "/sounds/cash-register.wav",
    isDefault: true,
  },
  {
    id: "kaching_pro",
    label: "Ka-Ching Turbo",
    description: "Estalo de caixa com brilho metálico duplo de venda confirmada",
    audioUrl: "/sounds/kaching-pro.wav",
  },
  {
    id: "coins",
    label: "Chuva de moedas",
    description: "Cascata realista de moedas metálicas tilintando",
    audioUrl: "/sounds/coins.wav",
  },
  {
    id: "pix_money",
    label: "Dinheiro na conta (Pix)",
    description: "Acorde cristalino ascendente estilo pagamento instantâneo",
    audioUrl: "/sounds/pix-money.wav",
  },
  {
    id: "gold_drop",
    label: "Moeda de ouro",
    description: "Toque rápido e marcante de moeda caindo no cofre",
    audioUrl: "/sounds/gold-drop.wav",
  },
  {
    id: "bill_count",
    label: "Notas & Cofre",
    description: "Estalo rápido de cédulas seguido de confirmação dourada",
    audioUrl: "/sounds/bill-count.wav",
  },
  {
    id: "jackpot_sale",
    label: "Venda Alta (Jackpot)",
    description: "Fanfarra curta e elegante com tilintar de moedas",
    audioUrl: "/sounds/jackpot-sale.wav",
  },
  {
    id: "classic_bell",
    label: "Sino clássico",
    description: "Sino limpo e discreto de balcão",
    audioUrl: "/sounds/classic-bell.wav",
  },
  {
    id: "soft_notification",
    label: "Notificação suave",
    description: "Alerta moderno de dois tons suaves",
    audioUrl: "/sounds/soft-notification.wav",
  },
  {
    id: "custom",
    label: "Som personalizado",
    description: "Use seu próprio arquivo MP3, WAV ou OGG (até 2 MB)",
    audioUrl: null,
  },
  {
    id: "silent",
    label: "Silencioso",
    description: "Exibe apenas a notificação visual, sem som",
    audioUrl: null,
  },
];

export const VALID_SOUND_IDS = new Set<NotificationSoundId>([
  "cash_register",
  "kaching_pro",
  "coins",
  "pix_money",
  "gold_drop",
  "bill_count",
  "jackpot_sale",
  "classic_bell",
  "soft_notification",
  "custom",
  "silent",
]);

export function getBuiltInSoundUrl(soundId: NotificationSoundId): string | null {
  const found = SOUND_LIBRARY_OPTIONS.find((opt) => opt.id === soundId);
  return found?.audioUrl ?? null;
}

export function normalizeSoundVolume(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_SOUND_PREFERENCES.soundVolume;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function isValidSoundId(value: unknown): value is NotificationSoundId {
  return (
    typeof value === "string" &&
    VALID_SOUND_IDS.has(value as NotificationSoundId)
  );
}

export type AudioValidationResult =
  | {
      ok: true;
      ext: AllowedSoundExtension;
      mimeType: "audio/mpeg" | "audio/wav" | "audio/ogg";
      safeFileName: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Detecta o formato real do arquivo de áudio pelos magic bytes binários
 * (não confia apenas na extensão ou no header Content-Type enviado pelo navegador).
 */
export function detectAudioMagicBytes(
  buffer: Uint8Array
): { ext: AllowedSoundExtension; mimeType: "audio/mpeg" | "audio/wav" | "audio/ogg" } | null {
  if (!buffer || buffer.length < 12) return null;

  // WAV: "RIFF" + 4 bytes tamanho + "WAVE"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x41 && // A
    buffer[10] === 0x56 && // V
    buffer[11] === 0x45 // E
  ) {
    return { ext: "wav", mimeType: "audio/wav" };
  }

  // OGG: "OggS"
  if (
    buffer[0] === 0x4f && // O
    buffer[1] === 0x67 && // g
    buffer[2] === 0x67 && // g
    buffer[3] === 0x53 // S
  ) {
    return { ext: "ogg", mimeType: "audio/ogg" };
  }

  // MP3 com tag ID3 ("ID3")
  if (
    buffer[0] === 0x49 && // I
    buffer[1] === 0x44 && // D
    buffer[2] === 0x33 // 3
  ) {
    return { ext: "mp3", mimeType: "audio/mpeg" };
  }

  // MP3 sem ID3: frame sync MPEG-1/2 Layer III (0xFF seguido de 0xE0..0xFF válido)
  if (
    buffer[0] === 0xff &&
    (buffer[1] & 0xe0) === 0xe0 &&
    (buffer[1] & 0x18) !== 0x08 && // versão MPEG não reservada
    (buffer[1] & 0x06) !== 0x00 // layer não reservado
  ) {
    return { ext: "mp3", mimeType: "audio/mpeg" };
  }

  return null;
}

/**
 * Valida rigorosamente extensão, tipo binário real e tamanho (<= 2 MB) no backend.
 */
export function validateUploadedAudioFile(input: {
  fileName: string;
  declaredMime?: string;
  buffer: Uint8Array;
}): AudioValidationResult {
  const rawName = (input.fileName || "").trim();
  if (!rawName) {
    return { ok: false, error: "Nome do arquivo inválido." };
  }

  if (!input.buffer || input.buffer.length === 0) {
    return { ok: false, error: "O arquivo enviado está vazio." };
  }

  if (input.buffer.length > MAX_CUSTOM_SOUND_BYTES) {
    return {
      ok: false,
      error: "O arquivo excede o limite máximo de 2 MB.",
    };
  }

  const baseName = rawName.split(/[\\/]/).pop() || rawName;
  const dotIdx = baseName.lastIndexOf(".");
  const ext = dotIdx > 0 ? baseName.slice(dotIdx + 1).toLowerCase() : "";

  if (
    !ALLOWED_SOUND_EXTENSIONS.includes(ext as AllowedSoundExtension)
  ) {
    return {
      ok: false,
      error: "Formato não permitido. Envie apenas arquivos MP3, WAV ou OGG.",
    };
  }

  const detected = detectAudioMagicBytes(input.buffer);
  if (!detected) {
    return {
      ok: false,
      error:
        "O conteúdo do arquivo não corresponde a um áudio MP3, WAV ou OGG válido.",
    };
  }

  if (detected.ext !== ext) {
    return {
      ok: false,
      error: `A extensão (.${ext}) não corresponde ao formato real do áudio (.${detected.ext}).`,
    };
  }

  const cleanBase = baseName
    .replace(/[^a-zA-Z0-9._-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return {
    ok: true,
    ext: detected.ext,
    mimeType: detected.mimeType,
    safeFileName: cleanBase || `som-personalizado.${detected.ext}`,
  };
}
